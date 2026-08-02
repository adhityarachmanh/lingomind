-- CreateTable
CREATE TABLE "content_generation_jobs" (
    "id" SERIAL NOT NULL,
    "language" VARCHAR(50) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_generation_jobs_language_status_idx" ON "content_generation_jobs"("language", "status");
