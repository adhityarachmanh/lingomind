-- CreateTable
CREATE TABLE "cached_stories" (
    "id" SERIAL NOT NULL,
    "language" VARCHAR(50) NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "goal" VARCHAR(100) NOT NULL,
    "content_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cached_stories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cached_stories_language_level_goal_key" ON "cached_stories"("language", "level", "goal");

-- CreateTable
CREATE TABLE "cached_pronunciations" (
    "id" SERIAL NOT NULL,
    "language" VARCHAR(50) NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "content_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cached_pronunciations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cached_pronunciations_language_level_key" ON "cached_pronunciations"("language", "level");
