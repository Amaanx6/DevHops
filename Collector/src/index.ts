import express, { type Request, type Response, type NextFunction } from "express"
import { PrismaClient } from "@prisma/client"
import axios from "axios"

const POLL_INTERVAL_MS = 5000
const WINDOW_SIZE = 12
const Z_THRESHOLD = 2.5

const prisma = new PrismaClient()

async function startPoller() {
  console.log("🔁 Poller started")

  setInterval(async () => {
    const services = await prisma.service.findMany()

    for (const svc of services) {
      try {
        const res = await axios.get(svc.metricsUrl, { timeout: 3000 })
        const m = res.data

        const metricRow = await prisma.metricPoint.create({
          data: {
            serviceId: svc.id,
            cpu: m.cpu,
            memory: m.memory,
            latency: m.latency,
            errorRate: m.error_rate,
            timestamp: new Date(m.timestamp || Date.now())
          }
        })

        await runAnomalyDetection(svc.id, metricRow.timestamp)
      } catch (err) {
        console.error("poll error for", svc.name, err)
      }
    }
  }, POLL_INTERVAL_MS)
}


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


async function createAnomaly(
  serviceId: string,
  metric: string,
  value: number,
  baseline: number,
  zScore: number,
  timestamp: Date
) {
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

  await updateHealth(serviceId)
}


async function updateHealth(serviceId: string) {
  const recent = await prisma.anomaly.findMany({
    where: { serviceId },
    orderBy: { timestamp: "desc" },
    take: 5
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


const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = Number(process.env.PORT) || 5000

/* -------------------------------------------------
   SIMPLE ROOT CHECK
--------------------------------------------------*/

app.get("/", (_req, res) => {
  res.send("🧠 DevHops Collector running")
})

/* -------------------------------------------------
   REGISTER SERVICE
--------------------------------------------------*/

app.post("/api/register-service", async (req: Request, res: Response) => {
  try {
    const { name, metricsUrl, repoUrl } = req.body || {}

    if (!name || !metricsUrl) {
      return res.status(400).json({
        error: "name and metricsUrl required"
      })
    }

    const existing = await prisma.service.findUnique({
      where: { name }
    })

    if (existing) {
      return res.status(409).json({
        error: "service already registered"
      })
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

/* -------------------------------------------------
   INGEST CHANGE EVENT
--------------------------------------------------*/

app.post("/api/change-event", async (req: Request, res: Response) => {
  try {
    // Add defensive check for req.body
    if (!req.body) {
      console.error("change-event: req.body is undefined")
      return res.status(400).json({
        error: "request body is required"
      })
    }

    const { service, commit, message, timestamp } = req.body

    if (!service || !commit) {
      return res.status(400).json({
        error: "service and commit required"
      })
    }

    const svc = await prisma.service.findUnique({
      where: { name: service }
    })

    if (!svc) {
      return res.status(404).json({
        error: "service not registered"
      })
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

/* -------------------------------------------------
   LIST SERVICES
--------------------------------------------------*/

app.get("/api/services", async (_req: Request, res: Response) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { createdAt: "asc" }
    })

    res.json(services)
  } catch (err) {
    console.error("list-services error", err)
    res.status(500).json({ error: "internal server error" })
  }
})

/* -------------------------------------------------
   GET METRICS
--------------------------------------------------*/

app.get("/api/metrics/:service", async (req: Request, res: Response) => {
  try {
    const name = Array.isArray(req.params.service) 
      ? req.params.service[0] 
      : req.params.service

    const svc = await prisma.service.findUnique({
      where: { name }
    })

    if (!svc) {
      return res.status(404).json({
        error: "service not found"
      })
    }

    const points = await prisma.metricPoint.findMany({
      where: { serviceId: svc.id },
      orderBy: { timestamp: "desc" },
      take: 200
    })

    res.json(points.reverse())
  } catch (err) {
    console.error("get-metrics error", err)
    res.status(500).json({ error: "internal server error" })
  }
})

/* -------------------------------------------------
   GET ANOMALIES
--------------------------------------------------*/

app.get("/api/anomalies/:service", async (req: Request, res: Response) => {
  try {
    const name = Array.isArray(req.params.service) 
      ? req.params.service[0] 
      : req.params.service

    const svc = await prisma.service.findUnique({
      where: { name }
    })

    if (!svc) {
      return res.status(404).json({
        error: "service not found"
      })
    }

    const rows = await prisma.anomaly.findMany({
      where: { serviceId: svc.id },
      orderBy: { timestamp: "desc" }
    })

    res.json(rows)
  } catch (err) {
    console.error("get-anomalies error", err)
    res.status(500).json({ error: "internal server error" })
  }
})

/* -------------------------------------------------
   GET HEALTH
--------------------------------------------------*/

app.get("/api/health/:service", async (req: Request, res: Response) => {
  try {
    const name = Array.isArray(req.params.service) 
      ? req.params.service[0] 
      : req.params.service

    const svc = await prisma.service.findUnique({
      where: { name }
    })

    if (!svc) {
      return res.status(404).json({
        error: "service not found"
      })
    }

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
  } catch (err) {
    console.error("get-health error", err)
    res.status(500).json({ error: "internal server error" })
  }
})

/* -------------------------------------------------
   GLOBAL ERROR HANDLER
--------------------------------------------------*/

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Global error handler:", err)
    res.status(500).json({ error: "unexpected error" })
  }
)

/* -------------------------------------------------
   SHUTDOWN CLEANUP
--------------------------------------------------*/

process.on("SIGINT", async () => {
  console.log("🛑 shutting down prisma")
  await prisma.$disconnect()
  process.exit(0)
})

/* -------------------------------------------------
   START SERVER
--------------------------------------------------*/

app.listen(PORT, () => {
  console.log(`🧠 Collector running on ${PORT}`)
  // Start the poller after server starts
  startPoller()
})