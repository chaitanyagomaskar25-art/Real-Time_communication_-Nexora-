# ConnectSphere Database Setup & Production Administration Guide 🍃

This guide provides step-by-step instructions for provisioning, configuring, indexing, securing, and maintaining the MongoDB database for **ConnectSphere** in production.

---

## 1. Architecture & Persistence Overview

ConnectSphere uses MongoDB with Mongoose for persistent data storage, combined with optimized indexing and lean queries for high-throughput real-time collaboration.

### Core Collections & Models

| Collection | Model File | Purpose | Key Indexes |
| :--- | :--- | :--- | :--- |
| `users` | `User.js` | User profiles, passwords (bcrypt), presence, roles | `email` (unique), `username` (unique), `{ role: 1, status: 1 }`, `{ email: 1, status: 1 }`, `{ isOnline: 1, presenceStatus: 1 }` |
| `meetings` | `Meeting.js` | Scheduled and instant meetings, permissions, invitees | `meetingId` (unique), `{ host: 1, scheduledDate: -1 }`, `{ host: 1, status: 1 }`, `{ 'invitees.email': 1, status: 1 }`, `{ status: 1, scheduledDate: 1 }`, `{ isReported: 1, createdAt: -1 }` |
| `messages` | `Message.js` | In-meeting and direct chat messages | `roomId`, `{ roomId: 1, timestamp: -1 }`, `{ roomId: 1, isPrivate: 1, recipientId: 1, timestamp: -1 }` |
| `meetingfiles` | `MeetingFile.js` | Uploaded attachments, virus scan status, storage URLs | `fileId` (unique), `meetingId`, `{ meetingId: 1, isDeleted: 1, createdAt: -1 }` |
| `meetingnotes` | `MeetingNote.js` | Real-time synchronized collaborative notes | `meetingId` (unique) |
| `meetingpolls` | `MeetingPoll.js` | In-room voting polls, choices, and voter IDs | `pollId` (unique), `meetingId`, `{ meetingId: 1, createdAt: -1 }` |
| `recordings` | `Recording.js` | Meeting recording metadata, consent, and streams | `recordingId` (unique), `meetingId`, `{ host: 1, createdAt: -1 }`, `{ meetingId: 1, createdAt: -1 }` |
| `whiteboards` | `Whiteboard.js` | Multi-user canvas vector strokes & history stack | `meetingId` (unique) |
| `contacts` | `Contact.js` | User-to-user friend links and connection requests | `{ requester: 1, recipient: 1 }` (unique), `{ recipient: 1, status: 1 }` |
| `notifications` | `Notification.js` | Meeting invites, call alerts, missed notices | `{ recipient: 1, createdAt: -1 }`, `{ recipient: 1, isRead: 1, createdAt: -1 }` |
| `meetingtranscripts` | `MeetingTranscript.js`| Real-time speech transcription segments & timestamps | `transcriptId` (unique), `meetingId` |
| `meetingaiinsights`| `MeetingAIInsight.js` | AI summaries, action items, and topic tags | `insightId` (unique), `{ meetingId: 1, createdAt: -1 }` |
| `adminauditlogs` | `AdminAuditLog.js` | Immutable administrative actions audit trail | `logId` (unique), `{ createdAt: -1 }`, `{ action: 1, createdAt: -1 }`, `{ targetType: 1, targetId: 1, createdAt: -1 }` |

---

## 2. Provisioning MongoDB Atlas Cluster

For production deployments, **MongoDB Atlas** is the recommended managed database.

### Step 1: Create an Atlas Account and Project
1. Visit [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. Create a new Organization and Project named `ConnectSphere-Production`.

### Step 2: Deploy a Cluster
1. Choose **M0 (Free Shared)** for initial staging or **M10+ (Dedicated)** for production workloads requiring automated backups and performance insights.
2. Select a cloud provider (AWS, GCP, or Azure) and choose a region close to your backend hosting server (e.g., `us-east-1` or `eu-central-1`) to minimize query latency.
3. Choose Cluster Tier:
   - Development/Testing: `M0 Sandbox` (512 MB storage).
   - Production: `M10` (10 GB storage, RAM 2GB, dedicated CPU).

### Step 3: Configure Network Access & IP Whitelisting
1. In the Atlas dashboard, navigate to **Security** > **Network Access**.
2. Click **Add IP Address**.
3. For serverless hosting environments like Render, Railway, or Vercel where outgoing IP addresses are dynamic:
   - Select **Allow Access from Anywhere** (`0.0.0.0/0`).
   - Secure the cluster by enforcing strong database credentials and SCRAM-SHA-256 authentication.
4. If your backend is hosted on a VPS with a static IP (e.g., AWS EC2 Elastic IP or DigitalOcean Droplet), add that specific `/32` IP address instead for maximum defense-in-depth.

### Step 4: Create a Dedicated Database User
1. Navigate to **Security** > **Database Access**.
2. Click **Add New Database User**.
3. Authentication Method: **Password**.
4. Set Username: `connectsphere_app_user`.
5. Set a strong password (minimum 24 characters, generated randomly).
6. Set Database User Privileges:
   - Select **Read and write to any database** (or restrict to `connectsphere` database specifically: `readWrite@connectsphere`).
7. Click **Add User**.

### Step 5: Obtain Connection String
1. Navigate to **Database** > **Connect**.
2. Select **Drivers** (Node.js version 5.5 or later).
3. Copy the SRV connection URI:
   ```text
   mongodb+srv://connectsphere_app_user:<password>@cluster0.xyz.mongodb.net/connectsphere?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your actual password and ensure the database name is set to `connectsphere`.

---

## 3. Production Connection Configuration & Pooling

ConnectSphere configures Mongoose in `backend/config/db.js` with production-grade settings:

```javascript
const mongoose = require('mongoose');
const config = require('./config');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 50,       // Max simultaneous connections in connection pool
      minPoolSize: 10,       // Maintain warm connections
      socketTimeoutMS: 45000,// Close sockets after 45s of inactivity
      family: 4              // Force IPv4 for reliable DNS resolution
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.warn(`MongoDB Connection Warning: ${error.message}`);
  }
};
```

---

## 4. Index Creation & Verification

Indexes are created automatically when the application boots and registers Mongoose models. To inspect or build indexes manually via `mongosh`:

```javascript
// Connect via mongosh
mongosh "mongodb+srv://cluster0.xyz.mongodb.net/connectsphere" --username connectsphere_app_user

// Switch to ConnectSphere database
use connectsphere

// Verify indexes on critical collections
db.users.getIndexes()
db.meetings.getIndexes()
db.messages.getIndexes()
db.recordings.getIndexes()
db.adminauditlogs.getIndexes()
```

If needed, build compound indexes directly in the shell:

```javascript
// Meetings compound indexes
db.meetings.createIndex({ host: 1, scheduledDate: -1 }, { background: true });
db.meetings.createIndex({ host: 1, status: 1 }, { background: true });
db.meetings.createIndex({ 'invitees.email': 1, status: 1 }, { background: true });
db.meetings.createIndex({ status: 1, scheduledDate: 1 }, { background: true });
db.meetings.createIndex({ isReported: 1, createdAt: -1 }, { background: true });

// Message history pagination index
db.messages.createIndex({ roomId: 1, timestamp: -1 }, { background: true });
db.messages.createIndex({ roomId: 1, isPrivate: 1, recipientId: 1, timestamp: -1 }, { background: true });

// Notifications index
db.notifications.createIndex({ recipient: 1, createdAt: -1 }, { background: true });
db.notifications.createIndex({ recipient: 1, isRead: 1, createdAt: -1 }, { background: true });
```

---

## 5. Automated Backups & Disaster Recovery

1. **Continuous Cloud Backups**: On MongoDB Atlas M10+ tiers, automated point-in-time restores (PITR) take continuous snapshots every 6 hours with retention up to 30 days.
2. **Manual Snapshot Export**:
   Before running production migrations:
   ```bash
   mongodump --uri="mongodb+srv://connectsphere_app_user:PASSWORD@cluster0.xyz.mongodb.net/connectsphere" --out="./backup_$(date +%F)"
   ```
3. **Restore Backup**:
   ```bash
   mongorestore --uri="mongodb+srv://connectsphere_app_user:PASSWORD@cluster0.xyz.mongodb.net/connectsphere" --drop "./backup_2026-11-06/connectsphere"
   ```

---

## 6. Seed Accounts & Default Roles

On initial boot, ConnectSphere automatically verifies whether an administrative account exists. If not, it safely creates the default administrator:

- **Email**: `admin@connectsphere.com`
- **Default Password**: `AdminSecret123!` (Prompted to change immediately upon first production login).
- **Role**: `admin`
- **Status**: `active`

