# Deploy Backend API

## Opción 1: Render.com (Recomendada - Gratis)

### 1. Crear cuenta en Render.com

### 2. New Web Service
- **Build Command:** `npm install`
- **Start Command:** `node api/server.js`
- **Plan:** Free

### 3. Environment Variables
```
TELEGRAM_BOT_TOKEN=8295357196:AAHSIGDuqzFQlib3Ki6F3CO3VypkG6ml_M8
BASE_RPC_URL=https://mainnet.base.org
WALT_TOKEN_ADDRESS=0x1E018AC547796185f978aF6AeFa9b1e88D1Bc0b1
WEBAPP_URL=https://tipwalt.com
API_PORT=10000
FAUCET_PRIVATE_KEY=0x...  # Opcional: para activar faucet
```

### 4. Auto-deploy
Conectar repo de GitHub para auto-deploy en cada push.

---

## Opción 2: Railway (Gratis $5/mes)

Similar proceso, buena alternativa.

---

## Opción 3: VPS (DigitalOcean, etc.)

```bash
# Clone repo
git clone <repo>
cd walt-tipping-system

# Install
npm install

# PM2 para mantener vivo
npm install -g pm2

# Start API
pm2 start api/server.js --name "walt-api"

# Save config
pm2 save
pm2 startup
```

---

## Verificación Post-Deploy

```bash
# Health check
curl https://api.tipwalt.com/health

# Faucet status
curl https://api.tipwalt.com/faucet/status/0x1234...

# Tip details
curl https://api.tipwalt.com/tip/1
```

---

## Configurar Faucet (Opcional)

Para activar el faucet:

1. Crear wallet nueva
2. Enviar WALT a esa wallet (para distribuir)
3. Agregar private key a `FAUCET_PRIVATE_KEY`
4. Restart API

---

## Dominio Personalizado

En Render/Railway:
1. Add custom domain: `api.tipwalt.com`
2. Configurar DNS CNAME → servicio de Render
3. Wait for SSL

---

**Nota:** El bot de Telegram corre SEPARADO. Necesita `TELEGRAM_BOT_TOKEN` propio.
