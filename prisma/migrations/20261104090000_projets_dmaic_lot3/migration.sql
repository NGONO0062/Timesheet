-- CreateEnum
CREATE TYPE "TollgateStatus" AS ENUM ('REQUESTED', 'APPROVED', 'CHANGES_REQUESTED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "kpiBaseline" DECIMAL(14,2),
ADD COLUMN     "kpiCurrent" DECIMAL(14,2),
ADD COLUMN     "kpiName" TEXT,
ADD COLUMN     "kpiTarget" DECIMAL(14,2),
ADD COLUMN     "kpiUnit" TEXT,
ADD COLUMN     "sponsorId" TEXT;

-- CreateTable
CREATE TABLE "ProjectDeliverable" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL,
    "doneById" TEXT,

    CONSTRAINT "ProjectDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTollgate" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phase" "DmaicPhase" NOT NULL,
    "status" "TollgateStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,

    CONSTRAINT "ProjectTollgate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectDeliverable_divisionId_idx" ON "ProjectDeliverable"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDeliverable_projectId_key_key" ON "ProjectDeliverable"("projectId", "key");

-- CreateIndex
CREATE INDEX "ProjectTollgate_projectId_phase_requestedAt_idx" ON "ProjectTollgate"("projectId", "phase", "requestedAt");

-- CreateIndex
CREATE INDEX "ProjectTollgate_divisionId_idx" ON "ProjectTollgate"("divisionId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDeliverable" ADD CONSTRAINT "ProjectDeliverable_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDeliverable" ADD CONSTRAINT "ProjectDeliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDeliverable" ADD CONSTRAINT "ProjectDeliverable_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTollgate" ADD CONSTRAINT "ProjectTollgate_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTollgate" ADD CONSTRAINT "ProjectTollgate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTollgate" ADD CONSTRAINT "ProjectTollgate_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTollgate" ADD CONSTRAINT "ProjectTollgate_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
