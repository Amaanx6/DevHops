import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LOOKBACK_MINUTES = 15;

export async function correlateAnomaly(anomalyId: number) {
  const anomaly = await prisma.anomaly.findUnique({
    where: { id: anomalyId },
    include: { service: true },
  });

  if (!anomaly) return;

  const since = new Date(
    anomaly.timestamp.getTime() - LOOKBACK_MINUTES * 60 * 1000,
  );

  const deploys = await prisma.deployEvent.findMany({
    where: {
      serviceId: anomaly.serviceId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "desc" },
  });

  for (const deploy of deploys) {
    const minutesDiff =
      (anomaly.timestamp.getTime() - deploy.timestamp.getTime()) / 1000 / 60;

    const confidence = Math.max(0.2, 1 - minutesDiff / LOOKBACK_MINUTES);

    await prisma.anomalyCause.create({
      data: {
        anomalyId: anomaly.id,
        deployId: deploy.id,
        confidence,
        reason: `Anomaly occurred ${minutesDiff.toFixed(
          1,
        )} min after deployment ${deploy.version}`,
      },
    });

    console.log(
      `🔗 Correlated anomaly ${anomaly.id} with deploy ${deploy.version}`,
    );
  }

  console.log("🔍 Correlating anomaly:", anomalyId);

  console.log("Looking for deploys after:", since.toISOString());

  console.log("Deploys found:", deploys.length);
}
