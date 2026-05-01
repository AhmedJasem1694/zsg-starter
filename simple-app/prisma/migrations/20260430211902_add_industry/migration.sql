-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "riskAppetite" TEXT NOT NULL,
    "industry" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Company" ("createdAt", "id", "jurisdiction", "name", "riskAppetite", "role", "sector") SELECT "createdAt", "id", "jurisdiction", "name", "riskAppetite", "role", "sector" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
