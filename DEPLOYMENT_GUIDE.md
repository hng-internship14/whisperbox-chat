# 🚀 Vercel Deployment Guide for WhisperBox

This guide will walk you through deploying the WhisperBox frontend to Vercel.

## 📋 Prerequisites
1. A [Vercel Account](https://vercel.com) (connected to your GitHub/GitLab/Bitbucket).
2. Your WhisperBox code pushed to a Git repository.

---

## 🛠️ Step 1: Prepare the Code
I have already added a \`vercel.json\` file to your project. This file handles two critical things:
- **Routing**: Ensures refreshing the page on different routes (like \`/calls\`) doesn't cause a 404.
- **API Proxy**: Automatically routes any requests starting with \`/api\` to your Koyeb backend.

## 🌐 Step 2: Create a New Project on Vercel
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** > **"Project"**.
3. Import your WhisperBox repository.

## ⚙️ Step 3: Configure Build Settings
Vercel should automatically detect **Vite**. Ensure the following settings are matched:
- **Framework Preset**: \`Vite\`
- **Build Command**: \`npm run build\`
- **Output Directory**: \`dist\`

## 🔑 Step 4: Set Environment Variables (IMPORTANT)
Before clicking "Deploy", expand the **Environment Variables** section and add these:

| Key | Value | Description |
| :--- | :--- | :--- |
| \`VITE_API_URL\` | \`https://whisperbox.koyeb.app\` | Your backend API URL |
| \`VITE_WS_URL\` | \`wss://whisperbox.koyeb.app/ws\` | Your backend WebSocket URL |

> [!TIP]
> Setting these ensures the app connects to your production backend immediately after deployment.

## 🚀 Step 5: Deploy
Click **Deploy**. Vercel will build your project (usually takes ~1 minute). Once finished, you'll receive a production URL (e.g., \`whisperbox-e2ee.vercel.app\`).

---

## ✅ Post-Deployment Verification
1. Open your new Vercel URL.
2. Sign in or Sign up.
3. Check the **Console (F12)** to ensure you see \`[WS] Connected\`.
4. Send a test message to verify the end-to-end encryption flow is working.

**Your WhisperBox is now live and secure!**
