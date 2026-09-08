-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "CleaningStatus" AS ENUM ('PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_records" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "cleanedBy" TEXT NOT NULL,
    "cleanedById" UUID,
    "cleanedAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "notes" TEXT,
    "status" "CleaningStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleaning_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_entries" (
    "id" UUID NOT NULL,
    "cleaningRecordId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorId" UUID,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_changes" (
    "id" UUID NOT NULL,
    "auditEntryId" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,

    CONSTRAINT "audit_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment"("code");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "cleaning_records_equipmentId_cleanedAt_id_idx" ON "cleaning_records"("equipmentId", "cleanedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "cleaning_records_equipmentId_status_cleanedAt_id_idx" ON "cleaning_records"("equipmentId", "status", "cleanedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_entries_cleaningRecordId_createdAt_id_idx" ON "audit_entries"("cleaningRecordId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_changes_auditEntryId_idx" ON "audit_changes"("auditEntryId");

-- AddForeignKey
ALTER TABLE "cleaning_records" ADD CONSTRAINT "cleaning_records_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_records" ADD CONSTRAINT "cleaning_records_cleanedById_fkey" FOREIGN KEY ("cleanedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_cleaningRecordId_fkey" FOREIGN KEY ("cleaningRecordId") REFERENCES "cleaning_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_changes" ADD CONSTRAINT "audit_changes_auditEntryId_fkey" FOREIGN KEY ("auditEntryId") REFERENCES "audit_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
