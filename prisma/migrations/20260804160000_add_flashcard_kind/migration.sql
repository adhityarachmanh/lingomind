-- AlterTable
ALTER TABLE "flashcards" ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'quiz';

-- CreateIndex
CREATE INDEX "flashcards_email_kind_due_at_idx" ON "flashcards"("email", "kind", "due_at");
