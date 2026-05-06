-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UploadedDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "counterpartyName" TEXT NOT NULL DEFAULT '',
    "counterpartyType" TEXT NOT NULL DEFAULT '',
    "reviewType" TEXT NOT NULL DEFAULT 'INBOUND',
    "contractValue" REAL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "contractTermMonths" INTEGER,
    "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
    "noticePeriodDays" INTEGER,
    "renewalDate" DATETIME,
    "contractTags" TEXT NOT NULL DEFAULT '',
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UploadedDocument" ("companyId", "contractType", "filename", "id", "originalName", "status", "uploadedAt") SELECT "companyId", "contractType", "filename", "id", "originalName", "status", "uploadedAt" FROM "UploadedDocument";
DROP TABLE "UploadedDocument";
ALTER TABLE "new_UploadedDocument" RENAME TO "UploadedDocument";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
