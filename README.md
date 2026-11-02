# GZX Loyalty — Online Server Edition

An online staff website for customer registration, loyalty cards, paid hours, and reward redemption. This edition uses SQLite on a persistent server disk, with local staff accounts and no Supabase dependency.

Customers can open their private card link or printed QR without a staff account to see their card, progress, and available reward. Staff share it using Customer view or Copy customer link. Only staff can change loyalty records. See the customer access section in the deployment guide.

## Deploy on a domain

### Netlify

This app supports Netlify using its built-in managed Postgres database. The `@netlify/database` dependency enables provisioning, and Netlify applies `netlify/database/migrations/` during deployment. Customer records and sessions live in Postgres, not a function's temporary filesystem.

Set these Netlify environment variables for builds and functions: `DATABASE_PROVIDER=netlify`, `DEPLOYMENT_MODE=server`, `APP_URL=https://your-site.netlify.app`, `OWNER_EMAIL`, and a private `OWNER_INITIAL_PASSWORD` (10–72 characters). Set `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` for functions. The owner is created on the first sign-in against an empty database; subsequent deploys never reset its password. Netlify supplies `NETLIFY_DB_URL` automatically. Keep all credentials out of Git.

Netlify handles HTTPS. Staff and private customer cards share the same persistent database. The Settings backup download is a JSON export on Netlify; Docker's scheduled SQLite backups apply only to the Docker edition. Netlify Database uses the team's platform credits; this does not promise unlimited free hosting.

### Docker server

See [deploy/ONLINE.md](deploy/ONLINE.md) for the complete server and DNS setup.

On a Docker-capable server, in this folder:

```sh
sh deploy/configure.sh loyalty.your-domain.com owner@example.com
docker compose --env-file .env.server up -d --build
```

Use your real hostname. DNS must point to that server, with ports 80/443 reachable. The package includes HTTPS via Caddy, a non-root app container, persistent data and backup volumes, initial owner setup via a secret, health checks, and automatic startup/daily snapshots. No personal credentials or existing customer database are included in the package.

The data volume survives normal restarts, rebuilds, and container replacement. Keep backups off the server as well. Do not delete the volumes or run `docker compose down -v`.

The SQLite/Docker edition is intended for one server and one app replica. For Netlify, use the Postgres setup above. Static-only hosting cannot run the application. A free domain does not supply the server or persistent storage.

## Develop or test locally

Requires Node.js 24.14+:

```sh
npm ci
npm run local:init
npm run dev
```

For a built local preview use `npm run start:local`. `npm start` launches the online server and requires its deployment environment. The Windows Start Lounge launcher still runs the local edition; see [docs/LOCAL.md](docs/LOCAL.md).

```sh
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

See the deployment guide for owner recovery, backups, updates, and changing a domain. The historical Supabase SQL under supabase/ is unused by this edition.
