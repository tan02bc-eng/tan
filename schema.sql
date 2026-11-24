CREATE TABLE IF NOT EXISTS configuration (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  password_hash TEXT NOT NULL, created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS auth_attempts (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  price BIGINT NOT NULL CHECK (price > 0), bp DOUBLE PRECISION NOT NULL DEFAULT 0,
  fc BIGINT NOT NULL DEFAULT 0, mnf SMALLINT NOT NULL DEFAULT 0, ttt SMALLINT NOT NULL DEFAULT 1,
  coach TEXT NOT NULL DEFAULT '', event TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '', credential_cipher TEXT,
  status TEXT NOT NULL DEFAULT 'draft', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL, product_id TEXT NOT NULL REFERENCES products(id),
  product_snapshot TEXT NOT NULL, total BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  request_key TEXT NOT NULL, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, completed_at BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_request_idx ON orders(user_id,request_key);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_product_idx ON orders(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_pending_product ON orders(product_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS upload_objects (
  key TEXT PRIMARY KEY, url TEXT NOT NULL, content_type TEXT NOT NULL, created_at BIGINT NOT NULL
);
