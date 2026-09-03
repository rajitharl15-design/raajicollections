# Deploy & Secure-Admin Guide

## What lives where

| Address | What it is |
|---------|-----------|
| `raajicollections.com` | Old Raaji Collections storefront (front page) |
| `raajicollections.com/store.html` | Peacock Fashions storefront |
| `raajicollections.com/<category>.html` | Old Raaji category pages (static catalog) |
| `<backend>/admin` | **Secure** catalog admin (server-login protected) |

The front-end runs on **GitHub Pages** (static, no server). The **admin is not on Pages** — it is
served by the backend from `backend/private/` and is protected by a real server login.

## Quick deploy (Render)

1. Create a **Render Web Service** from this repo (the `Dockerfile` + `render.yaml` are ready).
2. Attach a **managed Postgres** (`render.yaml` includes a database block).
3. Set these environment variables on the service (Render → **Environment** tab):

   ```env
   ADMIN_USER=admin
   ADMIN_PASS=REPLACE_WITH_A_STRONG_PASSWORD
   AUTH_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
   UPLOAD_DIR=/data
   CORS_ORIGIN=https://raajicollections.com,https://www.raajicollections.com
   ```
4. Add a **Render Disk** mounted at `/data` (1 GB) so uploaded images persist.
5. **Manual Deploy → Deploy latest commit.** On boot it auto-migrates and backfills the catalog
   (categories + products + images) if the products table is empty.

Generate a strong secret, e.g.:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

## Using the secure admin

- Open **`https://<your-backend>.onrender.com/admin`**.
- You'll be redirected to `/admin-login` until you sign in with `ADMIN_USER` / `ADMIN_PASS`.
- A **signed HttpOnly cookie** is set; `/api/admin/*` and `/api/upload` return **401** otherwise.

## Security notes

- The static `admin.html` was **removed from the GitHub Pages site** (`backend/private/`), so there
  is no insecure public admin page.
- Client-side APIs can't be truly secured on Pages; always use the backend URL for admin + uploads.
- Never commit the real `ADMIN_PASS` / `AUTH_SECRET` values — keep them in Render env only.

## Editing the catalog

In the secure admin you can rename products, change price/category/sizes, and **add/delete images**
(uploaded to the mounted disk). Changes you make there are server-side. For the **static** store,
edits are applied by downloading **Export `data.js`** and replacing `js/data.js` in the repo, then
pushing to update GitHub Pages for all visitors.