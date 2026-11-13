# ConnectSphere WebRTC NAT Traversal & TURN Server Guide 📡🌐

This guide provides an exhaustive guide to configuring **STUN** and **TURN** servers for ConnectSphere to ensure uninterrupted video, audio, and screen sharing across corporate firewalls, symmetric NATs, cellular carriers, and university networks.

---

## 1. Why STUN and TURN Are Required

WebRTC establishes direct peer-to-peer (P2P) connections between browser participants using **Interactive Connectivity Establishment (ICE)**.

```
+-----------------------------------------------------------------------------------+
|                               ICE CANDIDATE TYPES                                 |
+-----------------------------------------------------------------------------------+
| 1. Host Candidates   : Direct local IP addresses (LAN / same machine).            |
| 2. Server Reflexive  : Public IP discovered by STUN server (NAT traversal).       |
| 3. Relay Candidates  : Relayed media packets via TURN server (Strict Firewalls).   |
+-----------------------------------------------------------------------------------+
```

- **STUN (Session Traversal Utilities for NAT)**: Discovers the client's public IP address and port mapping. Resolves connectivity for **~80-85%** of regular home internet connections and full cone NATs.
- **TURN (Traversal Using Relays around NAT)**: When two peers are both behind **Symmetric NAT** (common on 4G/5G mobile carriers and corporate VPNs) or UDP is blocked by firewall policies, direct P2P connections cannot be negotiated. The TURN server acts as an encrypted relay point using **DTLS-SRTP**, guaranteeing 100% connection success.

---

## 2. Option A: Self-Hosted Coturn Deployment (Ubuntu / Debian VPS)

Coturn is an open-source, high-performance TURN and STUN server.

### Step 1: Provision a Cloud Server
- **Recommended Providers**: DigitalOcean, Hetzner, AWS EC2, or Linode.
- **Specs**: 1 vCPU, 1 GB RAM (handles 100+ concurrent relayed video streams).
- **OS**: Ubuntu 22.04 LTS or 24.04 LTS.
- **Static Public IPv4**: Assign a static floating/elastic IP address.

### Step 2: Install Coturn
```bash
sudo apt-get update
sudo apt-get install -y coturn
```

### Step 3: Enable Coturn Daemon
Edit `/etc/default/coturn`:
```bash
sudo nano /etc/default/coturn
```
Uncomment the startup flag:
```text
TURNSERVER_ENABLED=1
```

### Step 4: Configure `turnserver.conf`
Backup original configuration and write new production config:
```bash
sudo mv /etc/turnserver.conf /etc/turnserver.conf.backup
sudo nano /etc/turnserver.conf
```

Paste the following production configuration (replace values in `<>`):
```ini
# Network listening ports
listening-port=3478
tls-listening-port=5349

# Public IP of your TURN server (replace with your server's public IP)
external-ip=YOUR_SERVER_PUBLIC_IP

# Server realm and identification
realm=turn.yourdomain.com
server-name=connectsphere-turn

# Authentication credentials (long-term credential mechanism)
lt-cred-mech
user=connectsphere_turn_user:YOUR_STRONG_SECRET_PASSWORD

# UDP relay port range (keep within standard dynamic range)
min-port=49152
max-port=65535

# Security hardening
no-stdout-log
log-file=/var/log/coturn/turn.log
verbose
fingerprint
no-multicast-peers
no-cli

# Optional TLS Configuration (using Let's Encrypt certificates)
# cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
# pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
```

### Step 5: Configure Firewall (UFW / Cloud Security Groups)
Open the required Coturn ports:
```bash
# STUN/TURN standard UDP/TCP
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp

# Secure TURNS (TLS)
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp

# Media relay UDP port range
sudo ufw allow 49152:65535/udp

# Enable firewall
sudo ufw reload
```

### Step 6: Start and Verify Coturn
```bash
sudo systemctl restart coturn
sudo systemctl enable coturn
sudo systemctl status coturn
```

---

## 3. Option B: Managed Cloud TURN Services

If you prefer not to manage infrastructure, the following managed TURN providers offer instant global relays:

### 1. Metered.ca (Free Tier Available)
- **Free Allowance**: 50 GB per month of worldwide relayed bandwidth.
- **Setup**: Sign up at [metered.ca](https://www.metered.ca/), create an application, and copy your ICE servers JSON credentials.

### 2. Twilio Network Traversal Service (NTS)
- Global anycast routing across 10 regions.
- Pay-as-you-go per gigabyte of relayed video.

### 3. Xirsys
- Managed WebRTC STUN/TURN infrastructure with regional endpoint selection.

---

## 4. Configuring ConnectSphere with Your TURN Server

### Frontend Configuration (`frontend/.env`)
In your frontend deployment environment (e.g. Vercel Project Settings):
```env
VITE_TURN_URL=turn:YOUR_SERVER_PUBLIC_IP:3478?transport=udp
VITE_TURN_USERNAME=connectsphere_turn_user
VITE_TURN_CREDENTIAL=YOUR_STRONG_SECRET_PASSWORD
```

For TLS-secured TURN (TURNS):
```env
VITE_TURN_URL=turns:turn.yourdomain.com:5349?transport=tcp
VITE_TURN_USERNAME=connectsphere_turn_user
VITE_TURN_CREDENTIAL=YOUR_STRONG_SECRET_PASSWORD
```

### Backend Configuration (`backend/.env`)
In your backend environment (Render, Railway, or VPS):
```env
TURN_URL=turn:YOUR_SERVER_PUBLIC_IP:3478?transport=udp
TURN_USERNAME=connectsphere_turn_user
TURN_CREDENTIAL=YOUR_STRONG_SECRET_PASSWORD
```

---

## 5. Testing & Verification

### Step 1: Verify via WebRTC Trickle ICE Tool
1. Visit the official [WebRTC Trickle ICE Tester](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/).
2. Remove default Google STUN servers.
3. Add your TURN Server:
   - **STUN or TURN URI**: `turn:YOUR_SERVER_PUBLIC_IP:3478?transport=udp`
   - **TURN username**: `connectsphere_turn_user`
   - **TURN password**: `YOUR_STRONG_SECRET_PASSWORD`
4. Click **Add Server** and then click **Gather candidates**.
5. **Expected Result**: Look for a candidate row with `Component type = relay` and `Priority = ...`.
   - If `relay` candidate appears with status `Done`, your TURN server is working.
   - If only `srflx` appears or timeout occurs, verify firewall UDP port `49152:65535` is open.

### Step 2: In-App Diagnostics in ConnectSphere
1. Launch ConnectSphere and join a meeting room.
2. Open Chrome DevTools (`F12`), navigate to `chrome://webrtc-internals/`.
3. Locate the `RTCIceCandidatePair` with `state = succeeded`.
4. Inspect candidate types: `localCandidate.candidateType = relay` indicates encrypted media packets are flowing through your TURN relay.

