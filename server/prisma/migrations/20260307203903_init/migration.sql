-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('SHONEN', 'SEINEN', 'MECHA', 'SHOJO');

-- CreateEnum
CREATE TYPE "AiModel" AS ENUM ('GEMINI_2_FLASH', 'GEMINI_1_5_PRO', 'CLAUDE_3_5_SONNET', 'CLAUDE_3_OPUS', 'LLAMA_3', 'MIDJOURNEY', 'IMAGEN_3', 'COMET');

-- CreateEnum
CREATE TYPE "PanelType" AS ENUM ('NARRATION', 'DIALOGUE', 'IMAGE_PANEL', 'SFX');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manga_projects" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "genre" "Genre" NOT NULL,
    "original_prompt" TEXT NOT NULL,
    "ai_model_used" "AiModel" NOT NULL,
    "cover_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manga_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manga_pages" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manga_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panels" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "type" "PanelType" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "manga_projects_user_id_idx" ON "manga_projects"("user_id");

-- CreateIndex
CREATE INDEX "manga_pages_project_id_idx" ON "manga_pages"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "manga_pages_project_id_page_number_key" ON "manga_pages"("project_id", "page_number");

-- CreateIndex
CREATE INDEX "panels_page_id_idx" ON "panels"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "panels_page_id_order_index_key" ON "panels"("page_id", "order_index");

-- AddForeignKey
ALTER TABLE "manga_projects" ADD CONSTRAINT "manga_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manga_pages" ADD CONSTRAINT "manga_pages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "manga_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panels" ADD CONSTRAINT "panels_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "manga_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
