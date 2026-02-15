# Kontaktai (GitHub Pages + Vercel API + Blob)

Sis projektas:
- Frontend hostinamas per GitHub Pages.
- Backend endpointai hostinami per Vercel (serverless).
- Irasai saugomi Vercel Blob saugykloje.
- Irasu turinys saugomas sifruotas (AES-256-GCM), kad Blob failas be rakto butu neiskaitomas.

## URL

- Frontend: `https://andrius314.github.io/kontaktai-github-pages/`
- Admin: `https://andrius314.github.io/kontaktai-github-pages/admin.html`
- Privatumo puslapis: `https://andrius314.github.io/kontaktai-github-pages/privacy.html`
- API (contact): `https://kontaktai-github-pages-api.vercel.app/api/contact`

## Reikalinga konfig

### Frontend (`config.js`)

- `apiBaseUrl`: palik kaip yra (Vercel API domenas).
- `turnstileSiteKey`: ivesk Cloudflare Turnstile site key (public).

### Vercel env (projekte `kontaktai-github-pages-api`)

Reikia nustatyti:
- `ALLOWED_ORIGIN` = `https://andrius314.github.io`
- `ADMIN_KEY` = tavo admin slaptazodis
- `TURNSTILE_SECRET_KEY` = Cloudflare Turnstile secret key
- `DATA_ENC_KEY` = 32 baitai base64 (sifravimo raktas)

Sugeneruoti raktus:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # DATA_ENC_KEY
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" # ADMIN_KEY (pvz.)
```

Po env pakeitimu: Vercel Dashboard -> Deployments -> Redeploy (production).

## Kur pamatyti irasus

1. Admin puslapis:
   - `admin.html` leidzia ieskoti, filtruoti, zymeti perziureta ir eksportuoti i CSV/XLSX (Excel).
2. Vercel Dashboard:
   - projektas `kontaktai-github-pages-api` -> Storage -> Blob store -> `contacts/`

