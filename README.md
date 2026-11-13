# ConnectSphere 🌐📹

**ConnectSphere** is an enterprise-grade, full-stack real-time communication, video conferencing, and team collaboration platform built on the **MERN** stack (MongoDB, Express.js, React.js, Node.js) with **WebRTC**, **Socket.IO**, **Tailwind CSS**, and **Framer Motion**.

Designed for resilience, security, and scalability, ConnectSphere provides seamless multi-party video conferencing, low-latency signaling, collaborative whiteboarding, meeting recordings, scheduling with calendar views, administrative governance, and AI-powered meeting summaries.

---

## 🏛️ System Architecture

```
                                  +-----------------------------+
                                  |    ConnectSphere Client     |
                                  |  (React 18, Vite, Tailwind) |
                                  +--------------+--------------+
                                                 |
                       +-------------------------+-------------------------+
                       | HTTPS REST API          | WebSocket / WSS         | WebRTC DTLS-SRTP
                       v                         v                         v
        +-----------------------------+   +-------------------+   +--------------------+
        | Express.js Application Core |   | Socket.IO Gateway |   | P2P Mesh & TURN    |
        | - Auth & Session (JWT)      |   | - WebRTC Signaling|   | - Direct Audio/Vid |
        | - Room & Meeting Controller |   | - Chat Broadcast  |   | - Screen Sharing   |
        | - Security Middleware       |   | - Whiteboard Sync |   | - Coturn Relay     |
        | - Rate Limiting & Helmet    |   | - Live Polls/Notes|   +--------------------+
        +--------------+--------------+   +---------+---------+
                       |                            |
                       +----------------------------+
                                     |
                       +-------------+-------------+
                       |                           |
                       v                           v
        +-----------------------------+   +-------------------+
        |      MongoDB Database       |   | Cloud Storage     |
        | - Users & Role Permissions  |   | - Cloudinary / S3 |
        | - Meetings & Calendar Events|   | - Ephemeral Local |
        | - Recordings & Transcripts  |   +-------------------+
        | - Audit Logs & Polls        |
        +-----------------------------+
```

---

## ✨ Features Overview

### 1. 📹 Real-Time WebRTC Video Conferencing
- **Peer-to-Peer Mesh Architecture**: Multi-party high-definition video and crystal-clear audio with adaptive bandwidth controls.
- **Microphone & Camera Controls**: Instant mute/unmute, camera toggle, and device switching with real-time audio waveform indicators.
- **Connection Diagnostics**: Transparent ping latency, connection state, and reconnect recovery handlers.
- **NAT Traversal (STUN/TURN)**: Integrated STUN auto-discovery with Coturn/managed TURN relay support for symmetric NAT and corporate firewalls.

### 2. 🖥️ Screen Sharing & Presentation
- **Full Screen, Window, and Tab Capture**: Stream displays at native 1080p 60fps fidelity.
- **Presenter Locking**: Concurrency control prevents participants from overwriting active presenter streams.
- **Dynamic Track Renegotiation**: Automatically injects and removes screen tracks on active peer connections without disconnecting.

### 3. 🎨 Real-Time Collaborative Whiteboard
- **Vector Drawing Tools**: Freehand pencil, eraser, lines, rectangles, circles, arrows, and rich text annotation.
- **Precision Controls**: Color picker, stroke width selector, zoom in/out, and canvas pan.
- **Collaboration & State**: Multi-user drawing synchronization, undo/redo stack, participant cursors, and PNG snapshot export.
- **Host Drawing Permissions**: Host can lock/unlock whiteboard drawing privileges at any time.

### 4. 💬 In-Meeting Chat & Direct Messaging
- **Room Broadcast & 1-to-1 Private Messages**: Clean chat panel with instant socket delivery and recipient privacy isolation.
- **Interactive Features**: Quoted replies, emoji reactions (👍, ❤️, 😂, 🎉), typing indicators, and message edits/deletions.
- **Searchable Chat History**: Paginated database retrieval for reviewing past discussions.

### 5. 👥 Participant Management & Host Controls
- **Host Permissions**: Mute individual participants, disable cameras, grant/revoke co-host roles, or eject abusive users.
- **Conference Controls**: Meeting lock to prevent new participants from joining, and "End Meeting for All" global teardown.
- **Waiting Room**: Dedicated waiting lobby where hosts can approve or reject participants prior to entry.
- **Participant Actions**: Raise hand queue, emoji reactions, presence status, and connection health badges.

### 6. 📅 Meeting Scheduling & Interactive Calendar
- **Advanced Scheduling**: Schedule meetings with custom title, agenda, duration, recurrence (daily/weekly/monthly), and passwords.
- **Full Calendar Suite**: Interactive Monthly, Weekly, and Daily calendar views with upcoming meeting reminder badges.
- **Timezone Intelligence**: Preserves local IANA timezones (e.g. `Asia/Kolkata`, `America/New_York`) without unexpected UTC shifts.
- **Automated Reminders**: Built-in backend notification service triggers timely alerts for scheduled conferences.

### 7. 🤝 Extended Collaboration Suite
- **Collaborative Notes**: Live-synced markdown meeting notes with auto-save and text export.
- **Live Meeting Polls**: Host creates instant voting polls; participants cast anonymous/identified votes with real-time percentage charts.
- **Breakout Rooms**: Host can dynamically split participants into smaller sub-rooms and recall them to the main room.
- **Presence & Contacts**: User directory search, contact connection requests, and real-time online/busy status indicators.

### 8. 🛡️ Enterprise Security & Hardening
- **Authentication**: Cryptographically signed JSON Web Tokens (JWT) stored in HttpOnly, SameSite, Secure cookies.
- **Password Protection**: Passwords hashed using bcrypt (10 rounds) with optional per-meeting access passcodes.
- **Defense-in-Depth**: Helmet security headers, strict Content Security Policy (CSP), CORS whitelisting, and Express rate limiting.
- **Injection & XSS Protection**: Custom middleware for NoSQL sanitization (`$gt` stripping) and XSS payload escaping.
- **Media Encryption**: Media streams encrypted end-to-end via WebRTC DTLS-SRTP standards.

### 9. 🎙️ Meeting Recording System
- **Host-Initiated Recording**: Capture conference audio, video, and screen tracks directly from the browser session.
- **Participant Consent Transparency**: Real-time recording banner and consent notifications displayed to all room attendees.
- **Storage Flexibility**: Compatible with local disk storage, Cloudinary, and AWS S3 buckets.
- **Recordings Library**: Secure streaming player, permission gating (host-only vs public), and one-click download.

### 10. 🤖 AI Productivity Suite
- **Live Speech Transcription**: Converts meeting audio into timestamped, speaker-attributed transcript segments.
- **Automated Summaries**: Extracts key discussion points, highlights, and decisions made.
- **Action Item Tracker**: Generates actionable tasks with assignees and due dates, tracking completion in real time.
- **Smart Search**: Semantic and keyword search across saved transcripts and collaborative notes.

### 11. 📊 Centralized Admin Dashboard
- **Platform Telemetry**: Live overview of registered users, active calls, storage usage, and system health.
- **User Management**: Inspect user profiles, promote roles (`admin`, `moderator`, `user`), and suspend/reactivate accounts.
- **Meeting Abuse Investigation**: Investigate user reports, review metadata, or forcefully terminate abusive meetings.
- **Immutable Security Audit Log**: Every administrative action is logged with IP address, admin email, and timestamp.

---

## 📁 Repository Structure

```text
task3/
├── backend/
│   ├── config/             # Environment, DB connection, and TURN configurations
│   ├── controllers/        # REST route handler controllers
│   ├── middleware/         # Security, rate limiting, validation, and error middlewares
│   ├── models/             # Mongoose schemas with compound indexes
│   ├── routes/             # Express API routing endpoints
│   ├── services/           # Core business logic (auth, presence, scheduling, AI)
│   ├── socket/             # Socket.IO handlers (WebRTC, chat, whiteboard, polls)
│   ├── tests/              # Unit & Supertest integration test suites
│   ├── utils/              # Token, logger, and response helpers
│   ├── test-e2e.js         # Comprehensive 114-step Socket.IO mesh verification
│   └── server.js           # Server entry point with graceful shutdown & compression
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios API service clients
│   │   ├── components/     # UI components (video, chat, whiteboard, admin, calendar)
│   │   ├── context/        # React Context providers (Auth, Socket, WebRTC)
│   │   ├── hooks/          # Custom hooks (useWebRTC, useChat, useWhiteboard)
│   │   ├── pages/          # Lazy-loaded page views (Room, Dashboard, Admin, Calendar)
│   │   └── utils/          # Constants, formatters, and helper utilities
│   ├── index.html          # HTML entry with mobile viewport tags
│   ├── vite.config.js      # Rollup manual chunk optimization & code splitting
│   └── vercel.json         # SPA routing rewrites for Vercel
├── tests/                  # Playwright browser end-to-end test suite
├── .env.example            # Root environment variables template
├── DATABASE_SETUP.md       # MongoDB Atlas setup and index guide
├── DEPLOYMENT.md           # Production deployment guide (Vercel, Render, S3)
├── WEBRTC_TURN_GUIDE.md    # Coturn and managed TURN configuration guide
├── TROUBLESHOOTING.md      # Matrix of production issues and fixes
├── TESTING.md              # Test execution documentation
└── README.md               # Main project documentation
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017/connectsphere`) or MongoDB Atlas URI

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/connectsphere.git
cd connectsphere

# Install root, backend, and frontend dependencies
npm run install:all
```

### 2. Configure Environment Files
Copy example environment templates:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Launch Development Servers
Start both backend (port 3000) and frontend (port 5173) concurrently:
```bash
npm run dev
```

Visit `http://localhost:5173` in your browser. Default administrator account:
- **Email**: `admin@connectsphere.com`
- **Password**: `AdminSecret123!`

---

## 🧪 Testing & Verification

ConnectSphere is backed by an automated test suite spanning unit tests, API integration tests, Socket.IO WebRTC mesh tests, and Playwright browser tests:

```bash
# Run backend unit tests (token, security, scheduling, AI)
npm run test:unit

# Run Supertest API integration tests (auth, meetings, rate limits, files)
npm run test:integration

# Run 114 full-stack Socket.IO mesh and signaling tests
npm test

# Run ESLint across entire codebase (zero warnings enforced)
npm run lint

# Build frontend production bundle with Rollup chunk splitting
npm run build:frontend
```

---

## 🚀 Production Deployment

Refer to our specialized deployment guides for production configuration:

- [DEPLOYMENT.md](file:///home/pratiksha/Desktop/CodeAlpha_Internship/task3/DEPLOYMENT.md) - Deploying to **Vercel** (frontend), **Render / Railway** (backend), and configuring cloud storage.
- [DATABASE_SETUP.md](file:///home/pratiksha/Desktop/CodeAlpha_Internship/task3/DATABASE_SETUP.md) - Provisioning **MongoDB Atlas**, connection pooling, and compound indexes.
- [WEBRTC_TURN_GUIDE.md](file:///home/pratiksha/Desktop/CodeAlpha_Internship/task3/WEBRTC_TURN_GUIDE.md) - Installing and configuring **Coturn** for symmetric NAT traversal.
- [TROUBLESHOOTING.md](file:///home/pratiksha/Desktop/CodeAlpha_Internship/task3/TROUBLESHOOTING.md) - Step-by-step solutions to common production issues.

---

## 📄 License

This project is licensed under the **ISC License**.
