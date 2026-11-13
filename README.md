# BeHeard – Smartphone-Based Wireless Microphone System

**Turn every smartphone into a wireless microphone for live events.**

## Overview

BeHeard is a web-based wireless microphone system designed to simplify audience participation during conferences, seminars, lectures, and town halls.

Traditional Q&A sessions rely on physical microphones, causing delays and disrupting discussions. BeHeard eliminates this dependency by allowing attendees to use their smartphones as microphones without installing an application.

Attendees scan a QR code to join a live session, raise their hands to request speaking access, and communicate through their device's microphone. The host manages speaking permissions and controls audio output through a centralized dashboard connected to the venue's sound system.

## Key Features

- **QR-Based Access:** Join sessions instantly without installing an application.
- **Live Speaker Queue:** Manage audience requests with real-time queue updates.
- **Host Dashboard:** Grant, revoke, and manage microphone permissions.
- **Real-Time Audio Streaming:** Direct peer-to-peer audio communication using WebRTC.
- **Audio Processing:** Browser-based echo cancellation, noise suppression, and automatic gain control.
- **Audio Output Control:** Route audio to connected sound systems and external audio devices.
- **Projector Mode:** Display session QR codes for quick audience access.
- **PIN Authentication:** Restrict access to host controls.

## Technical Architecture

BeHeard uses WebRTC for direct peer-to-peer audio streaming between attendee devices and the host laptop. A lightweight Node.js WebSocket server handles room management, speaker requests, and WebRTC signaling.

Audio streams travel directly between devices rather than through the backend server, reducing server bandwidth requirements and communication overhead.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React 18, JavaScript, HTML, CSS |
| Backend | Node.js, Express.js |
| Real-Time Communication | WebRTC, WebSockets |
| Audio Processing | Web Audio API, MediaStreams API |
| Build Tool | esbuild |
| Utilities | QRCode.js |

## Getting Started

**Prerequisites:** Node.js 16+ and npm.

```bash
# Clone the repository
git clone https://github.com/thahrinahhikmath/BeHeard.git

# Navigate to the project
cd BeHeard

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

Open the host dashboard at:

```text
http://localhost:3000/admin.html
```

**Note:** Mobile microphone access requires HTTPS. For local testing, use an HTTPS tunnel such as ngrok.

## Project Highlights

- Eliminates the need for physical microphone distribution during audience Q&A sessions.
- Implements real-time communication using WebRTC and WebSocket signaling.
- Demonstrates peer-to-peer audio streaming and centralized session management.
- Provides a responsive, browser-based experience across mobile and desktop devices.

## License

This project is licensed under the [MIT License](LICENSE).
