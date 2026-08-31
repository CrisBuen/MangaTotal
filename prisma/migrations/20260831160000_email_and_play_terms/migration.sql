ALTER TABLE "users"
ADD COLUMN "email" TEXT,
ADD COLUMN "email_verified_at" TIMESTAMP(3),
ADD COLUMN "anime_terms_accepted_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "account_tokens" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_tokens_token_hash_key" ON "account_tokens"("token_hash");
CREATE INDEX "account_tokens_user_id_kind_created_at_idx"
ON "account_tokens"("user_id", "kind", "created_at");
CREATE INDEX "account_tokens_expires_at_idx" ON "account_tokens"("expires_at");

ALTER TABLE "account_tokens"
ADD CONSTRAINT "account_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
