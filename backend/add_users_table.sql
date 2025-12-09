-- backend/sql/add_users_table.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'moder',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);
