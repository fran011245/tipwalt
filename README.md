# 🤖 $WALT Telegram Tipping Bot

**Status:** MVP Ready for Testing  
**Phase:** 1 of 4 (Foundation)

---

## 🚀 Quick Start (5 minutes)

### 1. Get Bot Token
- Message [@BotFather](https://t.me/BotFather) on Telegram
- Create new bot: `/newbot`
- Name it: `Walt Tip Bot` (or your choice)
- Username: `walt_tip_bot` (must end in bot)
- **Copy the token** (starts with numbers:letters)

### 2. Setup Environment
```bash
cd /home/walt/.openclaw/workspace/projects/walt-tipping-system
cp .env.example .env
# Edit .env and paste your TELEGRAM_BOT_TOKEN
```

### 3. Install & Run
```bash
npm install
npm start
```

Bot will start and print: `🤖 Bot started successfully!`

---

## 📝 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Connect wallet, show welcome |
| `/balance` | Check $WALT balance |
| `/tip @user amount [message]` | Send tip to user |
| `/history` | View tipping history |
| `/help` | Show all commands |

---

## 💡 Example Usage

**User connects wallet:**
```
User: /start
Bot: Welcome! Send your Base wallet address...

User: 0xeAB029db5f9Bd8f233204c816d67709f0147918D
Bot: ✅ Wallet connected! Approve Permit2 to continue...
```

**Sending a tip:**
```
User: /tip @crypto_friend 100 Thanks for the alpha!
Bot: 💸 Tip initiated!
     To: @crypto_friend
     Amount: 100 $WALT
     Complete: [Send $WALT link]
```

---

## 🛠️ Architecture

```
User (Telegram)
    ↓
Telegraf Bot (Node.js)
    ↓
PostgreSQL (Users, Tips, History)
    ↓
Base Blockchain (viem)
    ↓
$WALT Token Contract
```

---

## 📁 File Structure

```
walt-tipping-system/
├── bot/
│   └── telegram-bot.js      # Main bot code
├── database/
│   └── schema.sql           # DB schema (optional)
├── webapp/                  # Coming in Phase 2
├── scripts/
│   └── setup.sh             # Quick setup
├── .env.example             # Environment template
├── package.json
└── README.md
```

---

## 🎯 Phase 1 Goals (This Week)

- [x] Bot commands working
- [x] Wallet connection
- [x] Balance checking
- [x] Tip initiation
- [ ] Permit2 integration (gasless)
- [ ] Webapp for completing transfers
- [ ] Test on mainnet

---

## 🔄 Next Phases

| Phase | Platform | Deliverable |
|-------|----------|-------------|
| 2 | Moltbook + Webapp | Multi-platform tipping |
| 3 | Burn System | Redemption tiers |
| 4 | X Integration + Polish | Production launch |

---

## 🐛 Troubleshooting

**Bot not responding?**
- Check TELEGRAM_BOT_TOKEN is correct
- Ensure you're messaging the right bot username
- Check console for errors

**Database errors?**
- Make sure PostgreSQL is running
- Verify DATABASE_URL in .env

**Balance shows 0?**
- Check wallet has $WALT tokens
- Verify WALT_TOKEN_ADDRESS is correct

---

Built with ❤️ by Walt for ClawdKitchen
