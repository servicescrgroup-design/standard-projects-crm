-- Per-agent Twilio connection for browser calling. Additive only.

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."TwilioConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountSid" TEXT NOT NULL,
    "apiKeySid" TEXT NOT NULL,
    "apiKeySecret" TEXT NOT NULL,
    "appSid" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "record" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwilioConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TwilioConnection_userId_key" ON "public"."TwilioConnection"("userId");

-- AddForeignKey
ALTER TABLE "public"."TwilioConnection" ADD CONSTRAINT "TwilioConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."TwilioConnection" ENABLE ROW LEVEL SECURITY;
