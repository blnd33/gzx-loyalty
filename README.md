# GZX Loyalty — Online Server Edition

An online staff website for customer registration, loyalty cards, paid hours, and reward redemption. This edition uses SQLite on a persistent server disk, with local staff accounts and no Supabase dependency.

Customers can open their private card link or printed QR without a staff account to see their card, progress, and available reward. Staff share it using Customer view or Copy customer link. Only staff can change loyalty records. See the customer access section in the deployment guide.

## Deploy on a domain

See [deploy/ONLINE.md](deploy/ONLINE.md) for the complete server and DNS setup.

On a Docker-capable server, in this folder:

```sh
sh deploy/configure.sh loyalty.your-domain.com owner@example.com
docker compose --env-file .env.server up -d --build
```

Use your real hostname. DNS must point to that server, with ports 80/443 reachable. The package includes HTTPS via Caddy, a non-root app container, persistent data and backup volumes, initial owner setup via a secret, health checks, and automatic startup/daily snapshots. No personal credentials or existing customer database are included in the package.

The data volume survives normal restarts, rebuilds, and container replacement. Keep backups off the server as well. Do not delete the volumes or run `docker compose down -v`.

The app is intended for one server and one app replica. Static-only hosting and temporary-disk/serverless deployments are not supported by this SQLite configuration. A free domain does not supply the server or persistent storage.

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
