import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getServiceHealth(serviceId: number) {
  const now = new Date();

  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

  
  const [latestMetric] = await prisma.metric.findMany({
    where: { serviceId },
    orderBy: { timestamp: "desc" },
    take: 1,
  });

  
  const recentAnomalies = await prisma.anomaly.findMany({
    where: {
      serviceId,
      timestamp: { gte: fiveMinAgo },
    },
    orderBy: { timestamp: "desc" },
  });

  
  const recentDeploy = await prisma.deployEvent.findFirst({
    where: {
      serviceId,
      timestamp: { gte: tenMinAgo },
    },
    orderBy: { timestamp: "desc" },
  });

  
  let risk = 0;

  if (recentAnomalies.length > 0) risk += 0.4;
  risk += Math.min(0.4, recentAnomalies.length * 0.2);
  if (recentDeploy) risk += 0.2;

  risk = Math.min(1, risk);

  let status: "HEALTHY" | "DEGRADED" | "CRITICAL" = "HEALTHY";
  if (risk >= 0.6) status = "CRITICAL";
  else if (risk >= 0.3) status = "DEGRADED";

  return {
    status,
    riskScore: Number(risk.toFixed(2)),
    latestMetrics: latestMetric || null,
    recentAnomalies,
    recentDeploy,
  };
}
