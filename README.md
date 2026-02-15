# Kontaktai (GitHub Pages + Vercel API + Blob)

Sis projektas jau sukonfiguruotas veikti saugiai:
- Frontend hostinamas per GitHub Pages.
- Backend endpoint `api/contact.js` hostinamas per Vercel.
- Zinutės saugomos Vercel Blob saugykloje.
- Jokiu DB raktu frontende nera.

## Naudojami URL

- Frontend: `https://andrius314.github.io/kontaktai-github-pages/`
- API: `https://kontaktai-github-pages-api.vercel.app/api/contact`

## Kaip tai veikia

1. Vartotojas uzpildo forma.
2. Frontendas siuncia `POST` i Vercel API.
3. API validuoja laukus, tikrina origin ir honeypot.
4. API issaugo JSON irasa Blob saugykloje (`contacts/*.json`).

## Kur randasi irasai

Vercel Dashboard:
1. Atsidaryk projekta `kontaktai-github-pages-api`
2. Eik i `Storage` -> Blob store `kontaktai-messages-2`
3. Matysi failus kataloge `contacts/`

## Saugumo pastabos

- `BLOB_READ_WRITE_TOKEN` laikomas tik Vercel environmente.
- Frontendas neturi jokio rasymo rakto.
- `ALLOWED_ORIGIN` riboja uzklausas is tavo GitHub Pages domeno.
