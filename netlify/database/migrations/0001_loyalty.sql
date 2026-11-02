CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin','cashier')), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, staff_id TEXT NOT NULL REFERENCES staff(id), expires_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100), phone TEXT, notes TEXT,
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_visit_at TEXT);
    CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), code TEXT NOT NULL UNIQUE,
      qr_token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active', status_reason TEXT, created_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS one_current_card ON cards(customer_id) WHERE status != 'replaced';
    CREATE TABLE IF NOT EXISTS cycles (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cycle_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','redeemed')), UNIQUE(customer_id,cycle_number));
    CREATE UNIQUE INDEX IF NOT EXISTS one_open_cycle ON cycles(customer_id) WHERE status != 'redeemed';
    CREATE TABLE IF NOT EXISTS punches (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cycle_id TEXT NOT NULL REFERENCES cycles(id),
      slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3), staff_id TEXT NOT NULL REFERENCES staff(id), created_at TEXT NOT NULL, voided INTEGER NOT NULL DEFAULT 0,
      receipt_reference TEXT, notes TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS one_live_slot ON punches(cycle_id,slot) WHERE voided=0;
    CREATE TABLE IF NOT EXISTS rewards (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cycle_id TEXT NOT NULL UNIQUE REFERENCES cycles(id),
      status TEXT NOT NULL CHECK(status IN ('available','redeemed','revoked')), unlocked_at TEXT NOT NULL, redeemed_at TEXT, staff_id TEXT REFERENCES staff(id));
    CREATE TABLE IF NOT EXISTS history (id BIGSERIAL PRIMARY KEY, customer_id TEXT REFERENCES customers(id), staff_id TEXT REFERENCES staff(id),
      action TEXT NOT NULL, created_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', reason TEXT);
    CREATE TABLE IF NOT EXISTS requests (key TEXT PRIMARY KEY, operation TEXT NOT NULL, customer_id TEXT, staff_id TEXT NOT NULL, result TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (id BIGSERIAL PRIMARY KEY, bucket TEXT NOT NULL, at BIGINT NOT NULL, failed INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS attempts_bucket_time ON attempts(bucket,at);
    CREATE INDEX IF NOT EXISTS history_customer ON history(customer_id,id);
    CREATE INDEX IF NOT EXISTS punches_customer ON punches(customer_id,created_at);
    CREATE INDEX IF NOT EXISTS rewards_status ON rewards(status,unlocked_at);

CREATE UNIQUE INDEX IF NOT EXISTS staff_email_lower ON staff(lower(email));
CREATE FUNCTION gzx_history_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'History is append-only'; END $$;
CREATE TRIGGER history_no_changes BEFORE UPDATE OR DELETE ON history FOR EACH ROW EXECUTE FUNCTION gzx_history_append_only();
