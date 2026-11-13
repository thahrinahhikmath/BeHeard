# 🎙️ BeHeard

> **Turn every smartphone in the hall into a wireless microphone.**  
> Zero app installs, zero aisle mic-runners. Just scan a QR code, raise your hand, and speak directly through the venue sound system.

---

## 📖 Overview

During live Q&A sessions, town halls, lectures, and conferences, passing around physical wireless microphones is slow, disruptive, and logistically painful. **BeHeard** solves this by turning every attendee's phone into an instant stage microphone.

Attendees simply scan a QR code projected on the hall screen, enter their name, and join the virtual room. When they want to speak, they tap **"Raise Hand"**. The host (from a laptop connected to the venue's PA / sound system) manages the speaker queue and grants the microphone with a single click.

### ⚡ Key Architectural Highlights
* **Direct WebRTC Audio (P2P):** High-definition, low-latency audio streams directly from the attendee's smartphone to the host laptop using browser-native WebRTC.
* **Zero Audio Server Load:** Audio packets **never** traverse the backend server. The Node.js server only acts as a lightweight WebSocket signaling and room management coordinator.
* **No App Store Required:** Built as a modern Progressive Web App (PWA) compatible with any mobile browser (Safari on iOS, Chrome on Android, etc.).
* **Built-in DSP:** Automatic Echo Cancellation (AEC), Noise Suppression, and Auto Gain Control (AGC) configured natively via the Web Audio and MediaStreams APIs.

---

## ✨ Features

### 📱 Audience Experience
- **Instant Access:** One-click join via QR code with persistent local name storage.
- **Queue Transparency:** Live position indicator (e.g., *"You are number 2 in line"*).
- **Stage Feedback:** Interactive audio visualization disc that pulses and glows in real time with speaking loudness.
- **Turn Controls:** Ability to voluntarily lower hand or finish speaking early (*"I'm done speaking"*).
- **Security Check:** Detects non-HTTPS environments and notifies users of browser microphone permission constraints.

### 🎛️ Host Console (`/admin.html`)
- **PIN Authentication:** Secure console access protected by customizable PIN.
- **Live Stage Monitor:** Real-time VU meter, active speaker timer, and instantaneous audio volume control.
- **Hardware Output Routing:** Dynamic audio sink switching to direct speech to USB soundcards, HDMI outputs, or venue PA interfaces.
- **Queue & Roster Management:** FIFO queue view, instant mic revocation (*"Take mic back"*), and panic reset (*"End all and clear queue"*).
- **Projector Mode:** Fullscreen QR code display modal formatted specifically for large hall displays and projectors.

---

## 🏗️ Architecture & Data Flow

```text
[ Attendee Phone ]                              [ Host Laptop (PA System) ]
       │                                                     │
       │ 1. Scan QR & Join Room via WebSocket                │
       ├───────────────────► [ Signaling Server ] ◄──────────┤
       │                     (Node.js / ws)                  │
       │ 2. Raise Hand                                       │
       │                                  3. Grant Floor     │
       │◄────────────────────────────────────────────────────┤
       │ 4. SDP Offer / Answer Exchange (Signaling)          │
       ├───────────────────► [ Signaling Server ] ◄──────────┤
       │                                                     │
       │ 5. Direct WebRTC Audio Stream (P2P / Opus)          │
       └════════════════════════════════════════════════════►│
                                                             ▼
                                                    [ Venue Speakers / PA ]
```

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, `ws` (WebSockets)
- **Frontend:** React 18, Web Audio API, WebRTC (`RTCPeerConnection`, `getUserMedia`)
- **Bundler & Tooling:** `esbuild` for sub-second JSX compilation
- **Styling:** Vanilla CSS with modern flexbox/grid layout and typography via Google Fonts (*Bricolage Grotesque* & *Instrument Sans*)
- **Utility:** `qrcodejs` for client-side dynamic QR code generation

---

## 📂 Project Structure

```text
BeHeard/
├── public/
│   ├── index.html        # Audience entry page
│   ├── admin.html        # Host console page (QR display & queue controls)
│   ├── style.css         # Shared design system, dark mode UI & animations
│   ├── common.jsx        # Shared hooks (useTimer, useLevel, Meter, Icons)
│   ├── audience.jsx      # Audience React application source
│   ├── admin.jsx         # Host console React application source
│   ├── audience.js       # Compiled audience bundle (generated via esbuild)
│   └── admin.js          # Compiled admin console bundle (generated via esbuild)
├── build.js              # esbuild JSX compilation script
├── server.js             # HTTP static file server & WebSocket signaling relay
├── package.json          # Project manifest, scripts, and dependencies
├── .gitignore            # Git exclusion rules
└── README.md             # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16.0.0 or later recommended)
- `npm`

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/thahrinahhikmath/BeHeard.git
   cd BeHeard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Compile JSX templates:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   ```
   By default, the server listens on `http://localhost:3000`.

---

## 🔒 Enabling Microphone on Phones (HTTPS Setup)

> **Important:** Modern mobile browsers (iOS Safari, Android Chrome) **strictly require an HTTPS connection** to access the microphone via `navigator.mediaDevices.getUserMedia()`.

To test or deploy in an auditorium:

### Option A: Quick Tunneling with ngrok (Recommended for testing & live demos)
In a separate terminal window, expose your local port:
```bash
npx ngrok http 3000
```
1. Copy the forwarded `https://....ngrok-free.app` URL.
2. Open `http://localhost:3000/admin.html` on your host laptop.
3. Paste the `https://...` link into the **Public link for the QR code** field in the host console.
4. Project the QR code on the screen — attendees can now scan and speak immediately.

### Option B: Cloud Deployment (Production)
Deploy the repository directly to platforms supporting WebSockets and custom ports:
- **Render** / **Railway** / **Fly.io** / **Heroku**
- Set environment variables if desired:
  - `PORT`: Port to listen on (assigned automatically by cloud hosts)
  - `ADMIN_PIN`: Secret host passcode (defaults to `1234` if not provided)

---

## ⚙️ Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for the Express and WebSocket server |
| `ADMIN_PIN` | `1234` | Secret PIN used to authenticate to the Host Console |

Example running with custom credentials:
```bash
ADMIN_PIN=9876 PORT=8080 npm start
```

---

## 🎯 How to Run an Event

1. **Host Setup:** Connect your laptop's audio output (3.5mm jack, USB DAC, or HDMI) to the venue's sound mixer / PA amplifier.
2. **Open Console:** Navigate to `http://localhost:3000/admin.html` (or your deployed domain) and log in with your PIN.
3. **Display QR:** Click **"Show on projector"** to display the QR code on the stage screen.
4. **Audience Joins:** Attendees scan the code on their mobile devices and enter their name.
5. **Manage Discussion:** As questions arise, see names queue in order. Click **"Give mic"** to grant speaking permissions; when finished, click **"Take mic back"** or the speaker can tap **"I'm done speaking"**.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check out the [issues page](https://github.com/thahrinahhikmath/BeHeard/issues).

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
