import { PrismaClient, Metric } from "@prisma/client";
import { correlateAnomaly } from "./correlationEngine";

const prisma = new PrismaClient();

const WINDOW = 20; // rolling baseline size

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[], m: number): number {
  const variance =
    arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

export async function analyzeLatest(serviceId: number): Promise<void> {
  const metrics: Metric[] = await prisma.metric.findMany({
    where: { serviceId },
    orderBy: { timestamp: "desc" },
    take: WINDOW,
  });

  // Warm-up phase
  if (metrics.length < WINDOW) return;

  const fields = ["cpu", "memory", "latency", "errorRate"] as const;

  for (const field of fields) {
    const values = metrics.map((m) => m[field]);
    const latest = values[0];

    const baseline = mean(values.slice(1));
    const deviation = std(values.slice(1), baseline);

    if (deviation === 0) continue;

    const zScore = Math.abs(latest - baseline) / deviation;

    if (zScore > 3) {
      
      const anomaly = await prisma.anomaly.create({
        data: {
          serviceId,
          metric: field,
          value: latest,
          baseline,
          severity: zScore,
        },
      });

      console.log(
        `🚨 ANOMALY → svc=${serviceId} ${field}=${latest.toFixed(
          2
        )} baseline=${baseline.toFixed(2)} z=${zScore.toFixed(2)}`
      );

      
      await correlateAnomaly(anomaly.id);
    }
  }
}
