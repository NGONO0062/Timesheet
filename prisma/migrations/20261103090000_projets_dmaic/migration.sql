-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('STANDARD', 'DMAIC');

-- CreateEnum
CREATE TYPE "DmaicPhase" AS ENUM ('DEFINE', 'MEASURE', 'ANALYZE', 'IMPROVE', 'CONTROL');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "kind" "ProjectKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "phase" "DmaicPhase";

-- CreateTable
CREATE TABLE "ProjectPhaseChange" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phase" "DmaicPhase" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "changedById" TEXT,

    CONSTRAINT "ProjectPhaseChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectPhaseChange_projectId_at_idx" ON "ProjectPhaseChange"("projectId", "at");

-- CreateIndex
CREATE INDEX "ProjectPhaseChange_divisionId_idx" ON "ProjectPhaseChange"("divisionId");

-- AddForeignKey
ALTER TABLE "ProjectPhaseChange" ADD CONSTRAINT "ProjectPhaseChange_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhaseChange" ADD CONSTRAINT "ProjectPhaseChange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhaseChange" ADD CONSTRAINT "ProjectPhaseChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

