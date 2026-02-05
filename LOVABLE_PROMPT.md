# Prompt para Lovable.dev
## $WALT Tipping Webapp + Faucet

---

## 🎯 Descripción del Proyecto

Webapp Next.js con DOS funcionalidades:

### 1. Tipping (Completar Propinas)
Usuario recibe link del bot de Telegram → Conecta wallet → Firma transferencia → Listo

### 2. Faucet (Gratis para nuevos usuarios)
Usuario nuevo conecta wallet → Recibe 1,000 WALT gratis → Ya puede empezar a tippear

---

## 🛠 Stack Tecnológico

- **Framework:** Next.js 14+ (App Router)
- **Wallet:** RainbowKit + wagmi + viem
- **Styling:** Tailwind CSS
- **Chain:** Base Mainnet
- **Token:** $WALT (ERC20)

---

## 🎨 Diseño UI/UX

### Estilo General (inspirado en losviajesdewalt.com)

**Modo Agents (default):**
- Fondo: gradiente oscuro `bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900`
- Cards: fondo `bg-slate-800/50` con border `border-slate-700/50`
- Texto primario: `text-white`
- Texto secundario: `text-slate-400`
- Acentos: púrpura (`purple-500`) y cyan (`cyan-400`)
- Efectos: glow sutil, glassmorphism

**Modo Humans (toggle):**
- Fondo: `bg-gray-50` o `bg-white`
- Cards: `bg-white` con sombras suaves
- Texto: `text-gray-900` / `text-gray-600`
- Bordes redondeados, diseño limpio

**Toggle Agents/Humans:**
- Switch en header derecho: 🤖 / 👤
- Persistir en localStorage

---

## 📄 Páginas Requeridas

### 1. `/` - Landing + Faucet (PRINCIPAL)

**Flujo:**

#### Paso 1: Conectar Wallet
- Botón grande "Connect Wallet" (RainbowKit)
- Frase: "Join the $WALT tipping economy"

#### Paso 2: Detectar si es nuevo usuario
```typescript
// Al conectar wallet, llamar:
const response = await fetch(`https://api.walt.tip/faucet/status/${address}`)
const data = await response.json()

// Response:
{
  address: "0x1234...",
  can_claim: true,  // o false si ya reclamó
  has_claimed: false,
  amount: "1000",
  faucet_enabled: true
}
```

#### Paso 3a: Si PUEDE reclamar (nuevo usuario)
Mostrar card especial:
- 🎉 "Welcome to $WALT!"
- "Claim your FREE 1,000 WALT to start tipping"
- Botón brillante: "Claim 1,000 WALT"
- Texto chico: "One-time claim per wallet. Gas fees covered by us."

**Al hacer click:**
```typescript
const claim = async () => {
  const response = await fetch('https://api.walt.tip/faucet/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: connectedAddress })
  })
  
  const result = await response.json()
  // { success: true, amount: "1000", tx_hash: "0x..." }
  
  // Redirigir a success con confetti
  router.push(`/success?type=faucet&amount=1000&txHash=${result.tx_hash}`)
}
```

#### Paso 3b: Si YA RECLAMÓ (usuario existente)
Mostrar:
- "Welcome back!"
- Balance actual de WALT (usar wagmi para leer el token)
- Botón "Send Tip" → abre Telegram bot
- Stats: "You've sent X tips" (si tenemos esa data)

---

### 2. `/send` - Completar Propina (desde Telegram)

**Query Params:**
- `tipId` (required) - ID de la propina

**Flujo:**

#### Paso 1: Cargar datos
```typescript
const response = await fetch(`https://api.walt.tip/tip/${tipId}`)
const tip = await response.json()

// Response:
{
  id: 123,
  sender_wallet: "0x1234...",
  receiver_wallet: "0x5678...",
  amount: "100000000000000000000", // wei
  amount_human: "100",
  token_address: "0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1",
  message: "Thanks for the help!",
  status: "pending"
}
```

#### Paso 2: UI de Confirmación
Card mostrando:
- "You're sending"
- **Amount grande:** "100 $WALT"
- "To: 0x5678...abcd" (truncado)
- Mensaje: "Thanks for the help!"
- Botón "Confirm Transfer"

#### Paso 3: Validar wallet
```typescript
const { address } = useAccount()

if (address?.toLowerCase() !== tip.sender_wallet.toLowerCase()) {
  // Error: "Please connect with the wallet that initiated this tip"
}
```

#### Paso 4: Ejecutar transferencia
```typescript
const WALT_TOKEN_ABI = [
  {
    name: 'transferFrom',
    type: 'function',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  }
]

const { writeContract, data: hash } = useWriteContract()

const handleTransfer = () => {
  writeContract({
    address: tip.token_address,
    abi: WALT_TOKEN_ABI,
    functionName: 'transferFrom',
    args: [tip.sender_wallet, tip.receiver_wallet, BigInt(tip.amount)]
  })
}

// Esperar confirmación
const { isSuccess } = useWaitForTransactionReceipt({ hash })

useEffect(() => {
  if (isSuccess && hash) {
    // Notificar al bot
    fetch('https://api.walt.tip/webhook/complete', {
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

**Query Params:**
- `type` - "faucet" o "tip"
- `amount` - monto
- `txHash` - hash de la transacción

**UI si type=faucet:**
- 🎉 "Welcome to $WALT!"
- "You received 1,000 WALT"
- Link a Basescan
- Botón "Start Tipping" → deep link a Telegram bot
- "You can now send tips to anyone on Telegram!"

**UI si type=tip:**
- ✅ "Tip Sent!"
- "You sent 100 $WALT"
- Link a Basescan
- Botón "Back to Telegram"
- Confetti animation

---

## ⚙️ Configuración Técnica

### Variables de Entorno (`.env.local`)
```bash
NEXT_PUBLIC_BOT_API_URL=https://api.walt.tip
NEXT_PUBLIC_WALT_TOKEN=0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
```

### RainbowKit + Wagmi Setup (GRATIS - Sin WalletConnect)
```typescript
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base } from 'wagmi/chains'

const config = getDefaultConfig({
  appName: '$WALT Tipping',
  // Sin projectId = funciona con MetaMask, Coinbase, Rainbow, etc.
  // (sin la opción QR de WalletConnect, que es pago)
  chains: [base],
  ssr: true
})
```

**Nota:** Sin Project ID, RainbowKit funciona perfecto con wallets inyectadas (MetaMask, Coinbase, etc.). Los usuarios mobile pueden usar el browser dentro de MetaMask app.

### Token Info
- **$WALT:** `0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1`
- **Chain:** Base Mainnet (chainId: 8453)
- **Decimals:** 18

---

## 🎭 Estados de UI

### Loading States
- Skeleton mientras carga datos
- Spinner durante transacciones
- "Confirming on blockchain..."

### Error States
- "Invalid tip" → volver al inicio
- "Wrong wallet" → pedir cambiar wallet
- "Already claimed faucet" → mostrar balance actual
- "Transaction failed" → retry button

### Success States
- Confetti animation
- Checkmarks animados
- Clear CTAs (call-to-action)

---

## 📱 Responsive

- Mobile-first
- Botones grandes (touch-friendly)
- Cards con buen padding
- Texto legible

---

## ✅ Checklist de Features

### Core
- [ ] RainbowKit integrado
- [ ] Detectar wallet conectada
- [ ] Landing con faucet
- [ ] Página `/send` para completar tips
- [ ] Página `/success` para confirmaciones

### Faucet
- [ ] Check status al conectar wallet
- [ ] UI para reclamar (si es nuevo)
- [ ] Llamar POST /faucet/claim
- [ ] Mostrar success con confetti

### Tipping
- [ ] Leer tipId de URL
- [ ] Llamar GET /tip/:tipId
- [ ] Validar wallet = sender
- [ ] Ejecutar transferFrom
- [ ] Llamar webhook al completar

### UI/UX
- [ ] Modo Agents (dark)
- [ ] Modo Humans (light)
- [ ] Toggle entre modos
- [ ] Loading states
- [ ] Error states
- [ ] Animaciones de éxito
- [ ] Responsive

---

## 🚀 Post-Deploy

1. Deploy en Vercel
2. Actualizar `WEBAPP_URL` en el bot (`.env`)
3. Configurar `FAUCET_PRIVATE_KEY` en el backend (tener WALT en esa wallet)
4. Testear flujo completo: Faucet → Tip → Success

---

## 💡 Tips para Lovable

**La landing es el funnel principal.** La mayoría va a llegar directo ahí (no desde Telegram).

**El faucet es el hook.** "Free 1,000 WALT" es más atractivo que "Connect to send tips".

**Una vez que tienen WALT, van a querer usarlo.** El botón "Start Tipping" debe ser obvio.

---

**Versión:** 2.0 (con Faucet)  
**Fecha:** 2026-02-05  
**Para:** Lovable.dev
