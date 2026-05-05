# WhisperBox E2EE Messaging

WhisperBox is a Vite + React end-to-end encrypted messaging frontend. It depends on a separate backend for auth, user search, message storage, websocket signaling, and media/call infrastructure.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set frontend env values in `.env.local`:
```bash
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
VITE_TURN_URL=turn:your-turn-server.example.com:3478
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-password
```

3. Start the app:
```bash
npm run dev
```

## Deploying Frontend To Vercel

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Use the `Vite` framework preset.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add these environment variables in Vercel:
```bash
VITE_API_URL=https://your-backend-domain.com/api
VITE_WS_URL=wss://your-backend-domain.com/ws
VITE_TURN_URL=turn:your-turn-server.example.com:3478
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-password
```

Vercel only hosts the frontend. It does not replace the backend or websocket server.

## Backend Requirements

Your backend must provide:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /users/search?q=...`
- `GET /users/:id/public-key`
- `GET /conversations`
- `GET /conversations/:userId/messages`
- `POST /messages`
- `WS /ws?token=...`

The websocket server is required for fast realtime messaging, read receipts, typing events, presence, and call signaling.

## Recommended Backend Hosting

You have three solid options:

1. Railway
   Good for Node/FastAPI backends with websockets and managed Postgres.

2. Render
   Good if you want simple Docker or web service deployment with websocket support.

3. Fly.io
   Good if you want low-latency regions and more control over long-lived websocket processes.

If your current Koyeb backend is unreliable, I would strongly consider Railway or Render first for easier websocket debugging.

## Important Notes

- Vite dev proxy is only for local development.
- Production frontend should use explicit `VITE_API_URL` and `VITE_WS_URL`.
- If the backend is down, login, realtime chat, profile sync, and calls will fail even when the Vercel deployment is correct.

## Build

```bash
npm run build
```
