# ConnectSphere Production Troubleshooting Guide 🔍🛠️

This guide documents common issues encountered in WebRTC, real-time WebSockets, authentication, database connectivity, and cloud deployments, along with actionable root causes and step-by-step resolutions.

---

## 1. WebRTC Audio, Video & Screen Sharing

### Issue 1.1: `TypeError: Cannot read properties of undefined (reading 'getUserMedia')`
- **Symptom**: Browser throws an error when attempting to join a meeting or turn on camera/microphone.
- **Root Cause**: The application is accessed via an insecure origin (`http://` instead of `https://`). Browsers only expose `navigator.mediaDevices` in secure contexts (`https://` or `http://localhost`).
- **Fix**:
  1. Access ConnectSphere strictly over `https://`.
  2. If testing locally from a mobile device or other LAN machine, use an HTTPS tunnel (e.g. `ngrok http 5173` or `cloudflared tunnel`) or generate a local self-signed certificate.

---

### Issue 1.2: Remote Video is Black or Stalls on "Connecting..."
- **Symptom**: Local camera preview renders, but other participants' video boxes remain black or display a spinning loader.
- **Root Cause**: Direct peer-to-peer UDP packets are blocked by a **Symmetric NAT** (common on 4G/5G mobile carriers) or a restrictive enterprise firewall. STUN discovery alone is insufficient.
- **Fix**:
  1. Verify TURN server configuration in `frontend/.env` (`VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`).
  2. Test your TURN relay using the [WebRTC Trickle ICE Tester](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/). Ensure candidate type `relay` is returned with status `Done`.
  3. Ensure UDP ports `49152:65535` are open on the Coturn firewall.
  4. Refer to [WEBRTC_TURN_GUIDE.md](file:///home/pratiksha/Desktop/CodeAlpha_Internship/task3/WEBRTC_TURN_GUIDE.md) for full setup instructions.

---

### Issue 1.3: Audio Fails to Play (Browser Autoplay Policy)
- **Symptom**: Other participants are speaking (visual waveform indicator moves), but no audio is heard.
- **Root Cause**: Browsers block audio playback without prior user interaction on the page.
- **Fix**:
  1. ConnectSphere binds `<audio>` streams directly to HTML media elements and plays them after user interaction.
  2. Ensure the participant has clicked at least once within the page (e.g., clicking "Join Call" or clicking the unmute button).
  3. Verify remote participant is not muted by the host in participant management settings.

---

### Issue 1.4: Screen Sharing Fails with `NotAllowedError: Permission denied`
- **Symptom**: Clicking "Share Screen" immediately closes or fails without opening the window picker.
- **Root Cause**: Either the user canceled the system screen capture prompt or the operating system has not granted Screen Recording permissions to the browser (e.g., macOS Privacy & Security settings).
- **Fix**:
  1. On macOS: Open **System Settings** > **Privacy & Security** > **Screen Recording** > Toggle browser ON.
  2. In Linux / Wayland: Ensure `pipewire` and `xdg-desktop-portal` are installed and running.

---

## 2. WebSocket & Socket.IO Signaling

### Issue 2.1: Continuous Reconnection Loop / WebSocket Error 1006
- **Symptom**: Socket connects and disconnects repeatedly every few seconds. Console displays `WebSocket connection to 'wss://...' failed`.
- **Root Cause**:
  1. Reverse proxy (Nginx, Apache, or Cloudflare) is not configured to forward the `Upgrade` and `Connection` headers for WebSockets.
  2. CORS origin mismatch between frontend domain and backend `CLIENT_URL`.
- **Fix**:
  1. In Nginx configuration, verify WebSocket forwarding directives:
     ```nginx
     location /socket.io/ {
         proxy_pass http://localhost:3000;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection "Upgrade";
         proxy_set_header Host $host;
         proxy_read_timeout 86400s;
     }
     ```
  2. Verify backend `CLIENT_URL` matches your exact frontend URL (including `https://` without a trailing slash).

---

### Issue 2.2: `Session ID unknown` / Desynchronization in Multi-Instance Deployments
- **Symptom**: When running multiple backend instances behind a load balancer, clients frequently drop connections with `Session ID unknown` (HTTP 400).
- **Root Cause**: WebSocket polling requests from the same user hit different backend instances because load balancer sticky sessions (session affinity) are disabled.
- **Fix**:
  1. Enable **Sticky Sessions / Session Affinity** (based on IP or cookie) on your load balancer.
  2. Configure `REDIS_URL` in `backend/.env` so that `@socket.io/redis-adapter` distributes events across all server instances.

---

## 3. Authentication & Session Cookies

### Issue 3.1: Login Succeeds but Next API Call Returns 401 Unauthorized
- **Symptom**: User logs in, but refreshing the page or visiting `/dashboard` redirects back to login.
- **Root Cause**: Frontend and backend are hosted on different domains (e.g. `connectsphere.vercel.app` and `connectsphere.onrender.com`), and cross-origin cookies are blocked by browser third-party cookie restrictions.
- **Fix**:
  1. ConnectSphere backend automatically detects cross-origin environments and sets cookies with `sameSite: 'none'`, `secure: true`.
  2. ConnectSphere also returns the JWT token in the JSON response body. The frontend stores it in `localStorage` as an automatic fallback and attaches `Authorization: Bearer <token>` to all API requests.
  3. Ensure `withCredentials: true` is enabled in Axios client.

---

### Issue 3.2: Admin Dashboard Returns 403 Forbidden
- **Symptom**: User can sign in, but clicking Admin Dashboard shows an alert or redirects with 403.
- **Root Cause**: The user's account role is set to `user` instead of `admin`.
- **Fix**:
  1. ConnectSphere provides an initial administrator account:
     - **Email**: `admin@connectsphere.com`
     - **Password**: `AdminSecret123!`
  2. To promote an existing user to admin via MongoDB Shell:
     ```javascript
     use connectsphere
     db.users.updateOne({ email: "user@example.com" }, { $set: { role: "admin" } })
     ```

---

## 4. File Upload & Storage

### Issue 4.1: HTTP 413 "Payload Too Large"
- **Symptom**: Uploading large documents or recordings fails with HTTP 413.
- **Root Cause**: Either Express `limit` or reverse proxy `client_max_body_size` is lower than the uploaded file size.
- **Fix**:
  1. ConnectSphere Express parser is configured to accept payloads up to `10mb` and Multer handles streaming multipart files up to `25MB`.
  2. In Nginx: add `client_max_body_size 30M;` inside the `server` block.

---

### Issue 4.2: Uploaded Files or Recordings Disappear After Server Restart
- **Symptom**: Uploads work initially, but disappear after a few hours or following a deploy.
- **Root Cause**: Hosting providers like Render, Heroku, and Railway use **ephemeral filesystems**. Any files saved to local `./uploads` are destroyed when containers restart.
- **Fix**:
  1. Set `STORAGE_PROVIDER=cloudinary` or `STORAGE_PROVIDER=s3` in backend environment variables.
  2. Provide cloud storage API credentials as documented in [DEPLOYMENT.md](file:///home/pratiksha/Desktop/CodeAlpha_Internship/task3/DEPLOYMENT.md).

---

## 5. Database & Performance

### Issue 5.1: `MongoServerSelectionError: connection timed out`
- **Symptom**: Backend crashes on boot with `MongoServerSelectionError` or logs connection warnings.
- **Root Cause**: MongoDB Atlas Network Access whitelist does not allow incoming connections from your backend server's IP address.
- **Fix**:
  1. Open [MongoDB Atlas](https://cloud.mongodb.com/).
  2. Navigate to **Network Access** > **IP Access List**.
  3. Add `0.0.0.0/0` (Allow Access from Anywhere) for dynamic cloud platforms, or add your server's static IP.

---

### Issue 5.2: Scheduled Meeting Timezone Offset Discrepancies
- **Symptom**: A meeting scheduled for 10:00 AM appears at a different hour for participants in different timezones.
- **Root Cause**: Scheduled date was parsed without preserving the creator's local timezone offset.
- **Fix**:
  1. ConnectSphere stores ISO UTC timestamps while preserving the user's IANA timezone identifier (e.g. `Asia/Kolkata` or `America/New_York`).
  2. The frontend calendar automatically converts timestamps to the participant's local timezone using the standard `Intl.DateTimeFormat` browser API.

