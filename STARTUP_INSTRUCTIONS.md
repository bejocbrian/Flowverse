# Aether Video Local Development Guide

To run the application locally and see all the logs in your own terminal, you will need to open **two separate terminal windows**.

---

### Terminal 1: Run the Application (Frontend & Backend)
Open a terminal in the root folder of the project (`localayerai`) and run:
```bash
npm run dev
```
This single command automatically starts:
1. The **PocketBase Database** (on port 8090)
2. The **API Server** (on port 3001)
3. The **Frontend App** (on port 3000)

*Keep this terminal open to see all the server logs when a video is being generated.*

---

### Terminal 2: Run the Webhook Tunnel (Localtunnel)
Because GeminiGen is on the public internet, it cannot send "Video Completed" webhooks directly to your `localhost:3001`. You must run a tunnel to expose it.

Open a second terminal window and run:
```bash
npx localtunnel --port 3001
```

ssh -p 443 -R0:localhost:3001 -o StrictHostKeyChecking=no a.pinggy.io




**Important Note about Localtunnel/Ngrok:**
Yes! Every time you close this terminal, the tunnel dies. When you restart it, you will get a **new random URL** (e.g. `https://random-word.loca.lt`). 
Because of this, every time you start a new localtunnel session, you **must** copy the new URL, go to the GeminiGen Dashboard, and update your Webhook URL to: `https://<YOUR-NEW-URL>.loca.lt/webhooks/geminigen`

---

### Common Issues

**1. Port is already in use**
If you try to run `npm run dev` and it says port 3001 or 3000 is in use, it means you have an old background process running. You can clear them on Windows by running:
`taskkill /F /IM node.exe /T`

**2. Database Validation Errors**
If the frontend says "Failed to generate: [field]: [error]" it means PocketBase rejected the data (for example, trying to send duration = 0 for an image). Check your PocketBase dashboard rules if this happens unexpectedly.
