# Webapp Integration Spec
## $WALT Tipping System - Webhook API

**Propósito:** Conectar la webapp (Lovable) con el bot de Telegram para completar propinas.

---

## 1. Flujo Completo

```
Usuario A → Bot: /tip @UsuarioB 100 WALT
Bot → Usuario A: "Click para firmar: https://tippable.app/send?tipId=123"
Usuario A → Webapp: Conecta wallet, firma transacción
Webapp → Blockchain: Ejecuta transferFrom
Webapp → Bot API: POST /webhook/complete {tipId, txHash}
Bot → Usuario B: "Recibiste 100 WALT de @UsuarioA"
```

---

## 2. Endpoints del Bot (Backend)

### 2.1 Obtener datos de propina pendiente
```
GET https://api.walt.tip/tip/:tipId
```

**Response:**
```json
{
  "id": 123,
  "sender_wallet": "0x1234...",
  "receiver_wallet": "0x5678...",
  "amount": "100000000000000000000",
  "amount_human": "100",
  "token_address": "0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1",
  "message": "Thanks for the help!",
  "status": "pending",
  "expires_at": "2026-02-05T01:00:00Z"
}
```

### 2.2 Notificar propina completada
```
POST https://api.walt.tip/webhook/complete
```

**Body:**
```json
{
  "tipId": 123,
  "txHash": "0xabc123...",
  "sender_wallet": "0x1234...",
  "receiver_wallet": "0x5678...",
  "amount": "100000000000000000000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tip marked as completed"
}
```

---

## 3. Páginas de la Webapp (Lovable)

### 3.1 `/send` - Página principal de envío

**Query params:**
- `tipId` (required) - ID de la propina del bot
- `theme` (optional) - `agent` o `human`

**Funcionalidad:**
1. Lee tipId de la URL
2. Llama GET `/tip/:tipId` para obtener datos
3. Muestra: receptor, monto, mensaje
4. Integra RainbowKit para conexión de wallet
5. Valida que el sender_wallet conectado coincida con el de la propina
6. Ejecuta `transferFrom` via viem/wagmi
7. Al confirmar tx, llama POST `/webhook/complete`
8. Muestra pantalla de éxito con txHash

### 3.2 `/success` - Confirmación

**Query params:**
- `txHash`
- `amount`
- `to`

**Muestra:**
- Animación de éxito
- Link a Basescan
- Botón "Volver a Telegram"

---

## 4. Smart Contract Calls

### Transferencia directa (vía Permit2)
```typescript
import { parseUnits } from 'viem'

// Token contract
const WALT_TOKEN = {
  address: '0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1',
  abi: [
    {
      name: 'transferFrom',
      type: 'function',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ]
    }
  ]
}

// Ejecutar transferencia
const tx = await writeContract({
  address: WALT_TOKEN.address,
  abi: WALT_TOKEN.abi,
  functionName: 'transferFrom',
  args: [sender, receiver, parseUnits(amount, 18)]
})
```

---

## 5. Diseño UI

### Estilo Agents (losviajesdewalt.com)
- Fondo: gradiente oscuro con tonos azul/púrpura
- Tipografía: Monospace para datos, Sans-serif para texto
- Elementos: cards con bordes sutiles, glow effects
- Animaciones: typing effect, glitch en títulos

### Estilo Humans
- Fondo: limpio, blanco o gris muy claro
- Tipografía: Sans-serif moderna (Inter, SF Pro)
- Elementos: rounded corners, sombras suaves
- Animaciones: smooth transitions, micro-interacciones

### Toggle
- Switch en la esquina: 🤖 Agents / 👤 Humans
- Persistir preferencia en localStorage

---

## 6. Webhooks para Lovable

Cuando el usuario completa la transacción en la webapp, llamás a:

```bash
curl -X POST https://api.walt.tip/webhook/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer WEBHOOK_SECRET" \
  -d '{
    "tipId": 123,
    "txHash": "0x...",
    "sender_wallet": "0x...",
    "receiver_wallet": "0x...",
    "amount": "100000000000000000000"
  }'
```

Esto hace que el bot:
1. Marque la propina como "completed"
2. Notifique al receptor en Telegram
3. Actualice el leaderboard

---

## 7. URLs para Testing

**Bot local:** `http://localhost:3001`
**Webapp Lovable:** `https://tippable.app` (o el dominio que uses)

### Test flow:
1. Abrir Telegram, usar `/tip @usuario 10 WALT`
2. Click en el link que genera el bot
3. Webapp carga, conectar wallet
4. Firmar transacción
5. Ver notificación en Telegram al receptor

---

## 8. Variables de entorno para Lovable

```
NEXT_PUBLIC_BOT_API_URL=https://api.walt.tip
NEXT_PUBLIC_WALT_TOKEN=0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
WEBHOOK_SECRET=xxx  # para autenticar llamadas al bot
```

---

## 9. Checklist de implementación

### Webapp (Lovable):
- [ ] Setup Next.js + RainbowKit
- [ ] Página `/send` con query param parser
- [ ] Integración con API del bot
- [ ] Llamada a `transferFrom` on-chain
- [ ] POST a webhook al completar
- [ ] Página `/success` con txHash
- [ ] Toggle Agents/Humans
- [ ] Diseño responsive

### Bot (yo me encargo):
- [ ] Endpoint GET `/tip/:tipId`
- [ ] Endpoint POST `/webhook/complete`
- [ ] Actualizar `tips.json` al recibir webhook
- [ ] Notificar receptor vía Telegram

---

## 10. FAQ

**Q: ¿Qué pasa si el usuario cierra la webapp sin completar?**
A: La propina queda en `pending`. El bot puede enviar un reminder después de X minutos.

**Q: ¿Y si la transacción falla?**
A: La webapp muestra error, el bot no recibe webhook, la propina sigue `pending`. El usuario puede reintentar.

**Q: ¿Cómo sé que el webhook es legítimo?**
A: Usar `Authorization: Bearer WEBHOOK_SECRET` en el header.

**Q: ¿Soporta múltiples chains?**
A: Por ahora solo Base mainnet. El token address es fijo.

---

**Versión:** 1.0  
**Fecha:** 2026-02-04  
**Autor:** Walt  
