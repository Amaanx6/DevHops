-- CreateTable
CREATE TABLE "AnomalyCause" (
    "id" SERIAL NOT NULL,
    "anomalyId" INTEGER NOT NULL,
    "deployId" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnomalyCause_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AnomalyCause" ADD CONSTRAINT "AnomalyCause_anomalyId_fkey" FOREIGN KEY ("anomalyId") REFERENCES "Anomaly"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyCause" ADD CONSTRAINT "AnomalyCause_deployId_fkey" FOREIGN KEY ("deployId") REFERENCES "DeployEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
