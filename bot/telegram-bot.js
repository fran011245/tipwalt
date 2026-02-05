require('dotenv').config();
const { Telegraf } = require('telegraf');
const { createPublicClient, http, formatEther, parseEther } = require('viem');
const { base } = require('viem/chains');
const fs = require('fs');
const path = require('path');

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Simple JSON-based storage
const DATA_FILE = path.join(__dirname, '..', 'database', 'users.json');
const TIPS_FILE = path.join(__dirname, '..', 'database', 'tips.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load or initialize data
function loadData(file, defaultValue = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error(`Error loading ${file}:`, e);
  }
  return defaultValue;
}

function saveData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let users = loadData(DATA_FILE, {});
let tips = loadData(TIPS_FILE, []);
let tipIdCounter = tips.length > 0 ? Math.max(...tips.map(t => t.id)) + 1 : 1;

console.log('✅ JSON database initialized');
console.log(`   Users: ${Object.keys(users).length}`);
console.log(`   Tips: ${tips.length}`);

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
  }
];

const WALT_TOKEN_ADDRESS = process.env.WALT_TOKEN_ADDRESS || '0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://tipwalt.com';

// Bot commands

bot.command('start', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const username = ctx.from.username;
  
  if (!users[telegramId]) {
    users[telegramId] = {
      telegram_id: telegramId,
      telegram_username: username,
      wallet_address: null,
      permit2_approved: false,
      created_at: new Date().toISOString()
    };
    saveData(DATA_FILE, users);
    
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
    const user = users[telegramId];
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
});

// Handle wallet address input
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const telegramId = ctx.from.id.toString();
  
  // Check if it's a wallet address
  if (text.startsWith('0x') && text.length === 42) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
      await ctx.reply('❌ Invalid wallet address format. Please send a valid Base wallet address.');
      return;
    }
    
    if (!users[telegramId]) {
      users[telegramId] = {
        telegram_id: telegramId,
        telegram_username: ctx.from.username,
        wallet_address: null,
        permit2_approved: false,
        created_at: new Date().toISOString()
      };
    }
    
    users[telegramId].wallet_address = text.toLowerCase();
    saveData(DATA_FILE, users);
    
    await ctx.reply(
      `✅ Wallet connected: <code>${text.slice(0, 6)}...${text.slice(-4)}</code>\n\n` +
      `Next step: Approve Permit2 for gasless transfers.\n\n` +
      `Visit: https://walt.tip/approve?wallet=${text}\n\n` +
      `Once approved, you'll be able to send tips instantly!`,
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  if (!text.startsWith('/')) {
    await ctx.reply('💡 Send me a Base wallet address (0x...) to connect, or use /help for commands.');
  }
});

bot.command('balance', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const user = users[telegramId];
  
  if (!user || !user.wallet_address) {
    await ctx.reply('❌ Please connect your wallet first with /start');
    return;
  }
  
  try {
    const balance = await publicClient.readContract({
      address: WALT_TOKEN_ADDRESS,
      abi: WALT_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [user.wallet_address]
    });
    
    const formattedBalance = formatEther(balance);
    
    await ctx.reply(
      `💰 Your $WALT Balance\n\n` +
      `Wallet: <code>${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}</code>\n` +
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
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;
  
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
  
  const sender = users[telegramId];
  if (!sender || !sender.wallet_address) {
    await ctx.reply('❌ Please connect your wallet first with /start');
    return;
  }
  
  // Find recipient by username
  const recipient = Object.values(users).find(u => 
    u.telegram_username && u.telegram_username.toLowerCase() === recipientUsername.toLowerCase()
  );
  
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
  
  // Record tip
  const tip = {
    id: tipIdCounter++,
    sender_telegram_id: telegramId,
    receiver_telegram_id: recipient.telegram_id,
    amount: parseEther(amount.toString()).toString(),
    message: message,
    tx_hash: null,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  
  tips.push(tip);
  saveData(TIPS_FILE, tips);
  
  // Check for big tips and add FOMO reactions
  const BIG_TIP_THRESHOLD = 500;
  const WHALE_TIP_THRESHOLD = 2000;
  
  let reactionMessage = '';
  if (amount >= WHALE_TIP_THRESHOLD) {
    reactionMessage = `\n\n🐋 WHALE ALERT! @${ctx.from.username} just dropped ${amount} $WALT! 🔥🔥🔥`;
  } else if (amount >= BIG_TIP_THRESHOLD) {
    reactionMessage = `\n\n💥 BOOM! @${ctx.from.username} tipped ${amount} $WALT! That's how you do it! 🚀`;
  }
  
  await ctx.reply(
    `💸 Tip initiated!\n\n` +
    `To: @${recipientUsername}\n` +
    `Amount: ${amount} $WALT\n` +
    `Message: "${message}"\n\n` +
    `👉 [Click here to complete the transfer](${WEBAPP_URL}/send?tipId=${tip.id})\n\n` +
    `_You will sign the transaction with your wallet_`,
    { parse_mode: 'Markdown' }
  );
  
  // Also send public reaction message to chat for big tips
  if (amount >= BIG_TIP_THRESHOLD && ctx.chat.type !== 'private') {
    const publicReaction = amount >= WHALE_TIP_THRESHOLD
      ? `🐋 WHALE MODE ACTIVATED!\n\n@${ctx.from.username} just sent ${amount} $WALT to @${recipientUsername}!\n\n"${message}"\n\nWho's next? 👀`
      : `💥 Big tip energy!\n\n@${ctx.from.username} sent ${amount} $WALT to @${recipientUsername}!\n\n"${message}"\n\nShow some love! 🚀`;
    
    await ctx.reply(publicReaction);
  }
  
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
});

bot.command('history', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  
  const userTips = tips.filter(t => 
    t.sender_telegram_id === telegramId || t.receiver_telegram_id === telegramId
  ).slice(-10).reverse();
  
  if (userTips.length === 0) {
    await ctx.reply('📭 No tipping history yet. Send your first tip with /tip!');
    return;
  }
  
  let historyText = '📊 Your Recent Tips:\n\n';
  
  for (const tip of userTips) {
    const isSender = tip.sender_telegram_id === telegramId;
    const amount = formatEther(BigInt(tip.amount));
    const otherUserId = isSender ? tip.receiver_telegram_id : tip.sender_telegram_id;
    const otherUser = users[otherUserId];
    const otherUsername = otherUser ? otherUser.telegram_username : 'Unknown';
    const emoji = isSender ? '⬅️' : '➡️';
    const action = isSender ? 'Sent to' : 'Received from';
    
    historyText += `${emoji} ${action} @${otherUsername}\n`;
    historyText += `   ${amount} $WALT - "${tip.message}"\n`;
    historyText += `   ${new Date(tip.created_at).toLocaleDateString()}\n\n`;
  }
  
  await ctx.reply(historyText);
});

bot.command('leaderboard', async (ctx) => {
  const period = ctx.message.text.split(' ')[1] || 'weekly';
  const now = new Date();
  const daysBack = period === 'monthly' ? 30 : 7;
  const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  const periodTips = tips.filter(t => 
    t.status === 'completed' && new Date(t.created_at) >= cutoffDate
  );
  
  if (periodTips.length === 0) {
    await ctx.reply(
      `🏆 ${period === 'monthly' ? 'Monthly' : 'Weekly'} Leaderboard\n\n` +
      `No tips yet this ${period === 'monthly' ? 'month' : 'week'}.\n` +
      `Be the first to tip with /tip!`
    );
    return;
  }
  
  // Calculate top tippers (sent)
  const senderStats = {};
  const receiverStats = {};
  
  for (const tip of periodTips) {
    const amount = parseFloat(formatEther(BigInt(tip.amount)));
    
    // Sender stats
    if (!senderStats[tip.sender_telegram_id]) {
      senderStats[tip.sender_telegram_id] = { total: 0, count: 0 };
    }
    senderStats[tip.sender_telegram_id].total += amount;
    senderStats[tip.sender_telegram_id].count += 1;
    
    // Receiver stats
    if (!receiverStats[tip.receiver_telegram_id]) {
      receiverStats[tip.receiver_telegram_id] = { total: 0, count: 0 };
    }
    receiverStats[tip.receiver_telegram_id].total += amount;
    receiverStats[tip.receiver_telegram_id].count += 1;
  }
  
  // Sort and get top 5
  const topSenders = Object.entries(senderStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);
  
  const topReceivers = Object.entries(receiverStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);
  
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const periodLabel = period === 'monthly' ? 'This Month' : 'This Week';
  
  let leaderboardText = `🏆 $WALT Leaderboard - ${periodLabel}\n\n`;
  
  // Top Tippers
  leaderboardText += `💸 Top Tippers (Most Generous)\n`;
  topSenders.forEach(([userId, stats], index) => {
    const user = users[userId];
    const username = user ? user.telegram_username : 'Unknown';
    leaderboardText += `${medals[index]} @${username}: ${stats.total.toFixed(2)} $WALT (${stats.count} tips)\n`;
  });
  
  leaderboardText += `\n`;
  
  // Top Tipped
  leaderboardText += `👑 Top Tipped (Most Loved)\n`;
  topReceivers.forEach(([userId, stats], index) => {
    const user = users[userId];
    const username = user ? user.telegram_username : 'Unknown';
    leaderboardText += `${medals[index]} @${username}: ${stats.total.toFixed(2)} $WALT (${stats.count} tips)\n`;
  });
  
  leaderboardText += `\n💡 Use /leaderboard monthly for monthly stats`;
  
  await ctx.reply(leaderboardText);
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `🤖 $WALT Tipping Bot - Commands\n\n` +
    `/start - Connect your wallet\n` +
    `/balance - Check your $WALT balance\n` +
    `/tip @user amount [message] - Send a tip\n` +
    `/history - View your tipping history\n` +
    `/leaderboard [weekly/monthly] - Top tippers & tipped\n` +
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
