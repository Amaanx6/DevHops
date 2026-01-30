import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { analyzeLatest } from "./anomalyEngine";

const prisma = new PrismaClient();

export async function startPoller(): Promise<void> {
  console.log("🔄 Poller started");

  setInterval(async () => {
    try {
      const services = await prisma.service.findMany();

      for (const svc of services) {
        try {
          const headers: Record<string, string> = {};

          if (svc.authHeader) {
            headers["Authorization"] = svc.authHeader;
          }

          // scrape metrics
          const res = await axios.get(svc.url, {
            timeout: 3000,
            headers,
          });

          const { cpu, memory, latency, error_rate } = res.data;

          // store metric
          await prisma.metric.create({
            data: {
              serviceId: svc.id,
              cpu: Number(cpu),
              memory: Number(memory),
              latency: Number(latency),
              errorRate: Number(error_rate),
            },
          });

          console.log(
            `📥 [${svc.name}] mem=${memory} lat=${latency}`
          );

          // 🔥 NOW analyze
          await analyzeLatest(svc.id);

        } catch (err: any) {
          const msg =
            err?.response?.status
              ? `HTTP ${err.response.status}`
              : err.message;

          console.error(`❌ Poll ${svc.name}:`, msg);
        }
      }
    } catch (err) {
      console.error("❌ Poller loop error:", err);
    }
  }, 5000);
}
