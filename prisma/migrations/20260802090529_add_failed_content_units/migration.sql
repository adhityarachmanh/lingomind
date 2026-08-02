-- CreateTable
CREATE TABLE "failed_content_units" (
    "id" SERIAL NOT NULL,
    "language" VARCHAR(50) NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "goal" VARCHAR(100) NOT NULL,
    "part" INTEGER NOT NULL,
    "modifier" VARCHAR(50) NOT NULL DEFAULT 'normal',
    "failures" INTEGER NOT NULL DEFAULT 1,
    "lastFailedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_content_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "failed_content_units_language_level_goal_part_modifier_key" ON "failed_content_units"("language", "level", "goal", "part", "modifier");
