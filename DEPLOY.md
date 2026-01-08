# 📯 Deploying The Gjallar Forge

Follow this guide to transition from local development to a live web application.

---

## 1. Backend Deployment (Render or Railway)
We recommend **Render** or **Railway** for hosting the Node.js/Express backend.

### Configuration
1. **Root Directory**: `server` (CRITICAL: Set this in your Render/Railway settings)
2. **Dynamic Runtime**: Node.js
3. **Build Command**: `npm install && npx prisma generate && npm run build`
4. **Start Command**: `npx prisma migrate deploy && npm start`

### Environment Variables
| Key | Value |
| :--- | :--- |
| `DATABASE_URL` | Your PostgreSQL/MySQL connection string. |
| `PORT` | 3001 (or as provided by the host). |

---

## 2. Frontend Deployment (Vercel or Netlify)
We recommend **Vercel** for its seamless Vite integration.

### Configuration
1. **Framework Preset**: Vite
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`

### Environment Variables
| Key | Value |
| :--- | :--- |
| `VITE_API_URL` | The public URL of your deployed backend (e.g., `https://forge-api.onrender.com`). |

---

## 3. Database Strategy (Supabase)
We recommend **Supabase** for your database.

### Getting your Connection String
1. Go to your **Supabase Project Settings > Database**.
2. Scroll to **Connection string** and select **URI**.
3. Set the mode to **Transaction**.
4. **CRITICAL**: Copy the URI and replace `[YOUR-PASSWORD]` with your actual database password.
5. **PRISMA TIP**: Your URI should look like this:
   `postgresql://postgres:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true` (Port **6543** is for Transaction mode).

---

## 4. Troubleshooting: "Root directory 'server' does not exist"
If Render gives this error, your `server` folder isn't on GitHub yet.
1. Open your terminal in the main project folder.
2. Run:
   ```bash
   git add server
   git commit -m "Pushing the forge core"
   git push
   ```
3. Once the folder appears on GitHub, Render will be able to find it!

---

## 🏃 Local Verification Before Push
Before deploying, ensure the build succeeds locally:
```bash
# Backend
cd server
npm run build

# Frontend
cd ..
npm run build
```

The forge awaits your legend. 📯
