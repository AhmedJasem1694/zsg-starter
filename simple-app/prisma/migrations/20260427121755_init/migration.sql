-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "riskAppetite" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlaybookRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "ApprovalContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    CONSTRAINT "ApprovalContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UploadedDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedClause" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "clauseCategory" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalisedSummary" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ExtractedClause_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "clauseId" TEXT,
    "ruleId" TEXT,
    "clauseCategory" TEXT NOT NULL,
    "ragStatus" TEXT NOT NULL,
    "clauseSummary" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "suggestedFallback" TEXT NOT NULL,
    "escalationRequired" BOOLEAN NOT NULL DEFAULT false,
    "escalationTrigger" TEXT,
    "businessSummary" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewResult_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "ExtractedClause" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewResult_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PlaybookRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resultId" TEXT NOT NULL,
    "userAction" TEXT NOT NULL,
    "editedOutput" TEXT,
    "finalClauseText" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFeedback_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ReviewResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFeedback_resultId_key" ON "UserFeedback"("resultId");
