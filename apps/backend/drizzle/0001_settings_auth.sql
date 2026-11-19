-- Adds authentication settings, user preferences, and server sessions.
CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "confirm_delete" boolean DEFAULT true NOT NULL,
  "access_mode" text DEFAULT 'anonymous' NOT NULL,
  "username" text,
  "password_hash" text
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
