# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately by opening a [GitHub Security Advisory](https://github.com/Valt1-0/drathos-backend/security/advisories/new) with:

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept if possible)
- Affected version(s)

You will receive an acknowledgement within 48 hours. We aim to release a fix within 14 days for critical issues.

Once a fix is released, the vulnerability will be disclosed publicly in the CHANGELOG and via a GitHub Security Advisory.

## Scope

**In scope:**

- Authentication / authorization bypass
- JWT secret or token exposure
- Path traversal or arbitrary file write via upload endpoints
- MongoDB injection
- Rate limiting bypass on sensitive endpoints
- Privilege escalation between roles (member → moderator → admin)

**Out of scope:**

- Vulnerabilities requiring physical access to the server
- Denial of service against a personal self-hosted instance
- Issues in the Electron client (report those in the [drathos](https://github.com/Valt1-0/drathos) repo)

## Security Design

Key security properties of the backend:

- Passwords hashed with bcrypt (12 rounds)
- JWT access tokens expire after 4 hours; refresh tokens are SHA-256 hashed before storage and rotate every 7 days
- Token blacklist with automatic cleanup on logout and password change
- Role-based access control: `member`, `moderator`, `admin` — enforced per route
- File uploads validated by magic bytes (not just extension), sanitized filename, and path traversal check
- All file operations restricted to the configured `SERVER_DATA_PATH` directory
- Rate limiting on auth (20 attempts/15 min) and downloads (20/5 min)
- Helmet security headers enabled in production
- Stack traces never exposed in HTTP responses
