# Yap to Earn · $YAP

Post in your token's [Coin Communities](https://coincommunities.org/) feed on pump.fun. Hold $YAP. Creator fees are claimed every 5 minutes and split **equally** among qualifying posters.

**Live**

- Frontend: https://yap-coin.vercel.app
- API: https://yap-coin.onrender.com

## Local dev

```bash
cd backend && npm install && npm run dev
cd .. && npm install && npm run dev
```

Backend: `http://localhost:3002` (see `backend/.env` `PORT`)

Frontend: set `VITE_API_URL=http://localhost:3002` or edit `src/config.js`

## Admin

```bash
curl -X POST http://localhost:3002/admin/sync -H "x-admin-secret: YOUR_ADMIN_SECRET"
curl -X POST http://localhost:3002/admin/collect -H "x-admin-secret: ..."
curl -X POST http://localhost:3002/admin/payout -H "x-admin-secret: ..."
```

## Env

See `backend/.env.example`. Requires `CC_API_KEY` from [Coin Communities quickstart](https://coincommunities.org/docs/quickstart).
