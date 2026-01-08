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

### Option A: GitHub Desktop (Recommended for Google Sign-in)
If you use Google to sign in and don't know your password:
1. Download **GitHub Desktop**.
2. Sign in via your browser (supports Google/SSO).
3. "Add" your local project folder.
4. It will automatically detect the missing `server` files.
5. Click **Commit** and then **Push**. It handles the "100 file limit" and authentication for you!

### Option B: Terminal Ritual (Requires PAT or CLI)
If your terminal asks for a password and you use Google sign-in, you must use a **Personal Access Token (PAT)** or the GitHub CLI:
1. Install GitHub CLI: `brew install gh`
2. Login: `gh auth login` (select GitHub.com > HTTPS > Login with a web browser).
3. Once logged in, run:
   ```bash
   git add .
   git commit -m "The Forge is complete: Full local sync"
   git push origin main
   ```

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
