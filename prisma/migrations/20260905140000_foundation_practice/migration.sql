CREATE TABLE "FoundationPracticeEvent" (
    "sequence" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoundationPracticeEvent_pkey" PRIMARY KEY ("sequence")
);
CREATE UNIQUE INDEX "FoundationPracticeEvent_userId_eventId_key" ON "FoundationPracticeEvent"("userId", "eventId");
CREATE INDEX "FoundationPracticeEvent_userId_sequence_idx" ON "FoundationPracticeEvent"("userId", "sequence");
ALTER TABLE "FoundationPracticeEvent" ADD CONSTRAINT "FoundationPracticeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
