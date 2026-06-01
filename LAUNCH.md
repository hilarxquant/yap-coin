# Launch checklist — new $YAP mint & treasury

The app is **not** tied to the old Bull mint. Everything runs off env vars.

## Before launch

1. Create the new pump.fun coin and note the **mint** (contract address ending in `pump`).
2. Generate a **new treasury wallet** (creator/dev) — do not reuse Bull keys.
3. Fund treasury with a little SOL for claim + payout tx fees.
4. Coin Communities: point your business API at the **new** `token_address` (same `CC_API_KEY` usually works once the community exists for that mint).

## Local (`backend/.env`)

```env
MINT=YourNewMint...pump
TREASURY_PRIVATE_KEY=your_new_base58_secret
# keep RPC_URL, CC_API_KEY, ADMIN_SECRET as-is
ENABLE_FEE_COLLECTION=true
```

Frontend optional override (usually unnecessary — the site reads mint from the API):

```env
VITE_MINT=YourNewMint...pump
```

## Production

```bash
# Sync mint + treasury to Render and redeploy
node scripts/go-live.mjs --mint YourNewMint...pump --treasury YOUR_BASE58_SECRET

# Fresh poster DB (recommended on new mint)
curl -X POST https://yap-coin.onrender.com/admin/clear-db -H "x-admin-secret: YOUR_ADMIN_SECRET"

# Vercel only if you want a build-time CA fallback (optional)
vercel env add VITE_MINT production
# paste mint, then:
vercel deploy --prod --yes
```

## After launch

- `POST /admin/sync` — ingest community posts for the new mint
- `POST /admin/collect` — test fee claim
- `POST /admin/payout` — test equal split (need qualifying holder + pool)

## Do not

- Leave the old Bull `MINT` or treasury key on Render/Vercel.
- Run payouts against the old mint’s community feed.
