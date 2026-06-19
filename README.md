<div align="center">
  <br />
  <img src="https://raw.githubusercontent.com/Valt1-0/drathos/main/resources/icon.png" alt="Drathos" width="100" />
  <h1>Drathos Backend</h1>
  <p><strong>Self-Hosted Game Library Server</strong></p>
  <p>Self-hosted · Open Source · REST API + WebSocket</p>

  <p>
    <img src="https://img.shields.io/badge/version-1.0.0-3B82F6?style=flat-square" />
    <img src="https://img.shields.io/badge/node-22-339933?style=flat-square&logo=node.js&logoColor=white" />
    <img src="https://img.shields.io/badge/docker-valt1n%2Fdrathos--backend-2496ED?style=flat-square&logo=docker&logoColor=white" />
    <img src="https://img.shields.io/badge/license-GPL--3.0-22C55E?style=flat-square" />
  </p>

  <p>
    <img src="https://skillicons.dev/icons?i=nodejs,express,mongodb,docker" height="36" />
  </p>

  <br />
</div>

<div align="center">

[Features](#features) · [Stack](#tech-stack) · [Getting Started](#getting-started) · [Client](https://github.com/Valt1-0/drathos)

</div>

<br />

---

## What is Drathos Backend?

Drathos Backend is the **REST API + WebSocket server** powering the Drathos gaming platform. It is designed to be self-hosted on a local network or home server, acting as a central hub for your DRM-free game library — storing games, tracking playtime, managing users, and broadcasting real-time events to connected clients.

<br />

---

## Features

<table>
<tr><td><img src="https://api.iconify.design/lucide/library.svg?color=%233B82F6" width="16" style="vertical-align: middle" /> &nbsp;<strong>Game Library</strong></td><td>Upload games (.7z) · IGDB metadata enrichment (cover, genres, rating, release date) · File integrity validation via magic bytes</td></tr>
<tr><td><img src="https://api.iconify.design/lucide/bar-chart-3.svg?color=%23F59E0B" width="16" style="vertical-align: middle" /> &nbsp;<strong>Playtime Tracking</strong></td><td>Per-user session recording · Total playtime, session count, first/last played · Bidirectional sync with the client</td></tr>
<tr><td><img src="https://api.iconify.design/lucide/puzzle.svg?color=%238B5CF6" width="16" style="vertical-align: middle" /> &nbsp;<strong>Mod Management</strong></td><td>Upload mods linked to a game · Type, version, platform metadata · Download and install tracking</td></tr>
<tr><td><img src="https://api.iconify.design/lucide/folder-open.svg?color=%238B5CF6" width="16" style="vertical-align: middle" /> &nbsp;<strong>Collections</strong></td><td>Custom collections and smart playlists · Icons, colors, pinning · Recently played, most played, installed</td></tr>
<tr><td><img src="https://api.iconify.design/lucide/users.svg?color=%2306B6D4" width="16" style="vertical-align: middle" /> &nbsp;<strong>User Roles</strong></td><td>JWT + rotating refresh tokens · Three roles: Admin / Moderator / Member · Access control enforced per route</td></tr>
<tr><td><img src="https://api.iconify.design/lucide/zap.svg?color=%23F59E0B" width="16" style="vertical-align: middle" /> &nbsp;<strong>Real-time</strong></td><td>Socket.IO broadcasts for new games, notifications · Instant client updates without polling</td></tr>
</table>

<br />

---

## Tech Stack

| Layer      | Technology                       |
| ---------- | -------------------------------- |
| Runtime    | Node.js 22                       |
| Framework  | Express.js v5                    |
| Database   | MongoDB 4 + Mongoose             |
| Real-time  | Socket.IO v4                     |
| Auth       | JWT + bcrypt                     |
| Security   | Helmet, express-rate-limit, CORS |
| Logging    | Winston                          |
| Deployment | Docker                           |

---

## Getting Started

### Prerequisites

- Node.js 22+
- MongoDB **4** — MongoDB 5.0+ requires AVX CPU instructions, which many home servers and older machines lack. MongoDB 4 runs on any x86-64 hardware.

### Installation

```bash
git clone https://github.com/Valt1-0/drathos-backend.git
cd drathos-backend
npm install
cp .env.example .env   # then edit .env
npm run dev            # development (auto-reload)
npm start              # production
```

### Configuration

| Variable               | Description                       | Default                             |
| ---------------------- | --------------------------------- | ----------------------------------- |
| `API_PORT`             | Port the server listens on        | `5001`                              |
| `NODE_ENV`             | `development` or `production`     | `development`                       |
| `MONGODB_URI`          | MongoDB connection string         | `mongodb://127.0.0.1:27017/drathos` |
| `JWT_TOKEN`            | Secret key for signing JWT tokens | —                                   |
| `GAME_FILES_DIR`       | Directory for game `.7z` files    | `serverData/serverGames`            |
| `MOD_FILES_DIR`        | Directory for mod `.7z` files     | `serverData/serverMods`             |
| `TWITCH_CLIENT_ID`     | Twitch app client ID (IGDB)       | —                                   |
| `TWITCH_CLIENT_SECRET` | Twitch app client secret (IGDB)   | —                                   |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins              | `*`                                 |

> **IGDB**: metadata lookup requires a free [Twitch Developer](https://dev.twitch.tv) app.

### Docker

```bash
# Docker Compose (includes MongoDB)
docker compose up

# Pull from Docker Hub
docker pull valt1n/drathos-backend:latest

# Build locally
docker build -t valt1n/drathos-backend:1.0.0 .
```

The compose file sets up Traefik labels for HTTPS termination and connects the backend to MongoDB on an internal network.

<br />

---

## Security

- Passwords hashed with **bcrypt** (12 rounds)
- **JWT** access tokens (4h expiry) + rotating refresh tokens (7 days, SHA-256 hashed in DB)
- **Helmet** for HTTP security headers
- **Rate limiting** — 500 req/min globally, 20 login attempts/15 min in production
- Input validation on all write endpoints via **express-validator**
- File uploads validated by magic bytes (not just extension) and restricted to configured directories
- Stack traces never exposed in HTTP responses

To report a vulnerability privately, see [SECURITY.md](SECURITY.md).

<br />

---

## Legal Disclaimer

Drathos Backend is a **self-hosted server** — it does not host, distribute, or provide access to any games or content on behalf of its developers. All content stored on the server is uploaded and managed exclusively by the person who self-hosts the software.

You are solely responsible for ensuring that any content uploaded to your server complies with applicable copyright laws and the terms of any relevant licenses. The developers of Drathos do not condone piracy or any unauthorized distribution of copyrighted material.

This software is provided "as is", without warranty of any kind. See the [LICENSE](LICENSE) for details.

<br />

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and pull request guidelines.
Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

<br />

---

<div align="center">
  <br />
  <sub>Built with ❤️ by <strong>Valt</strong></sub>
  <br />
  <sub><a href="https://github.com/Valt1-0/drathos-backend">github.com/Valt1-0/drathos-backend</a></sub>
  <br /><br />
</div>
