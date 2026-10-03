# Backgammon Coach API

A small NestJS service that keeps an optional cloud backup of each player's progress.

## Privacy model

- **Accounts:** anonymous. No email, name or device identifier.
  - Creating an account returns a random backup code (100 bits, shown once).
  - The server stores only the code's SHA-256 hash.
- **Auth:** the code is the bearer credential (`Authorization: Bearer <code>`). Entering it on another
  device links that device to the same backup.
- **Data:** only the learning progress snapshot the app uploads.

## API (`/v1`)

| Method | Path           | Auth | Purpose                                             |
| ------ | -------------- | ---- | --------------------------------------------------- |
| GET    | `/health`      |      | `{ status, storage }`; 503 when the database can't be reached |
| POST   | `/accounts`    |      | Create an account: `{ accountId, code }`            |
| GET    | `/accounts/me` | code | Check a code: `{ accountId, createdAt }`            |
| GET    | `/progress`    | code | `{ revision, updatedAt, snapshot }` (revision 0 = none) |
| PUT    | `/progress`    | code | `{ baseRevision, snapshot }` → `{ revision }` or 409 |

Uploads use optimistic concurrency:

- **Accepted:** a `PUT` is stored only when `baseRevision` matches the stored revision.
- **Conflict:** otherwise the API answers `409` with the stored copy. The app merges the two copies
  (the rules live in `mobile/src/services/sync/snapshot.ts`) and retries.
- **What the server checks:** it validates the envelope and size (512 KB) and stores the snapshot
  as is.

Account creation is rate limited (5 per minute per client by default); everything else allows 120
requests per minute.

## Running

```bash
npm install
cp .env.example .env   # set MONGODB_URI for real storage
npm run build && npm start
# or, during development:
npm run dev
```

Without `MONGODB_URI` the API keeps data in memory, which is fine for development and tests but
lost on restart. With `NODE_ENV=production` it refuses to start without one.

## Production

```bash
docker build -t backgammon-coach-api .
docker run -p 3000:3000 -e MONGODB_URI="mongodb+srv://…" -e TRUST_PROXY=1 backgammon-coach-api
```

- **Database:** a managed MongoDB (for example Atlas) with backups enabled. The API creates its
  indexes at startup.
- **Behind a load balancer:** set `TRUST_PROXY` to the number of proxies (usually 1), otherwise
  every client shares one rate limit.
- **Health:** point the platform's health check at `/v1/health`.
- **Secrets:** only `MONGODB_URI`. Backup codes are never stored, only their hashes; logs contain
  no codes or progress.
- **Logs:** Nest's logger to stdout (start-up, storage choice, errors).

## Checks

```bash
npm test          # API end-to-end (supertest) and unit tests, on in-memory storage
npm run typecheck
```

`src/storage/repositories.ts` defines the storage contract. Memory and MongoDB
(`mongo.repositories.ts`) implement it; MongoDB uses a unique index on the code hash and
compare-and-swap updates on the revision.
