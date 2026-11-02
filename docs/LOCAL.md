# GZX Lounge — Local Loyalty App

The complete lounge app runs on one Windows computer with a SQLite database. No Supabase, cloud database, or API keys are needed. Once installed, normal use works without internet.

## Start

1. Install Node.js **24.14 or later** if this is a new computer.
2. Double-click **Start Lounge.cmd**. On a new computer the first run installs packages and builds the app, so internet is needed for that first run.
3. Open **http://localhost:3000**. The launcher opens it automatically.
4. Your initial owner email and random password are in **data/OWNER-LOGIN.txt**. Sign in and use **My password** to change the password.

The launcher keeps the server running in the background. Use Start Lounge again after restarting Windows. The computer must stay on while using the app. This installation listens only on this computer; it is not published to the internet.

## Daily use

- Customer access: open any customer, then use Customer view or Copy customer link. Their private link and printed QR show read-only progress without staff login. Localhost links work on this computer; after online deployment, customers can open the real domain on their phones.

- Dashboard: the four quick actions open the real registration, search, and customer pages.
- New Customer: enter a name, optional phone and notes; a unique six-letter code and QR are issued.
- Scan / Find: scan a card using a camera attached to the computer, or type the code. A USB scanner that types the six-letter code also works.
- Customer: Add 1 paid hour and confirm the payment. The third paid hour unlocks one free hour and one free drink.
- Redeem reward: confirm redemption; the next cycle starts at 0/3. All prior hours and rewards remain in history.
- Print card: prints the front and back; crop marks can be toggled. Download PNG saves artwork; Copy code copies the card code.
- Admins can correct the current cycle's last paid hour with a reason, replace or deactivate cards, and deactivate customers. Cashiers can edit basic customer details.
- Reports: daily, weekly, and monthly counts use Asia/Baghdad dates. Search and date/reward filters use saved records.
- Staff: add cashier/admin logins, edit roles, disable accounts, and reset passwords. Disable/reset invalidates affected sessions. The owner cannot remove their own administrator access.
- Settings: change the displayed lounge name, reward label, card tagline, and lookup limits.

## Backups and recovery

Customer data lives in **data/lounge.sqlite**, together with SQLite's temporary WAL/SHM files. Keep this folder on the computer's local disk, not in a shared network folder. Never commit it to Git.

Every server start saves a consistent snapshot under **backups/** and keeps the newest 30 automatic snapshots. You can also double-click **Backup Lounge.cmd**, or use **Settings → Download database backup**. Copy backups to a USB drive regularly. Backups contain confidential customer data and staff password hashes: keep them private.

Forgotten owner password: double-click **Reset Owner Password.cmd** on the lounge computer. The generated replacement login details are written to **data/OWNER-LOGIN.txt**. Other staff should ask an administrator to reset their password on the Staff page. Email delivery and cloud password reset are not used.

To restore a backup: double-click Stop Lounge.cmd first; preserve the entire current data folder as a recovery copy; create a fresh data folder and copy the chosen backup into it as **lounge.sqlite**. Do not mix old WAL/SHM files with a restored database. Then run Start Lounge. Do not copy a live SQLite database directly; use the app's backup feature.

## Development and verification

```powershell
npm ci
npm run local:init
npm run dev -- --hostname 127.0.0.1
```

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

The database test suite uses its own files under data/tests. The browser suite starts a separate production server on port 3100 with a fresh test database under data/e2e. It never writes sample customers into the real lounge database.

The original Supabase SQL files remain under supabase/ as historical source only. They are not needed or used by this local edition. No cloud credentials should be added.
