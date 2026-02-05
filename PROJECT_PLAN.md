# $WALT Social Tipping System
## Project Plan & Technical Specification

**Version:** 1.0  
**Date:** 2026-02-04  
**Status:** Design Phase  
**Hackathon:** ClawdKitchen (Base)

---

## Executive Summary

A multi-platform social tipping system that allows users to send $WALT tokens as "tips" or "thanks" for valuable content, help, or entertainment across Telegram, Moltbook, and X (Twitter). Tips accumulate in user balances and can be redeemed through a burn mechanism for rewards, creating natural token scarcity.

**Core Value Proposition:**  
Transform social appreciation into tangible economic value while driving token utility and volume.

---

## 1. Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   TELEGRAM      │     │   MOLTBOOK      │     │       X         │
│   (Primary)     │     │   (Secondary)   │     │   (Bridge)      │
│                 │     │                 │     │                 │
│ /tip @user 100  │     │ @walt_tip in    │     │ Link to webapp  │
│                 │     │ comments        │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      TIP PROCESSOR        │
                    │  (Node.js/Python backend) │
                    │                           │
                    │ • Validate signatures     │
                    │ • Execute transfers       │
                    │ • Log to database         │
                    └─────────────┬─────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
┌────────▼────────┐    ┌──────────▼──────────┐   ┌───────▼────────┐
│  BASE BLOCKCHAIN│    │   REDEMPTION ENGINE │   │  ANALYTICS     │
│                 │    │                     │   │                │
│ • $WALT Token   │    │ • Burn mechanism    │   │ • Leaderboard  │
│ • Permit2       │    │ • Reward tiers      │   │ • User stats   │
│ • Transfers     │    │ • Milestone tracking│   │ • Volume data  │
└─────────────────┘    └─────────────────────┘   └────────────────┘
```

---

## 2. Platform Specifications

### 2.1 Telegram Bot (@walt_tip_bot)

**Commands:**
```
/start - Connect wallet, setup profile
/tip @username AMOUNT [message] - Send tip
/balance - Check accumulated tips
/history - Recent tipping activity
/redeem - Access redemption options
/leaderboard - Top tippers & receivers
```

**User Flow:**
1. User connects wallet via bot (one-time Permit2 approval)
2. User types: `/tip @crypto_friend 100 WALT "for the alpha!"`
3. Bot validates sender has balance
4. Bot executes `transferFrom` via Permit2 (gasless for sender)
5. Bot posts confirmation in chat + DM to receiver
6. Receiver accumulates tips in their balance

**Technical Requirements:**
- Telegram Bot API integration
- Wallet connection via QR/deep-link
- Permit2 signature collection
- Real-time balance tracking

---

### 2.2 Moltbook Integration

**Interaction Model:**
Users mention Walt in comments to trigger tips:
```
Post: "Great analysis on Base ecosystem!"
Comment: "@walt_tip 500 WALT to @author for this deep dive"
```

**Implementation:**
- Poll Moltbook API every 30s for mentions
- Parse tip commands in comment text
- Verify sender has sufficient balance
- Execute transfer on-chain
- Post confirmation reply

**Technical Requirements:**
- Moltbook API integration
- Webhook or polling mechanism
- Comment parsing logic
- Rate limiting (prevent spam)

---

### 2.3 X (Twitter) Bridge

**Limitation:** No direct on-chain transfers from X

**Solution:** Smart redirection
```
Tweet: "This is the best thread I've read all week!"
Walt replies: 
"💰 Want to tip @author? → https://walt.tip/send?to=0x...&amount=100
Connect your wallet and send $WALT instantly!"
```

**Technical Requirements:**
- Twitter API for monitoring mentions
- Pre-populated transaction URLs
- Webapp landing page
- Auto-fill recipient address

---

## 3. Redemption & Burn System

### 3.1 Accumulation Thresholds

| Tier | WALT Required | Reward |
|------|---------------|--------|
| Bronze | 500 WALT | Entry to weekly raffle (0.01 ETH) |
| Silver | 1,000 WALT | Burn for exclusive NFT badge |
| Gold | 5,000 WALT | Priority access to Walt features |
| Platinum | 10,000 WALT | Monthly governance vote weight |

### 3.2 Burn Mechanics

**Visual Target:** "Road to 50% Burn"
- Initial Supply: 1,000,000,000 WALT
- Target Burned: 500,000,000 WALT (50%)
- Current Status: Live tracker on webapp
- Milestone Rewards: Special unlocks at 10%, 25%, 50%

**Burn Function:**
- Users call `burn(amount)` on token contract
- Irreversible removal from circulation
- On-chain proof for rewards
- Leaderboard of "Burn Champions"

---

## 4. Technical Stack

### Backend
- **Runtime:** Node.js 20+ or Python 3.11+
- **Database:** PostgreSQL (user balances, history)
- **Cache:** Redis (rate limiting, sessions)
- **Blockchain:** viem/ethers.js for Base interactions

### Smart Contract Interactions
```typescript
// Core functions needed
- permit2.approve(token, spender, amount, deadline, signature)
- waltToken.transferFrom(sender, recipient, amount)
- waltToken.burn(amount)
- waltToken.balanceOf(address)
- waltToken.getVotes(address) // for governance tier
```

### Frontend (Webapp)
- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Wallet:** RainbowKit + wagmi
- **Charts:** Recharts (burn progress, volume)

### Infrastructure
- **Hosting:** Vercel (frontend), Railway/Render (backend)
- **Monitoring:** Uptime monitoring for bots
- **Logs:** Structured logging for debugging

---

## 5. Implementation Phases

### Phase 1: Foundation (Days 1-2)
**Goal:** Core infrastructure + Telegram MVP

**Tasks:**
- [ ] Setup project repo and CI/CD
- [ ] Deploy PostgreSQL database schema
- [ ] Create Telegram bot (@walt_tip_bot)
- [ ] Implement wallet connection flow
- [ ] Build Permit2 approval mechanism
- [ ] Test basic tip transfer on Base testnet
- [ ] Deploy to mainnet

**Deliverable:** Working Telegram bot for tipping

---

### Phase 2: Expansion (Days 3-4)
**Goal:** Moltbook + Webapp dashboard

**Tasks:**
- [ ] Integrate Moltbook API
- [ ] Build comment parser for tip commands
- [ ] Create webapp (Next.js)
- [ ] User dashboard (balance, history)
- [ ] Leaderboard (top tippers/receivers)
- [ ] Real-time transaction feed

**Deliverable:** Multi-platform tipping + dashboard

---

### Phase 3: Redemption (Days 5-6)
**Goal:** Burn mechanism + rewards

**Tasks:**
- [ ] Redemption tier system
- [ ] Weekly raffle smart contract
- [ ] NFT badge minting contract
- [ ] Burn progress tracker UI
- [ ] Milestone celebration system
- [ ] User notification system

**Deliverable:** Complete economic loop

---

### Phase 4: Polish (Day 7)
**Goal:** X integration + hackathon submission

**Tasks:**
- [ ] X mention monitoring
- [ ] Pre-populated transaction links
- [ ] Final UI polish
- [ ] Documentation
- [ ] Demo video
- [ ] ClawdKitchen submission

**Deliverable:** Production-ready product

---

## 6. Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  telegram_id BIGINT UNIQUE,
  moltbook_id VARCHAR UNIQUE,
  twitter_handle VARCHAR UNIQUE,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tips
CREATE TABLE tips (
  id UUID PRIMARY KEY,
  sender_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  platform VARCHAR(20), -- 'telegram', 'moltbook', 'x'
  amount DECIMAL(20, 0), -- Token amount (wei)
  message TEXT,
  tx_hash VARCHAR(66),
  status VARCHAR(20), -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Redemptions
CREATE TABLE redemptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  tier VARCHAR(20), -- 'bronze', 'silver', 'gold', 'platinum'
  amount_burned DECIMAL(20, 0),
  reward_type VARCHAR(50),
  reward_tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Leaderboard (materialized view)
CREATE MATERIALIZED VIEW leaderboard AS
SELECT 
  wallet_address,
  SUM(CASE WHEN sender_id = id THEN amount ELSE 0 END) as total_sent,
  SUM(CASE WHEN receiver_id = id THEN amount ELSE 0 END) as total_received,
  COUNT(*) as total_tips
FROM users
LEFT JOIN tips ON users.id = tips.sender_id OR users.id = tips.receiver_id
GROUP BY wallet_address;
```

---

## 7. User Stories

### Story 1: The Helpful Expert
> Alice answers Bob's technical question in the Base dev group. Bob sends `/tip @alice 200 WALT "thanks for the debug help!"`. Alice accumulates tips and burns 1000 WALT for a governance NFT.

### Story 2: The Viral Meme
> Charlie posts a meme that gets 50 tips from the community. The meme reaches 10,000 WALT in tips. Charlie burns 5000 for a "Meme Lord" badge and keeps 5000.

### Story 3: The DAO Contributor
> David writes a proposal for Walt's treasury. The community tips him 2000 WALT. He burns it for voting power in the next governance decision.

---

## 8. Success Metrics

| Metric | Target (30 days) |
|--------|------------------|
| Daily Active Tippers | 50+ |
| Total Transaction Volume | 1,000,000+ WALT |
| Unique Wallets | 200+ |
| Tokens Burned | 50,000+ WALT |
| Avg Tip Size | 100 WALT |
| Platform Distribution | 60% TG, 30% Moltbook, 10% X |

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Rate limiting on APIs | Exponential backoff, queue system |
| Failed transactions | Retry logic + user notification |
| Spam attacks | Minimum tip amount (10 WALT), cooldown periods |
| Smart contract bugs | Use Permit2 (battle-tested), audit if time permits |
| Low adoption | Start with core community, incentivize early adopters |

---

## 10. Future Roadmap

**Post-Hackathon:**
- Discord integration
- Custom tip amounts with slash commands
- Tip streams (recurring tips to creators)
- Integration with other Base tokens
- Mobile app for wallet management
- Cross-chain tips (via SuperchainERC20)

---

## Appendix A: API Endpoints

```
POST /api/tip/telegram
  body: { sender_wallet, recipient_username, amount, message }
  
POST /api/tip/moltbook
  body: { sender_wallet, post_id, comment_id, amount }
  
POST /api/redeem
  body: { wallet_address, tier, signature }
  
GET /api/balance/:wallet
GET /api/leaderboard
GET /api/history/:wallet
GET /api/burn-progress
```

## Appendix B: Environment Variables

```env
# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Blockchain
BASE_RPC_URL=https://mainnet.base.org
WALT_TOKEN_ADDRESS=0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1
PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43aC78BA3

# Telegram
TELEGRAM_BOT_TOKEN=...

# Moltbook
MOLTBOOK_API_KEY=...

# Twitter
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...

# Server
PORT=3000
JWT_SECRET=...
```

---

**Document Status:** Ready for implementation  
**Next Step:** Begin Phase 1 - Telegram Bot Development
