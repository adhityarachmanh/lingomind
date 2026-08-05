-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN "scenario_id" TEXT;

-- CreateIndex
CREATE INDEX "scenarios_userId_idx" ON "scenarios"("userId");

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_scenario_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
