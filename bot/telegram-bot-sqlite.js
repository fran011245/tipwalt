require('dotenv').config();
const { Telegraf } = require('telegraf');
const { createPublicClient, http, formatEther, parseEther } = require('viem');
const { base } = require('viem/chains');
const Database = require('better-sqlite3');
const path = require('path');

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Initialize SQLite database
const dbPath = path.join(__dirname, '..', 'database', 'tips.db');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE,
    telegram_username TEXT,
    wallet_address TEXT UNIQUE,
    permit2_approved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS tips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_telegram_id INTEGER,
    receiver_telegram_id INTEGER,
    amount TEXT,
    message TEXT,
    tx_hash TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_tips_sender ON tips(sender_telegram_id);
  CREATE INDEX IF NOT EXISTS idx_tips_receiver ON tips(receiver_telegram_id);
`);

console.log('✅ SQLite database initialized');

// Blockchain clients
const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org')
});

// WALToken contract ABI (minimal)
const WALT_TOKEN_ABI = [
  {
    "inputs": [{"name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "sender", "type": "address"},
      {"name": "recipient", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const WALT_TOKEN_ADDRESS = process.env.WALT_TOKEN_ADDRESS || '0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1';

// Bot commands

bot.command('start', async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username;
  
  try {
    // Check if user exists
    const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    const user = stmt.get(telegramId);
    
    if (!user) {
      // New user
      const insert = db.prepare('INSERT INTO users (telegram_id, telegram_username) VALUES (?, ?)');
      insert.run(telegramId, username);
      
      await ctx.reply(
        `🚀 Welcome to $WALT Tipping Bot!\n\n` +
        `Send tips to anyone on Telegram using $WALT tokens.\n\n` +
        `To get started, connect your wallet:\n` +
        `1. Send your Base wallet address (0x...)\n` +
        `2. Approve Permit2 for gasless transfers\n\n` +
        `Commands:\n` +
        `/balance - Check your balance\n` +
        `/tip @user amount [message] - Send a tip\n` +
        `/history - View your tipping history`,
        { parse_mode: 'HTML' }
      );
    } else {
      if (user.wallet_address) {
        await ctx.reply(
          `👋 Welcome back, @${username}!\n\n` +
          `Wallet: <code>${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}</code>\n` +
          `Status: ${user.permit2_approved ? '✅ Ready to tip' : '⏳ Pending Permit2 approval'}\n\n` +
          `Commands:\n` +
          `/balance - Check your balance\n` +
          `/tip @user amount [message] - Send a tip\n` +
          `/history - View your tipping history`,
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.reply(
          `👋 Welcome back!\n\n` +
          `Please send your Base wallet address to continue.`
        );
      }
    }
  } catch (error) {
    console.error('Error in /start:', error);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
});

// Handle wallet address input
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const telegramId = ctx.from.id;
  
  // Check if it's a wallet address
  if (text.startsWith('0x') && text.length === 42) {
    try {
      // Validate it's a valid Ethereum address
      if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
        await ctx.reply('❌ Invalid wallet address format. Please send a valid Base wallet address.');
        return;
      }
      
      // Update user with wallet address
      const update = db.prepare('UPDATE users SET wallet_address = ? WHERE telegram_id = ?');
      update.run(text.toLowerCase(), telegramId);
      
      await ctx.reply(
        `✅ Wallet connected: <code>${text.slice(0, 6)}...${text.slice(-4)}</code>\n\n` +
        `Next step: Approve Permit2 for gasless transfers.\n\n` +
        `Click the link below to approve:\n` +
        `<a href="https://walt.tip/approve?wallet=${text}">Approve Permit2</a>\n\n` +
        `Once approved, you'll be able to send tips instantly!`,
        { parse_mode: 'HTML' }
      );
      
    } catch (error) {
      console.error('Error saving wallet:', error);
      await ctx.reply('❌ Error saving wallet. Please try again.');
    }
    return;
  }
  
  // Default: ignore or help
  if (!text.startsWith('/')) {
    await ctx.reply('💡 Send me a Base wallet address (0x...) to connect, or use /help for commands.');
  }
});

bot.command('balance', async (ctx) => {
  const telegramId = ctx.from.id;
  
  try {
    const stmt = db.prepare('SELECT wallet_address FROM users WHERE telegram_id = ?');
    const user = stmt.get(telegramId);
    
    if (!user || !user.wallet_address) {
      await ctx.reply('❌ Please connect your wallet first with /start');
      return;
    }
    
    const walletAddress = user.wallet_address;
    
    // Fetch balance from blockchain
    const balance = await publicClient.readContract({
      address: WALT_TOKEN_ADDRESS,
      abi: WALT_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [walletAddress]
    });
    
    const formattedBalance = formatEther(balance);
    
    await ctx.reply(
      `💰 Your $WALT Balance\n\n` +
      `Wallet: <code>${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}</code>\n` +
      `Balance: <b>${formattedBalance} $WALT</b>\n\n` +
      `Use /tip to send tokens to other users!`,
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('Error fetching balance:', error);
    await ctx.reply('❌ Error fetching balance. Please try again.');
  }
});

bot.command('tip', async (ctx) => {
  const telegramId = ctx.from.id;
  const text = ctx.message.text;
  
  // Parse command: /tip @username amount [message]
  const parts = text.split(' ');
  if (parts.length < 3) {
    await ctx.reply(
      '❌ Usage: /tip @username amount [message]\n\n' +
      'Example: /tip @crypto_friend 100 Thanks for the help!'
    );
    return;
  }
  
  const recipientUsername = parts[1].replace('@', '');
  const amount = parseFloat(parts[2]);
  const message = parts.slice(3).join(' ') || 'No message';
  
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('❌ Please specify a valid amount.');
    return;
  }
  
  try {
    // Get sender info
    const senderStmt = db.prepare('SELECT wallet_address, permit2_approved FROM users WHERE telegram_id = ?');
    const sender = senderStmt.get(telegramId);
    
    if (!sender || !sender.wallet_address) {
      await ctx.reply('❌ Please connect your wallet first with /start');
      return;
    }
    
    if (!sender.permit2_approved) {
      await ctx.reply(
        '❌ You need to approve Permit2 first.\n' +
        'Visit: https://walt.tip/approve to continue.'
      );
      return;
    }
    
    // Check if recipient exists
    const recipientStmt = db.prepare('SELECT telegram_id, wallet_address FROM users WHERE telegram_username = ?');
    const recipient = recipientStmt.get(recipientUsername);
    
    if (!recipient) {
      await ctx.reply(
        `❌ @${recipientUsername} hasn't connected their wallet yet.\n` +
        `They need to start the bot and connect their wallet first.`
      );
      return;
    }
    
    if (!recipient.wallet_address) {
      await ctx.reply(`❌ @${recipientUsername} hasn't connected their wallet yet.`);
      return;
    }
    
    // Record pending tip
    const insertTip = db.prepare(`
      INSERT INTO tips (sender_telegram_id, receiver_telegram_id, amount, message, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    const result = insertTip.run(telegramId, recipient.telegram_id, parseEther(amount.toString()).toString(), message);
    const tipId = result.lastInsertRowid;
    
    // Execute transfer (in production, this would use Permit2 signature)
    await ctx.reply(
      `💸 Tip initiated!\n\n` +
      `To: @${recipientUsername}\n` +
      `Amount: ${amount} $WALT\n` +
      `Message: "${message}"\n\n` +
      `Complete the transfer:\n` +
      `<a href="https://walt.tip/send?to=${recipient.wallet_address}&amount=${amount}&tipId=${tipId}">Send $WALT</a>`,
      { parse_mode: 'HTML' }
    );
    
    // Notify recipient
    try {
      await ctx.telegram.sendMessage(
        recipient.telegram_id,
        `🎉 You received a tip!\n\n` +
        `From: @${ctx.from.username}\n` +
        `Amount: ${amount} $WALT\n` +
        `Message: "${message}"\n\n` +
        `Check your balance with /balance`,
        { parse_mode: 'HTML' }
      );
    } catch (notifyError) {
      console.log('Could not notify recipient:', notifyError.message);
    }
    
  } catch (error) {
    console.error('Error in /tip:', error);
    await ctx.reply('❌ Error processing tip. Please try again.');
  }
});

bot.command('history', async (ctx) => {
  const telegramId = ctx.from.id;
  
  try {
    const stmt = db.prepare(`
      SELECT t.*, 
        s.telegram_username as sender_username,
        r.telegram_username as receiver_username
      FROM tips t
      JOIN users s ON t.sender_telegram_id = s.telegram_id
      JOIN users r ON t.receiver_telegram_id = r.telegram_id
      WHERE t.sender_telegram_id = ? OR t.receiver_telegram_id = ?
      ORDER BY t.created_at DESC
      LIMIT 10
    `);
    const tips = stmt.all(telegramId, telegramId);
    
    if (tips.length === 0) {
      await ctx.reply('📭 No tipping history yet. Send your first tip with /tip!');
      return;
    }
    
    let historyText = '📊 Your Recent Tips:\n\n';
    
    for (const tip of tips) {
      const isSender = tip.sender_telegram_id === telegramId;
      const amount = formatEther(BigInt(tip.amount));
      const emoji = isSender ? '⬅️' : '➡️';
      const user = isSender ? tip.receiver_username : tip.sender_username;
      const action = isSender ? 'Sent to' : 'Received from';
      
      historyText += `${emoji} ${action} @${user}\n`;
      historyText += `   ${amount} $WALT - "${tip.message}"\n`;
      historyText += `   ${new Date(tip.created_at).toLocaleDateString()}\n\n`;
    }
    
    await ctx.reply(historyText);
    
  } catch (error) {
    console.error('Error fetching history:', error);
    await ctx.reply('❌ Error fetching history. Please try again.');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `🤖 $WALT Tipping Bot - Commands\n\n` +
    `/start - Connect your wallet\n` +
    `/balance - Check your $WALT balance\n` +
    `/tip @user amount [message] - Send a tip\n` +
    `/history - View your tipping history\n` +
    `/help - Show this help message\n\n` +
    `💡 Tips are sent on Base mainnet using $WALT tokens.\n` +
    `🔗 Contract: <code>0x1E018...C0b1</code>`,
    { parse_mode: 'HTML' }
  );
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('❌ An error occurred. Please try again.');
});

// Start bot
console.log('🤖 Starting bot...');
bot.launch()
  .then(() => {
    console.log('✅ Bot started successfully!');
    console.log('Press Ctrl+C to stop');
  })
  .catch((err) => {
    console.error('❌ Failed to start bot:', err);
  });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
