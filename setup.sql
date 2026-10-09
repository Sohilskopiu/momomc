-- MOMO MC database setup (PostgreSQL). Safe to run more than once.
CREATE TABLE IF NOT EXISTS "settings" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "products" (
  "id" serial PRIMARY KEY,
  "mode" text NOT NULL DEFAULT 'lifesteal',
  "category" text NOT NULL,
  "name" text NOT NULL,
  "price" integer,
  "old_price" integer,
  "icon" text NOT NULL DEFAULT '👑',
  "tag" text NOT NULL DEFAULT '',
  "color" text NOT NULL DEFAULT '#43dcff',
  "perks" jsonb NOT NULL DEFAULT '[]',
  "popular" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "duration_days" integer,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "staff" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "color" text NOT NULL DEFAULT '#43dcff',
  "discord" text NOT NULL DEFAULT '',
  "bio" text NOT NULL DEFAULT '',
  "sort_order" integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "announcements" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "tag" text NOT NULL DEFAULT 'News',
  "pinned" boolean NOT NULL DEFAULT false,
  "source" text NOT NULL DEFAULT 'web',
  "author" text NOT NULL DEFAULT 'MOMO MC',
  "discord_message_id" text UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "orders" (
  "id" serial PRIMARY KEY,
  "mc_username" text NOT NULL,
  "discord_name" text NOT NULL DEFAULT '',
  "product_id" integer,
  "product_name" text NOT NULL,
  "category" text NOT NULL,
  "price" integer,
  "note" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'pending',
  "mode" text NOT NULL DEFAULT 'lifesteal',
  "items" jsonb NOT NULL DEFAULT '[]',
  "discord_id" text NOT NULL DEFAULT '',
  "channel_id" text NOT NULL DEFAULT '',
  "proof_url" text NOT NULL DEFAULT '',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "redeem_codes" (
  "id" serial PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "mode" text NOT NULL,
  "title" text NOT NULL,
  "icon" text NOT NULL DEFAULT '🎁',
  "description" text NOT NULL DEFAULT '',
  "commands" jsonb NOT NULL DEFAULT '[]',
  "max_uses" integer,
  "per_player" boolean NOT NULL DEFAULT true,
  "uses" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "redeem_claims" (
  "id" serial PRIMARY KEY,
  "code_id" integer NOT NULL,
  "code" text NOT NULL,
  "mode" text NOT NULL,
  "mc_username" text NOT NULL,
  "discord_id" text NOT NULL DEFAULT '',
  "discord_name" text NOT NULL DEFAULT '',
  "title" text NOT NULL,
  "icon" text NOT NULL DEFAULT '🎁',
  "commands" jsonb NOT NULL DEFAULT '[]',
  "status" text NOT NULL DEFAULT 'pending',
  "note" text NOT NULL DEFAULT '',
  "uniq_key" text UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "delivered_at" timestamp
);
