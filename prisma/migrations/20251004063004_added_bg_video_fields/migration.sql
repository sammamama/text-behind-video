/*
  Warnings:

  - You are about to drop the `VideoText` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."NoBgStatus" AS ENUM ('NOT_STARTED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "public"."VideoText" DROP CONSTRAINT "VideoText_videoId_fkey";

-- AlterTable
ALTER TABLE "public"."Video" ADD COLUMN     "noBgStatus" "public"."NoBgStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "noBgUrl" TEXT,
ADD COLUMN     "replicateId" TEXT;

-- DropTable
DROP TABLE "public"."VideoText";

-- CreateIndex
CREATE INDEX "Video_userId_idx" ON "public"."Video"("userId");

-- CreateIndex
CREATE INDEX "Video_url_idx" ON "public"."Video"("url");

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "public"."Video"("status");
