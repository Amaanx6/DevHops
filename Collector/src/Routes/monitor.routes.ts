import express from "express";
import { PrismaClient } from "@prisma/client";
import { getServiceHealth } from "../services/healthEngine";

export const monitorRouter = express.Router();
const prisma = new PrismaClient();

monitorRouter.post("/register-service", async (req, res) => {
  const { name, metricsUrl, authHeader, provider } = req.body;
  if (!name || !metricsUrl) {
    return res.status(400).json({
      error: "name and metricsUrl required",
    });
  }
  try {
    const service = await prisma.service.upsert({
      where: { name: String(name) },
      update: {
        url: String(metricsUrl),
        authHeader: authHeader ? String(authHeader) : null,
        provider: provider ? String(provider) : null,
      },
      create: {
        name: String(name),
        url: String(metricsUrl),
        authHeader: authHeader ? String(authHeader) : null,
        provider: provider ? String(provider) : null,
      },
    });
    return res.json({
      id: service.id,
      name: service.name,
      url: service.url,
      provider: service.provider,
      authConfigured: !!service.authHeader,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Failed to register service:", errorMessage);
    return res.status(500).json({ error: "failed to register service" });
  }
});

monitorRouter.post("/deploy-event", async (req, res) => {
  const { service, version } = req.body;

  if (!service || !version) {
    return res.status(400).json({ error: "service and version required" });
  }

  try {
    const svc = await prisma.service.findUnique({
      where: { name: service },
    });

    if (!svc) {
      return res.status(404).json({ error: "service not found" });
    }

    const deploy = await prisma.deployEvent.create({
      data: {
        version,
        serviceId: svc.id,
        timestamp: new Date(),
      },
    });

    res.json(deploy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to store deploy event" });
  }
});

monitorRouter.get("/metrics/:service", async (req, res) => {
  const { service } = req.params;

  try {
    const svc = await prisma.service.findUnique({
      where: { name: service },
    });

    if (!svc) {
      return res.status(404).json({ error: "service not found" });
    }

    const metrics = await prisma.metric.findMany({
      where: { serviceId: svc.id },
      orderBy: { timestamp: "desc" },
      take: 200,
    });

    res.json(metrics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to fetch metrics" });
  }
});


monitorRouter.get("/anomalies/:service", async (req, res) => {
  const { service } = req.params;

  try {
    const svc = await prisma.service.findUnique({
      where: { name: service },
    });

    if (!svc) {
      return res.status(404).json({ error: "service not found" });
    }

    const anomalies = await prisma.anomaly.findMany({
      where: { serviceId: svc.id },
      orderBy: { timestamp: "desc" },
      take: 50,
    });

    res.json(anomalies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to fetch anomalies" });
  }
});

monitorRouter.get("/anomaly-causes/:anomalyId", async (req, res) => {
  const anomalyId = Number(req.params.anomalyId);

  try {
    const causes = await prisma.anomalyCause.findMany({
      where: { anomalyId },
      include: { deployEvent: true },
      orderBy: { confidence: "desc" },
    });

    res.json(causes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to fetch causes" });
  }
});

monitorRouter.get("/health/:service", async (req, res) => {
  const { service } = req.params;

  try {
    const svc = await prisma.service.findUnique({
      where: { name: service },
    });

    if (!svc) {
      return res.status(404).json({ error: "service not found" });
    }

    const health = await getServiceHealth(svc.id);

    res.json({
      service: svc.name,
      ...health,
    });
  } catch (err) {
    console.error("Health error:", err);
    res.status(500).json({ error: "failed to compute health" });
  }
});


