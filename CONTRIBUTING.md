# Contributing to Drathos Backend

Thank you for your interest in contributing!

## Development Setup

**Prerequisites**: Node.js 22+, npm, MongoDB 4.x (or Docker).

```bash
git clone https://github.com/Valt1-0/drathos-backend.git
cd drathos-backend
npm install
cp .env.example .env   # fill in your values (see below)
npm run dev
```

The server starts on port 3000 by default (configurable via `PORT` in `.env`).

**Minimum `.env` values for local dev:**

```env
JWT_TOKEN=any_long_random_string_for_dev
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
MONGO_URI=mongodb://localhost:27017/drathos
```

Twitch credentials are required for IGDB metadata fetching. Create an app at [dev.twitch.tv/console](https://dev.twitch.tv/console).

## Project Structure

```
src/
  controllers/   # Business logic (one file per domain)
  middlewares/   # Auth, rate limiting, validation, security, error handling
  models/        # Mongoose schemas
  routes/        # Express router definitions
  utils/         # Shared utilities (pathValidator, constants, etc.)
app.js           # Express app entry point
```

## Making Changes

- **Controllers**: keep business logic here, not in routes
- **Validation**: use `express-validator` chains in `validationMiddleware.js` — do not validate inside controllers
- **File uploads**: always run through `pathValidator.js` checks before writing to disk; never trust client-supplied paths
- **New routes**: register them in `app.js` and protect with `authMiddleware` + role middleware as appropriate
- **Error handling**: throw errors or pass them to `next(err)` — the global error handler in `errorMiddleware.js` takes care of formatting

## Security Requirements

- All new endpoints must go through `authMiddleware` unless explicitly public
- File path operations must use `validateAndResolvePath()` or `isInsideDirectory()` from `pathValidator.js`
- New file upload types must add magic bytes validation
- Do not log sensitive values (tokens, passwords, personal data)
- Report vulnerabilities privately via [SECURITY.md](SECURITY.md)

## Docker

```bash
docker compose up -d   # starts backend + MongoDB
docker compose logs -f # follow logs
```

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Keep changes focused — one feature or fix per PR
3. Update `.env.example` if you add new environment variables
4. Update the README environment variable table for any new config
5. Open a PR against `main` with a clear description of what and why
