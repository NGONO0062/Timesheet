-- AlterTable
ALTER TABLE "AttendanceSheet" ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN     "cancelledAt" TIMESTAMP(3);
