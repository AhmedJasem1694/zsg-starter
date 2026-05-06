-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlaybookRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL DEFAULT 'COMMERCIAL_CONTRACT',
    "clauseCategory" TEXT NOT NULL,
    "preferredPosition" TEXT NOT NULL,
    "acceptableFallback" TEXT NOT NULL,
    "hardRedLine" TEXT NOT NULL,
    "approvalRequired" TEXT,
    "fallbackTemplate" TEXT,
    "riskWeight" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlaybookRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlaybookRule" ("acceptableFallback", "approvalRequired", "clauseCategory", "companyId", "createdAt", "fallbackTemplate", "hardRedLine", "id", "preferredPosition", "riskWeight", "updatedAt") SELECT "acceptableFallback", "approvalRequired", "clauseCategory", "companyId", "createdAt", "fallbackTemplate", "hardRedLine", "id", "preferredPosition", "riskWeight", "updatedAt" FROM "PlaybookRule";
DROP TABLE "PlaybookRule";
ALTER TABLE "new_PlaybookRule" RENAME TO "PlaybookRule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
