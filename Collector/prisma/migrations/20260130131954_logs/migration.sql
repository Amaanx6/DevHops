-- CreateTable
CREATE TABLE "LogEvent" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "deployId" INTEGER,
    "provider" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogEvent_serviceId_timestamp_idx" ON "LogEvent"("serviceId", "timestamp");

-- CreateIndex
CREATE INDEX "LogEvent_deployId_idx" ON "LogEvent"("deployId");

-- CreateIndex
CREATE INDEX "LogEvent_level_idx" ON "LogEvent"("level");

-- CreateIndex
CREATE INDEX "LogEvent_provider_source_idx" ON "LogEvent"("provider", "source");

-- AddForeignKey
ALTER TABLE "LogEvent" ADD CONSTRAINT "LogEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogEvent" ADD CONSTRAINT "LogEvent_deployId_fkey" FOREIGN KEY ("deployId") REFERENCES "DeployEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
