# $WALT Tipping Webapp - Prompt para Lovable
## tipwalt.com

---

## ✅ Backend Listo (API Deployada)

**Base URL:** `https://api.tipwalt.com` (o el dominio que uses)

**Endpoints disponibles:**

### Faucet (Gratis para nuevos usuarios)
- `GET /faucet/status/:address` - Verifica si puede reclamar
- `POST /faucet/claim` - Reclama 1,000 WALT

### Tips (Completar propinas)
- `GET /tip/:tipId` - Obtiene datos de propina pendiente
- `POST /webhook/complete` - Notifica cuando se completa

### Health
- `GET /health` - Status check

---

## 🎯 Descripción

Webapp Next.js con dos funcionalidades:

1. **Faucet**: Usuario nuevo conecta wallet → Recibe 1,000 WALT gratis
2. **Tipping**: Usuario completa propina iniciada en Telegram

---

## 🛠 Stack

- Next.js 14+ (App Router)
- RainbowKit + wagmi + viem (GRATIS, sin WalletConnect)
- Tailwind CSS
- Base Mainnet

---

## 🎨 Diseño

### Modo Agents (default)
```
Fondo: bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900
Cards: bg-slate-800/50 border-slate-700/50
Texto: text-white / text-slate-400
Acentos: purple-500, cyan-400
Efectos: glow sutil, glassmorphism
```

### Modo Humans (toggle)
```
Fondo: bg-gray-50
Cards: bg-white shadow-lg
Texto: text-gray-900 / text-gray-600
Bordes: rounded-xl
```

**Toggle:** Switch 🤖/👤 en header, persiste en localStorage

---

## 📄 Páginas

### 1. `/` - Landing + Faucet (Principal)

**Flujo:**

#### Conectar Wallet
- Botón grande "Connect Wallet"
- Frase: "Join the $WALT tipping economy"

#### Detectar nuevo usuario
```typescript
const res = await fetch(`https://api.tipwalt.com/faucet/status/${address}`)
const data = await res.json()
// { can_claim: true/false, amount: "1000" }
```

#### Si PUEDE reclamar (nuevo)
Card especial:
- 🎉 "Welcome to $WALT!"
- "Claim your FREE 1,000 WALT to start tipping"
- Botón brillante: "Claim 1,000 WALT"
- "One-time claim per wallet. Gas fees covered."

**On click:**
```typescript
const res = await fetch('https://api.tipwalt.com/faucet/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address })
})
const result = await res.json()
// { success: true, amount: "1000", tx_hash: "0x..." }

router.push(`/success?type=faucet&amount=1000&txHash=${result.tx_hash}`)
```

#### Si YA reclamó
- "Welcome back!"
- Balance WALT (leer con wagmi)
- Botón "Send Tip" → `https://t.me/walt_tip_bot`

---

### 2. `/send?tipId=xxx` - Completar Propina

**Cargar datos:**
```typescript
const res = await fetch(`https://api.tipwalt.com/tip/${tipId}`)
const tip = await res.json()
// { sender_wallet, receiver_wallet, amount, amount_human, message }
```

**UI:**
- "You're sending"
- Amount grande: "100 $WALT"
- "To: 0x5678...abcd"
- Message: "Thanks!"
- Botón "Confirm Transfer"

**Validar wallet:**
```typescript
const { address } = useAccount()
if (address?.toLowerCase() !== tip.sender_wallet.toLowerCase()) {
  // Error: "Connect with the wallet that initiated this tip"
}
```

**Transferir:**
```typescript
const WALT_ABI = [{
  name: 'transferFrom',
  type: 'function',
  inputs: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ]
}]

const { writeContract, data: hash } = useWriteContract()

writeContract({
  address: tip.token_address,
  abi: WALT_ABI,
  functionName: 'transferFrom',
  args: [tip.sender_wallet, tip.receiver_wallet, BigInt(tip.amount)]
})

// Esperar confirmación
const { isSuccess } = useWaitForTransactionReceipt({ hash })

useEffect(() => {
  if (isSuccess && hash) {
    fetch('https://api.tipwalt.com/webhook/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipId: tip.id, txHash: hash })
    })
    router.push(`/success?type=tip&amount=${tip.amount_human}&txHash=${hash}`)
  }
}, [isSuccess, hash])
```

---

### 3. `/success` - Confirmación

**Query params:** `type`, `amount`, `txHash`

**type=faucet:**
- 🎉 "Welcome to $WALT!"
- "You received 1,000 WALT"
- Link a Basescan
- Botón "Start Tipping" → Telegram

**type=tip:**
- ✅ "Tip Sent!"
- "You sent 100 $WALT"
- Link a Basescan
- Botón "Back to Telegram"
- Confetti animation

---

## ⚙️ Configuración

### .env.local
```bash
NEXT_PUBLIC_API_URL=https://api.tipwalt.com
NEXT_PUBLIC_WALT_TOKEN=0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1
```

### RainbowKit (SIN WalletConnect - GRATIS)
```typescript
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base } from 'wagmi/chains'

const config = getDefaultConfig({
  appName: '$WALT Tipping',
  // Sin projectId = gratuito
  // Funciona con MetaMask, Coinbase, Rainbow, etc.
  chains: [base],
  ssr: true
})
```

### Token
- **$WALT:** `0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1`
- **Chain:** Base Mainnet
- **Decimals:** 18

---

## ✅ Checklist Features

### Core
- [ ] RainbowKit sin Project ID (gratis)
- [ ] Landing `/` con faucet
- [ ] Página `/send` para tips
- [ ] Página `/success` con confetti

### Faucet
- [ ] GET /faucet/status/:address
- [ ] POST /faucet/claim
- [ ] UI "Claim 1,000 WALT"

### Tipping
- [ ] GET /tip/:tipId
- [ ] Validar wallet = sender
- [ ] transferFrom on-chain
- [ ] POST /webhook/complete

### UI/UX
- [ ] Modo Agents (dark)
- [ ] Modo Humans (light)
- [ ] Toggle 🤖/👤
- [ ] Loading states
- [ ] Error states
- [ ] Responsive

---

## 🚀 Deploy Checklist

1. **Webapp** → Vercel con dominio `tipwalt.com`
2. **Backend** → Ya está deployado en `api.tipwalt.com`
3. **Probar flujo:**
   - Landing → Claim faucet → Success
   - Telegram /tip → Link → /send → Confirm → Success

---

## 💡 Notas

- **Faucet es el hook:** "Free 1,000 WALT" atrae usuarios nuevos
- **Mobile:** Funciona en browser de MetaMask app
- **Sin gas:** El faucet cubre el primer claim, después el usuario paga gas en tips

---

**Backend:** Deployado y listo ✅  
**Frontend:** A construir en Lovable 🚀  
**Dominio:** tipwalt.com
