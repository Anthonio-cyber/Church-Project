-- AlterEnum
ALTER TYPE "StoredFilePurpose" ADD VALUE 'MESSAGE_ATTACHMENT';

-- AlterTable
ALTER TABLE "stored_files" ADD COLUMN     "conversationId" UUID,
ADD COLUMN     "fileName" TEXT;

-- CreateIndex
CREATE INDEX "stored_files_conversationId_idx" ON "stored_files"("conversationId");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
