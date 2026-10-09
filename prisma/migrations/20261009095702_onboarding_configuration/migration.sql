-- CreateEnum
CREATE TYPE "ConfigSource" AS ENUM ('COPY', 'BLANK');

-- AlterTable
ALTER TABLE "Division" ADD COLUMN     "configSource" "ConfigSource";
