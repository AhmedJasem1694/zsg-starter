-- CreateTable
CREATE TABLE "LitigationIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "hardStopData" TEXT NOT NULL DEFAULT '',
    "defenceData" TEXT NOT NULL DEFAULT '',
    "fraudFlag" BOOLEAN NOT NULL DEFAULT false,
    "fcaBreach" BOOLEAN NOT NULL DEFAULT false,
    "vulnerableCustomer" BOOLEAN NOT NULL DEFAULT false,
    "hardStopPassed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LitigationIntake_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AncillaryDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "privilegeFlag" BOOLEAN NOT NULL DEFAULT false,
    "transcription" TEXT,
    "transcriptionConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AncillaryDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LitigationIntake_documentId_key" ON "LitigationIntake"("documentId");
