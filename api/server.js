const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
const { createWalletClient, http, parseEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Telegram bot for notifications
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Data files
const DATA_FILE = path.join(__dirname, '..', 'database', 'users.json');
const TIPS_FILE = path.join(__dirname, '..', 'database', 'tips.json');
const FAUCET_FILE = path.join(__dirname, '..', 'database', 'faucet.json');

// Faucet config
const FAUCET_AMOUNT = '1000'; // 1000 WALT
const FAUCET_AMOUNT_WEI = parseEther(FAUCET_AMOUNT).toString();

// Load data
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

// Initialize faucet tracking
let faucetClaims = loadData(FAUCET_FILE, { claims: [], total_claimed: '0' });

// WALT Token ABI (minimal for transfer)
const WALT_TOKEN_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  }
];

const WALT_TOKEN_ADDRESS = process.env.WALT_TOKEN_ADDRESS || '0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1';

// Initialize wallet client for faucet (if private key provided)
let faucetWallet = null;
if (process.env.FAUCET_PRIVATE_KEY) {
  const account = privateKeyToAccount(process.env.FAUCET_PRIVATE_KEY);
  faucetWallet = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  });
  console.log(`💰 Faucet wallet initialized: ${account.address}`);
}

// GET /faucet/status/:address - Check if wallet can claim
app.get('/faucet/status/:address', (req, res) => {
  const { address } = req.params;
  
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return res.status(400).json({ error: 'Invalid address' });
  }
  
  const normalizedAddress = address.toLowerCase();
  
  // Check if already claimed
  const hasClaimed = faucetClaims.claims.some(
    claim => claim.address.toLowerCase() === normalizedAddress
  );
  
  const totalClaimed = faucetClaims.total_claimed;
  const claimCount = faucetClaims.claims.length;
  
  res.json({
    address: normalizedAddress,
    can_claim: !hasClaimed && !!faucetWallet,
    has_claimed: hasClaimed,
    amount: FAUCET_AMOUNT,
    total_claimed: totalClaimed,
    total_claims: claimCount,
    faucet_enabled: !!faucetWallet
  });
});

// POST /faucet/claim - Claim faucet tokens
app.post('/faucet/claim', async (req, res) => {
  const { address } = req.body;
  
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return res.status(400).json({ error: 'Invalid address' });
  }
  
  if (!faucetWallet) {
    return res.status(503).json({ error: 'Faucet not configured' });
  }
  
  const normalizedAddress = address.toLowerCase();
  
  // Check if already claimed
  const hasClaimed = faucetClaims.claims.some(
    claim => claim.address.toLowerCase() === normalizedAddress
  );
  
  if (hasClaimed) {
    return res.status(400).json({ 
      error: 'Address already claimed',
      claimed_at: faucetClaims.claims.find(
        c => c.address.toLowerCase() === normalizedAddress
      )?.claimed_at
    });
  }
  
  try {
    // Send tokens from faucet wallet
    const txHash = await faucetWallet.writeContract({
      address: WALT_TOKEN_ADDRESS,
      abi: WALT_TOKEN_ABI,
      functionName: 'transfer',
      args: [normalizedAddress, FAUCET_AMOUNT_WEI]
    });
    
    // Record the claim
    const claim = {
      address: normalizedAddress,
      amount: FAUCET_AMOUNT,
      amount_wei: FAUCET_AMOUNT_WEI,
      tx_hash: txHash,
      claimed_at: new Date().toISOString()
    };
    
    faucetClaims.claims.push(claim);
    faucetClaims.total_claimed = (BigInt(faucetClaims.total_claimed) + BigInt(FAUCET_AMOUNT_WEI)).toString();
    saveData(FAUCET_FILE, faucetClaims);
    
    console.log(`💰 Faucet claim: ${normalizedAddress} received ${FAUCET_AMOUNT} WALT`);
    console.log(`   TX: ${txHash}`);
    
    res.json({
      success: true,
      address: normalizedAddress,
      amount: FAUCET_AMOUNT,
      tx_hash: txHash,
      message: `Successfully claimed ${FAUCET_AMOUNT} WALT!`
    });
    
  } catch (error) {
    console.error('Faucet claim failed:', error);
    res.status(500).json({ 
      error: 'Faucet claim failed', 
      details: error.message 
    });
  }
});

// GET /tip/:tipId - Get tip details for webapp
app.get('/tip/:tipId', (req, res) => {
  const tips = loadData(TIPS_FILE, []);
  const users = loadData(DATA_FILE, {});
  
  const tip = tips.find(t => t.id === parseInt(req.params.tipId));
  
  if (!tip) {
    return res.status(404).json({ error: 'Tip not found' });
  }
  
  const sender = users[tip.sender_telegram_id];
  const receiver = users[tip.receiver_telegram_id];
  
  if (!sender || !receiver) {
    return res.status(404).json({ error: 'Sender or receiver not found' });
  }
  
  // Convert wei to human readable
  const amountHuman = (BigInt(tip.amount) / BigInt(10**18)).toString();
  
  res.json({
    id: tip.id,
    sender_wallet: sender.wallet_address,
    receiver_wallet: receiver.wallet_address,
    amount: tip.amount,
    amount_human: amountHuman,
    token_address: WALT_TOKEN_ADDRESS,
    message: tip.message,
    status: tip.status,
    expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour expiry
  });
});

// POST /webhook/complete - Webapp notifies tip completion
app.post('/webhook/complete', async (req, res) => {
  const { tipId, txHash } = req.body;
  
  if (!tipId || !txHash) {
    return res.status(400).json({ error: 'Missing tipId or txHash' });
  }
  
  const tips = loadData(TIPS_FILE, []);
  const users = loadData(DATA_FILE, {});
  
  const tipIndex = tips.findIndex(t => t.id === parseInt(tipId));
  
  if (tipIndex === -1) {
    return res.status(404).json({ error: 'Tip not found' });
  }
  
  const tip = tips[tipIndex];
  
  // Update tip status
  tip.status = 'completed';
  tip.tx_hash = txHash;
  tip.completed_at = new Date().toISOString();
  
  saveData(TIPS_FILE, tips);
  
  console.log(`✅ Tip ${tipId} completed with tx: ${txHash}`);
  
  // Notify receiver on Telegram
  const receiver = users[tip.receiver_telegram_id];
  const sender = users[tip.sender_telegram_id];
  
  if (receiver && receiver.telegram_id) {
    try {
      const amountHuman = (BigInt(tip.amount) / BigInt(10**18)).toString();
      const senderUsername = sender ? sender.telegram_username : 'Someone';
      
      await bot.telegram.sendMessage(
        receiver.telegram_id,
        `🎉 Tip received!\n\n` +
        `From: @${senderUsername}\n` +
        `Amount: ${amountHuman} $WALT\n` +
        `Message: "${tip.message}"\n\n` +
        `✅ Confirmed on-chain\n` +
        `🔗 [View on Basescan](https://basescan.org/tx/${txHash})`,
        { parse_mode: 'Markdown' }
      );
      console.log(`📬 Notified receiver ${receiver.telegram_id}`);
    } catch (err) {
      console.error('Failed to notify receiver:', err.message);
    }
  }
  
  res.json({
    success: true,
    message: 'Tip marked as completed',
    tipId: tipId,
    txHash: txHash
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'walt-tipping-api',
    faucet_enabled: !!faucetWallet,
    faucet_claims: faucetClaims.claims.length
  });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   - GET  /faucet/status/:address`);
  console.log(`   - POST /faucet/claim`);
  console.log(`   - GET  /tip/:tipId`);
  console.log(`   - POST /webhook/complete`);
  console.log(`   - GET  /health`);
});

module.exports = app;
