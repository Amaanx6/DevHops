import "dotenv/config"
import express, { type Request, type Response, type NextFunction } from "express"
import { PrismaClient } from "@prisma/client"
import axios from "axios"
import cors from "cors"

/* =====================================================
   CONFIG
===================================================== */

const POLL_INTERVAL_MS = 2000
const WINDOW_SIZE = 12
const Z_THRESHOLD = 2.5
const ANOMALY_DEDUPE_MS = 60 * 1000
const HEALTH_WINDOW_MS = 10 * 60 * 1000

const prisma = new PrismaClient()

let polling = false

/* =====================================================
   POLLER
===================================================== */

async function startPoller() {
  console.log("🔁 Poller started")

  setInterval(async () => {
    if (polling) return
    polling = true

    try {
      const services = await prisma.service.findMany()

      for (const svc of services) {
        try {
          let m: any

          /* ---------- MOCK MODE ---------- */
          if (svc.metricsUrl === "mock") {
            const now = Date.now()
            const wave = Math.sin(now / 12000)

            m = {
              cpu: 30 + Math.abs(wave * 25) + Math.random() * 8,
              memory: 45 + Math.abs(Math.cos(now / 15000) * 30),
              latency: 100 + Math.abs(wave * 60),
              error_rate: Math.random() > 0.92 ? Math.random() * 4 : 0,
              timestamp: now
            }
          } else {
            // Increase timeout to 10s and accept text for Prometheus
            const res = await axios.get(svc.metricsUrl, { 
              timeout: 10000,
              headers: { 'Accept': 'text/plain, application/json, */*' }
            })
            
            if (typeof res.data === 'string') {
               // Prometheus Text Format Parsing
               const text = res.data;
               const getVal = (regex: RegExp) => {
                  const match = text.match(regex);
                  // console.log(`Regex ${regex} matched: ${match ? match[1] : 'null'}`);
                  return match ? parseFloat(match[1]) : 0;
               }

               // CPU: Use load1 as proxy for % (assuming 4 cores, typical laptop)
               const load1 = getVal(/^node_load1 ([\d\.]+)/m);
               let cpu = (load1 / 4) * 100; // Rough % estimate
               
               // Memory: (Total - Free - Buffers - Cached) / Total
               // Note: node_exporter uses bytes.
               const memTotal = getVal(/^node_memory_MemTotal_bytes ([\d\.e\+]+)/m);
               const memFree = getVal(/^node_memory_MemFree_bytes ([\d\.e\+]+)/m);
               const memBuffers = getVal(/^node_memory_Buffers_bytes ([\d\.e\+]+)/m);
               const memCached = getVal(/^node_memory_Cached_bytes ([\d\.e\+]+)/m);
               
               let memory = 0;
               if (memTotal > 0) {
                   const used = memTotal - memFree - memBuffers - memCached;
                   memory = (used / memTotal) * 100;
               }

               // Latency: Synthesize or use a placeholder as node_exporter is static stats
               const latency = 20 + Math.random() * 5;

               // Error Rate: node_network_receive_errs_total
               const errs = getVal(/^node_network_receive_errs_total ([\d\.]+)/m);
               const errorRate = errs > 0 ? 0.1 : 0;

               m = { cpu, memory, latency, errorRate, timestamp: Date.now() };

            } else {
               // JSON Format (Mock or custom exporter)
               m = res.data;
            }
          }
          
          if (svc.metricsUrl !== "mock") {
              // Log parsed values to verify correctness
              const c = Number(m.cpu || 0).toFixed(1);
              const mem = Number(m.memory || (typeof m.memory==='object'?m.memory.percent:0)).toFixed(1);
              console.log(`[${svc.name}] Processed: CPU=${c}%, Mem=${mem}%`);
          }

          /* ---------- NORMALIZE PAYLOAD ---------- */

          // We parse directly in create() but logging helped us see 'memory' might be NaN
          
          const ts = new Date(m.timestamp || Date.now())

          const metricRow = await prisma.metricPoint.create({
            data: {
              serviceId: svc.id,
              cpu: Number(m.cpu) || 0,
              // Handle memory if it comes as object or percent
              memory: Number(typeof m.memory === 'object' ? m.memory.percent : m.memory) || 0,
              latency: Number(m.latency) || 0,
              errorRate: Number(m.error_rate || m.errorRate) || 0,
              timestamp: ts
            }
          })

          await runAnomalyDetection(svc.id, ts)

          await updateHealth(svc.id)
        } catch (err) {
          console.error("poll error for", svc.name, err)
        }
      }
    } finally {
      polling = false
    }
  }, POLL_INTERVAL_MS)
}

/* =====================================================
   ANOMALY ENGINE
===================================================== */

async function runAnomalyDetection(serviceId: string, ts: Date) {
  const window = await prisma.metricPoint.findMany({
    where: { serviceId },
    orderBy: { timestamp: "desc" },
    take: WINDOW_SIZE
  })

  if (window.length < WINDOW_SIZE) return

  const metrics = ["cpu", "memory", "latency", "errorRate"] as const

  for (const metric of metrics) {
    const values = window.map(p => p[metric])
    const mean = values.reduce((a, b) => a + b, 0) / values.length

    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length

    const std = Math.sqrt(variance)

    const latest = window[0]
    const z = std === 0 ? 0 : Math.abs((latest[metric] - mean) / std)

    if (z > Z_THRESHOLD) {
      await createAnomaly(serviceId, metric, latest[metric], mean, z, ts)
    }
  }
}

/* =====================================================
   CREATE + CORRELATE
===================================================== */

async function createAnomaly(
  serviceId: string,
  metric: string,
  value: number,
  baseline: number,
  zScore: number,
  timestamp: Date
) {
  const recent = await prisma.anomaly.findFirst({
    where: {
      serviceId,
      metric,
      timestamp: {
        gte: new Date(timestamp.getTime() - ANOMALY_DEDUPE_MS)
      }
    }
  })

  if (recent) return

  const anomaly = await prisma.anomaly.create({
    data: {
      serviceId,
      metric,
      value,
      baseline,
      zScore,
      timestamp
    }
  })

  const events = await prisma.changeEvent.findMany({
    where: {
      serviceId,
      timestamp: {
        gte: new Date(timestamp.getTime() - 15 * 60 * 1000),
        lte: timestamp
      }
    },
    orderBy: { timestamp: "desc" }
  })

  if (events.length) {
    const closest = events[0]

    await prisma.anomaly.update({
      where: { id: anomaly.id },
      data: {
        correlatedCommit: closest.commit,
        confidence: 0.8
      }
    })
  }
}

/* =====================================================
   HEALTH ENGINE
===================================================== */

async function updateHealth(serviceId: string) {
  const recent = await prisma.anomaly.findMany({
    where: {
      serviceId,
      timestamp: {
        gte: new Date(Date.now() - HEALTH_WINDOW_MS)
      }
    }
  })

  let status = "healthy"
  let score = 100

  if (recent.length >= 3) {
    status = "critical"
    score = 30
  } else if (recent.length > 0) {
    status = "degrading"
    score = 65
  }

  await prisma.healthSnapshot.create({
    data: {
      serviceId,
      status,
      score,
      timestamp: new Date()
    }
  })
}

/* =====================================================
   EXPRESS APP
===================================================== */

const app = express()

app.use(express.json())
app.use(cors({ origin: "*" }))
app.use(express.urlencoded({ extended: true }))

const PORT = Number(process.env.PORT) || 5000

app.get("/", (_req, res) => {
  res.send("🧠 DevHops Collector running")
})

/* =====================================================
   REGISTER NODE
===================================================== */

app.post("/api/register-node", async (req: Request, res: Response) => {
  try {
    const { name, metricsUrl } = req.body || {}

    if (!name || !metricsUrl) {
      return res.status(400).json({ error: "name and metricsUrl required" })
    }

    const existing = await prisma.service.findUnique({ where: { name } })

    if (existing) {
      return res.status(409).json({ error: "node already registered" })
    }

    const node = await prisma.service.create({
      data: {
        name,
        metricsUrl,
        repoUrl: null
      }
    })

    res.json(node)
  } catch (err) {
    console.error("register-node error", err)
    res.status(500).json({ error: "internal server error" })
  }
})

/* =====================================================
   REGISTER SERVICE
===================================================== */

app.post("/api/register-service", async (req: Request, res: Response) => {
  try {
    const { name, metricsUrl, repoUrl } = req.body || {}

    if (!name || !metricsUrl) {
      return res.status(400).json({ error: "name and metricsUrl required" })
    }

    const existing = await prisma.service.findUnique({ where: { name } })

    if (existing) {
      return res.status(409).json({ error: "service already registered" })
    }

    const service = await prisma.service.create({
      data: {
        name,
        metricsUrl,
        repoUrl
      }
    })

    res.json(service)
  } catch (err) {
    console.error("register-service error", err)
    res.status(500).json({ error: "internal server error" })
  }
})

/* =====================================================
   CHANGE EVENT
===================================================== */

app.post("/api/change-event", async (req: Request, res: Response) => {
  try {
    const { service, commit, message, timestamp } = req.body || {}

    if (!service || !commit) {
      return res.status(400).json({ error: "service and commit required" })
    }

    const svc = await prisma.service.findUnique({ where: { name: service } })

    if (!svc) {
      return res.status(404).json({ error: "service not registered" })
    }

    const event = await prisma.changeEvent.create({
      data: {
        serviceId: svc.id,
        commit,
        message,
        timestamp: timestamp ? new Date(timestamp) : new Date()
      }
    })

    res.json(event)
  } catch (err) {
    console.error("change-event error", err)
    res.status(500).json({ error: "internal server error" })
  }
})

/* =====================================================
   LIST SERVICES
===================================================== */

app.get("/api/services", async (_req, res) => {
  const services = await prisma.service.findMany({
    orderBy: { createdAt: "asc" }
  })

  res.json(services)
})

/* =====================================================
   GET METRICS
===================================================== */

app.get("/api/metrics/:service", async (req, res) => {
  const name = req.params.service

  const svc = await prisma.service.findUnique({ where: { name } })

  if (!svc) return res.status(404).json({ error: "service not found" })

  const points = await prisma.metricPoint.findMany({
    where: { serviceId: svc.id },
    orderBy: { timestamp: "desc" },
    take: 200
  })

  res.json(points.reverse())
})

/* =====================================================
   GET ANOMALIES
===================================================== */

app.get("/api/anomalies/:service", async (req, res) => {
  const name = req.params.service

  const svc = await prisma.service.findUnique({ where: { name } })

  if (!svc) return res.status(404).json({ error: "service not found" })

  const rows = await prisma.anomaly.findMany({
    where: { serviceId: svc.id },
    orderBy: { timestamp: "desc" }
  })

  res.json(rows)
})

/* =====================================================
   GET HEALTH
===================================================== */

app.get("/api/health/:service", async (req, res) => {
  const name = req.params.service

  const svc = await prisma.service.findUnique({ where: { name } })

  if (!svc) return res.status(404).json({ error: "service not found" })

  const latest = await prisma.healthSnapshot.findFirst({
    where: { serviceId: svc.id },
    orderBy: { timestamp: "desc" }
  })

  res.json(
    latest || {
      service: name,
      status: "unknown",
      score: 0
    }
  )
})

/* =====================================================
   GLOBAL ERROR
===================================================== */

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("global error:", err)
    res.status(500).json({ error: "unexpected error" })
  }
)

/* =====================================================
   SHUTDOWN
===================================================== */

process.on("SIGINT", async () => {
  console.log("🛑 shutting down prisma")
  await prisma.$disconnect()
  process.exit(0)
})

/* =====================================================
   START
===================================================== */

app.listen(PORT, () => {
  console.log(`🧠 Collector running on ${PORT}`)
  startPoller()
})
