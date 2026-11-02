# Publish GZX Lounge on your domain

This edition runs online on one Docker-capable Linux server. All staff use the same HTTPS website, and customer records are stored on that server's persistent disk. Supabase is not required. A domain is only the address: the server must remain running for the website to work.

## Requirements

- A server you control with Docker Engine and the Docker Compose plugin installed; persistent local disk; public inbound TCP ports 80 and 443. Allow build memory headroom (2 GB RAM plus swap is a practical starting point).
- A domain or subdomain whose DNS you can edit. An A record must point the chosen hostname to the server's IPv4 address. If you use an AAAA record, it must point to a working IPv6 address on this same server.
- SSH or the hosting provider's terminal access to upload and start the package.

The domain can be free or paid. This package makes no assumption that server hosting is free. Static-only hosting and containers with temporary disks are unsuitable. Run one app replica with its database on the same server; do not share the SQLite file over a network filesystem.

## First deployment

1. Upload and extract GZX-Lounge-Online.zip on the server. Open a terminal in its GZX-Lounge folder.
2. Configure the real hostname (replace loyalty.example.com):

```sh
sh deploy/configure.sh loyalty.example.com owner@example.com
```

If Node.js 24.14+ is already installed, the equivalent command is:

```sh
node deploy/configure.mjs loyalty.example.com owner@example.com
```

This creates .env.server and a random initial password in .secrets/owner_password. It does not publish the password, and it refuses to overwrite an existing deployment configuration. Keep .secrets private and out of source control.

3. With DNS pointing to this server, start the website:

```sh
docker compose --env-file .env.server up -d --build
docker compose --env-file .env.server ps
```

Caddy provisions and renews HTTPS certificates. Your website is https://loyalty.example.com (using the hostname you configured). The app's internal port 3000 is not exposed publicly; only Caddy's ports 80 and 443 are published. Caddy forwards requests to the app and overwrites the client-IP header used for login throttling.

4. Sign in with the owner email you supplied. Read the initial password privately on the server:

```sh
cat .secrets/owner_password
```

Change it using My password, then add staff accounts on Staff. The bootstrap password is used only for an empty database; restarts do not reset it. Staff need only your website link and their staff login. Customers do not need hosting or database accounts.

## Customer access

Open a customer in the staff app and use Customer view or Copy customer link. Customers open the private link or scan their printed QR to see their own loyalty card, current paid-hour progress, and reward status without an account. While visible, the page checks a lightweight private update endpoint every two seconds and reloads card data only when it changes. When staff confirm the first paid hour, the open customer page shows 1/3 and “1 paid hour recorded this cycle” without a click or reload. Rewards, redemption, and card invalidation also update automatically. Network failures retry automatically, and a manual Refresh progress button is available as well.

The printed /c/ QR link opens staff management for signed-in staff and the read-only customer card for everyone else. The /card/ link always opens the customer view, making it suitable to share. Phone numbers, staff notes, receipt references, and staff management controls are excluded. Six-letter codes do not grant public lookup access. Anyone who has a private link can view that card; reissuing or deactivating a card invalidates its old customer link. Deactivating a customer blocks its public card too.

Once deployed on the HTTPS domain, customers can open the link on their own phones. During local testing, localhost links work only on the computer running the app.

## Where records are saved

- gzx-loyalty_lounge_data: all customers, staff password hashes, sessions, loyalty progress, and history.
- gzx-loyalty_lounge_backups: database snapshots, saved at startup and every 24 hours while the app is running; the newest 30 snapshots are retained.
- gzx-loyalty_caddy_data and gzx-loyalty_caddy_config: HTTPS certificate/configuration storage.

These are Docker named volumes, independent of the app image. Normal rebuilds, restarts, and container replacement keep the volumes. **Do not run docker compose down -v, remove these volumes, or delete the server disk**: those actions remove the stored records. A volume survives redeployment; it is not a replacement for a backup away from the server.

Admins can download a complete SQLite backup using Settings → Download database backup. Store a copy outside this server regularly. Backups contain private customer data and staff password hashes.

Manual server backup:

```sh
docker compose --env-file .env.server exec app node --experimental-strip-types scripts/local-backup.mjs
```

## Update or change the domain

Keep .env.server, .secrets, and all volumes when uploading code updates. Then:

```sh
docker compose --env-file .env.server up -d --build
```

To change the domain, first update DNS, edit APP_DOMAIN in .env.server, then run the same command. APP_URL is set from that domain at runtime, so no localhost URLs are printed in new QR cards. Cards already printed with an old hostname require the old domain to redirect to the new hostname; otherwise reprint them. Six-letter codes remain valid.

## Owner recovery

On the server:

```sh
docker compose --env-file .env.server exec app node --experimental-strip-types scripts/local-init.mjs --reset
docker compose --env-file .env.server exec app cat /app/data/OWNER-LOGIN.txt
```

This generates a new owner password and invalidates the owner's sessions. Other staff passwords can be reset from Staff. Reset-by-email is not configured or required.

## Restore a database backup

Take a fresh backup and preserve a copy outside the server before replacing anything. Stop only the app first:

```sh
docker compose --env-file .env.server stop app
```

Use your host's volume management tools to preserve the existing lounge_data volume as a recovery copy, then restore the chosen SQLite snapshot as /app/data/lounge.sqlite in a fresh lounge_data volume owned by uid/gid 1000. Do not copy old WAL/SHM files into the restored database. Restart with the normal up command. Records created after the chosen snapshot are absent from that snapshot.

## Troubleshooting

```sh
docker compose --env-file .env.server logs --tail=100 app web
```

- HTTPS pending: check A/AAAA records, inbound ports 80/443, and Caddy logs.
- App unhealthy: check persistent volume permissions, secret-file availability, and app logs. The app refuses to start when its required online configuration is missing.
- Camera: open the actual HTTPS domain and allow browser camera access. Manual six-letter lookup also works.
- The local Windows launcher is only for local testing. Use the Docker setup for the online website.

## Verification in this workspace

Unit tests cover runtime domains, secure-cookie decisions, fail-closed configuration, bootstrap secrets, unchanged owner passwords across restart, database persistence, backups, authentication, role enforcement, and loyalty transactions. Playwright exercises registration, punches, redemption, history, QR redirects, editing, export/printing pages, backups, staff accounts, password changes, and sign-out against a production Next.js build.

Docker and public DNS/certificate issuance require an actual Docker host. The deployment files are supplied; the website is not live until the package is started on a server and its domain points there.

References: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Docker volumes](https://docs.docker.com/engine/storage/volumes/), [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).
