# 🛠️ Forge & Fury: Local Development Guide

To make changes and test them without affecting your live game, follow this "Two-Terminal" ritual.

### 🛡️ Step 1: The Local Database
Your local development uses a simple file (`dev.db`) instead of the cloud database.
1. In your `server` folder, make sure you have a `.env` file with this line:
   `DATABASE_URL="file:./dev.db"`

### 🛡️ Step 2: Start the Backend (Terminal 1)
1. Open a terminal and go to the `server` folder:
   ```bash
   cd "/Users/msloewen/Downloads/forge-&-fury_-rpg-workout-tracker/server"
   ```
2. Start the engine:
   ```bash
   npm run dev
   ```
   *You should see: "Server is running on port 3001"*

### 🛡️ Step 3: Start the Frontend (Terminal 2)
1. Open a **second** terminal and go to the root folder:
   ```bash
   cd "/Users/msloewen/Downloads/forge-&-fury_-rpg-workout-tracker"
   ```
2. Start the interface:
   ```bash
   npm run dev
   ```
3. Open your browser to the URL it gives you (usually `http://localhost:5173`).

---

### 🕵️ How the "Switch" Works
I've already set up your code to be "Environment Aware":
- **In the Cloud**: It sees the `VITE_API_URL` and talks to Render.
- **On your Mac**: It doesn't see that variable, so it automatically talks to `localhost:3001`.

### 🏁 When you are ready to "Go Live":
1. Open **GitHub Desktop**.
2. **Commit & Push** your changes.
3. Render and Netlify will automatically detect the push and update your live site! 📯
