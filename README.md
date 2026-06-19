# Drathos Backend

> Self-hosted game library server — manage, distribute, and track your games across your local network.

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/Valt1-0/drathos-backend)
[![Docker](https://img.shields.io/badge/docker-valt1n%2Fdrathos--backend-blue?logo=docker)](https://hub.docker.com/r/valt1n/drathos-backend)
[![Node](https://img.shields.io/badge/node-22-green?logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-GPL--3.0-22C55E)](LICENSE)

---

## Overview

Drathos Backend is the REST API + WebSocket server powering the Drathos gaming platform. It is designed to be self-hosted on a local network or home server, acting as a central hub for your game library.

---

## Features

### Game Library

Admins can upload games (`.7z` format) to the server. Each game is enriched with metadata fetched automatically from **IGDB** (title, cover, genres, release date, rating, multiplayer info, etc.). Members can browse the library and download games directly from the server.

### Playtime Tracking

Every game session is recorded. The backend tracks total playtime, number of sessions, first launch date, and last played date per user per game. Stats are synced bidirectionally with the client.

### Mod Management

Admins can upload mods (`.7z`) linked to a specific game. Mods carry metadata such as type (gameplay, visual, audio…), compatible game versions, and target platforms. Members can browse, download, and mark mods as installed.

### Collections

Users can organize their games into custom collections or smart playlists (recently played, most played, installed, etc.). Collections support custom icons, colors, pinning, and drag-and-drop ordering.

### User Accounts & Roles

Authentication is JWT-based with rotating refresh tokens. Three roles — **admin**, **moderator**, and **member** — with access control enforced on every sensitive endpoint.

### Real-time Notifications

A Socket.IO layer broadcasts events to all connected clients in real time (e.g. when a new game is added to the library).

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
- MongoDB **4** — MongoDB 5.0+ requires AVX CPU instructions, which many home servers and older machines lack. MongoDB 4 has no such requirement and runs on any x86-64 hardware.

### Installation

```bash
git clone https://github.com/Valt1-0/drathos-backend.git
cd drathos-backend
npm install
cp .env.example .env   # then edit .env
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

### Run

```bash
npm run dev    # development (auto-reload)
npm start      # production
```

---

## Docker

```bash
# Docker Compose (includes MongoDB)
docker compose up

# Pull from Docker Hub
docker pull valt1n/drathos-backend:latest

# Build locally
docker build -t valt1n/drathos-backend:1.0.0 .
```

The compose file sets up Traefik labels for HTTPS termination and connects the backend to MongoDB on an internal network.

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

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and pull request guidelines.
Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

---

## License

GPL-3.0 © [Valt](https://github.com/Valt1-0)
