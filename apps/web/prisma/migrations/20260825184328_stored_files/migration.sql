-- CreateEnum
CREATE TYPE "StoredFilePurpose" AS ENUM ('AVATAR');

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "ownerId" UUID,
    "purpose" "StoredFilePurpose" NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stored_files_ownerId_purpose_idx" ON "stored_files"("ownerId", "purpose");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
