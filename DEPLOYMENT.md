# ConnectSphere Production Deployment Guide 🚀🌐

An exhaustive, step-by-step production deployment guide for **ConnectSphere**, covering frontend deployment on **Vercel**, backend hosting on **Render / Railway**, database on **MongoDB Atlas**, and persistent cloud media storage on **Cloudinary / AWS S3**.

---

## 1. Production Architecture Overview

```
                      +------------------------------------------+
                      |         End Users (Web Browsers)         |
                      +--------------------+---------------------+
                                           |
                    HTTPS / WSS            |          P2P DTLS-SRTP Audio/Video
                         |                 |                     |
                         v                 v                     v
            +------------------------+   +-------------------+  +-------------------+
            |    Frontend (Vercel)   |   | Backend (Render)  |  | Peer WebRTC Mesh  |
            | React + Vite + Tailwind|   | Node.js + Express |  | (Direct & TURN)   |
            +------------------------+   +---------+---------+  +-------------------+
                                                   |
                             +---------------------+---------------------+
                             |                     |                     |
                             v                     v                     v
                 +-------------------+   +-------------------+  +-------------------+
                 |   MongoDB Atlas   |   |   Redis Cluster   |  | Cloud Storage     |
                 | Database Replica  |   | Socket.IO Adapter |  | (Cloudinary / S3) |
                 +-------------------+   +-------------------+  +-------------------+
```

> [!IMPORTANT]
> **HTTPS is Mandatory**: Modern web browsers strictly block camera, microphone (`navigator.mediaDevices.getUserMedia`), and screen sharing (`navigator.mediaDevices.getDisplayMedia`) on insecure HTTP origins. Both frontend and backend MUST be served over HTTPS / WSS.

---

## 2. Deploying Backend to Render or Railway

### Option A: Render (Web Service)

1. Sign in to [Render](https://render.com/) and click **New +** > **Web Service**.
2. Connect your Git repository containing ConnectSphere.
3. Configure Service Settings:
   - **Name**: `connectsphere-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Starter` (or higher for production)
4. Configure Environment Variables in the Render Dashboard:

| Variable Name | Example Production Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations and disables stack traces |
| `PORT` | `10000` (Render default) | The internal port Render binds to |
| `CLIENT_URL` | `https://connectsphere.vercel.app` | Trusted CORS origin for cookies & headers |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/connectsphere?retryWrites=true&w=majority` | Production MongoDB Atlas SRV URI |
| `JWT_SECRET` | `a9f848b1c4e7...` (min 32 chars) | Secure random key for signing JWT tokens |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `STORAGE_PROVIDER` | `local` (or `cloudinary` / `s3`) | Storage target for uploads & recordings |
| `MAX_FILE_SIZE` | `26214400` | Upload limit in bytes (25 MB) |
| `REDIS_URL` | `redis://...` *(Optional)* | Multi-instance Socket.IO clustering |
| `TURN_URL` | `turn:turn.example.com:3478` | WebRTC TURN server relay address |
| `TURN_USERNAME` | `connectsphere_turn_user` | TURN credentials |
| `TURN_CREDENTIAL` | `strong_secret_password` | TURN password |

5. Configure Health Check Path:
   - In Render service settings, set **Health Check Path** to `/api/health`.
6. Click **Create Web Service**. Render provisions SSL certificates (`https://connectsphere-backend.onrender.com`) automatically.

---

### Option B: Railway

1. Sign in to [Railway.app](https://railway.app/) and create a **New Project**.
2. Select **Deploy from GitHub repo**.
3. Set **Root Directory** to `/backend`.
4. Add Environment Variables (same table as Render above).
5. Add a domain under **Networking** > **Generate Domain**.
6. Railway automatically exposes HTTPS and WebSockets.

---

## 3. Deploying Frontend to Vercel

1. Sign in to [Vercel](https://vercel.com/) and click **Add New** > **Project**.
2. Import your ConnectSphere Git repository.
3. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Add Environment Variables in Vercel:

| Variable Name | Production Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://connectsphere-backend.onrender.com/api` | Backend REST API endpoint (with `/api`) |
| `VITE_SOCKET_URL` | `https://connectsphere-backend.onrender.com` | Backend WebSocket / Socket.IO URL |
| `VITE_TURN_URL` | `turn:turn.yourdomain.com:3478?transport=udp` *(Optional)* | Configurable TURN relay server |
| `VITE_TURN_USERNAME`| `connectsphere_turn_user` *(Optional)* | TURN username |
| `VITE_TURN_CREDENTIAL`| `your_password` *(Optional)* | TURN password |

5. Single Page Application (SPA) Routing Configuration:
   Ensure `frontend/vercel.json` exists to handle client-side routing rewrites:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
6. Click **Deploy**. Vercel will build, optimize chunks, and issue a global CDN URL with HTTPS.

---

## 4. Configuring Persistent Media Storage (Cloudinary & S3)

In containerized or serverless hosting environments (Render, Heroku, Railway), local files in `/uploads` are ephemeral. For production persistence of shared meeting attachments and meeting recordings, configure cloud object storage.

### Option A: Cloudinary Setup
1. Create a free account at [Cloudinary](https://cloudinary.com/).
2. Copy your **Cloud Name**, **API Key**, and **API Secret** from the Cloudinary Dashboard.
3. In backend environment variables, configure:
   ```env
   STORAGE_PROVIDER=cloudinary
   CLOUDINARY_CLOUD_NAME=my_cloud_name
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123
   ```

### Option B: AWS S3 Setup
1. Create an AWS S3 bucket with versioning and server-side encryption enabled (AES-256).
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` permissions for the bucket.
3. In backend environment variables, configure:
   ```env
   STORAGE_PROVIDER=s3
   AWS_S3_BUCKET=connectsphere-production-assets
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

---

## 5. Horizontal Scaling with Redis (Multi-Instance Clustering)

When user concurrency exceeds a single Node.js instance, multiple backend replicas can be deployed behind a load balancer.

1. **Deploy Redis Instance**: Provision a Redis service on [Upstash](https://upstash.com/), Redis Cloud, or Railway.
2. **Configure Backend Environment**:
   ```env
   REDIS_URL=rediss://default:password@your-redis-instance.upstash.io:6379
   ```
3. ConnectSphere's `backend/socket/socketHandler.js` will automatically detect `REDIS_URL` and initialize `@socket.io/redis-adapter` to distribute chat, signaling, and room events across cluster nodes.
4. **Load Balancer Sticky Sessions**: Ensure your reverse proxy / load balancer enables IP-hash or cookie-based sticky sessions for initial WebSocket HTTP handshakes.

---

## 6. Post-Deployment Verification Checklist

- [ ] **HTTPS/SSL Verification**: Both frontend and backend load with a valid TLS lock icon.
- [ ] **Health Probes**: `https://backend.example.com/api/health` returns `HTTP 200` with `status: "OK"`.
- [ ] **Liveness & Readiness**: `/api/health/live` and `/api/health/ready` report healthy container states.
- [ ] **Authentication & Cookies**: Registering a user receives the `token` cookie with `SameSite=None` and `Secure=true`.
- [ ] **Real-Time Signaling**: Two different browser windows join the same room and exchange audio/video tracks.
- [ ] **Screen Sharing**: Presenter can start screen share; remote participants view the video track.
- [ ] **Whiteboard**: Vector pencil strokes render in real-time across both screens.
- [ ] **Admin Portal**: Admin user logs in at `/admin` and views telemetry metrics.
- [ ] **File Sharing**: File uploaded inside a meeting can be downloaded by participants.

