"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const POLL_INTERVAL_MS = 5000;
const WINDOW_SIZE = 12;
const Z_THRESHOLD = 2.5;
const prisma = new client_1.PrismaClient();
function startPoller() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🔁 Poller started");
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            const services = yield prisma.service.findMany();
            for (const svc of services) {
                try {
                    const res = yield axios_1.default.get(svc.metricsUrl, { timeout: 3000 });
                    const m = res.data;
                    const metricRow = yield prisma.metricPoint.create({
                        data: {
                            serviceId: svc.id,
                            cpu: m.cpu,
                            memory: m.memory,
                            latency: m.latency,
                            errorRate: m.error_rate,
                            timestamp: new Date(m.timestamp || Date.now())
                        }
                    });
                    yield runAnomalyDetection(svc.id, metricRow.timestamp);
                }
                catch (err) {
                    console.error("poll error for", svc.name, err);
                }
            }
        }), POLL_INTERVAL_MS);
    });
}
function runAnomalyDetection(serviceId, ts) {
    return __awaiter(this, void 0, void 0, function* () {
        const window = yield prisma.metricPoint.findMany({
            where: { serviceId },
            orderBy: { timestamp: "desc" },
            take: WINDOW_SIZE
        });
        if (window.length < WINDOW_SIZE)
            return;
        const metrics = ["cpu", "memory", "latency", "errorRate"];
        for (const metric of metrics) {
            const values = window.map(p => p[metric]);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
            const std = Math.sqrt(variance);
            const latest = window[0];
            const z = std === 0 ? 0 : Math.abs((latest[metric] - mean) / std);
            if (z > Z_THRESHOLD) {
                yield createAnomaly(serviceId, metric, latest[metric], mean, z, ts);
            }
        }
    });
}
function createAnomaly(serviceId, metric, value, baseline, zScore, timestamp) {
    return __awaiter(this, void 0, void 0, function* () {
        const anomaly = yield prisma.anomaly.create({
            data: {
                serviceId,
                metric,
                value,
                baseline,
                zScore,
                timestamp
            }
        });
        const events = yield prisma.changeEvent.findMany({
            where: {
                serviceId,
                timestamp: {
                    gte: new Date(timestamp.getTime() - 15 * 60 * 1000),
                    lte: timestamp
                }
            },
            orderBy: { timestamp: "desc" }
        });
        if (events.length) {
            const closest = events[0];
            yield prisma.anomaly.update({
                where: { id: anomaly.id },
                data: {
                    correlatedCommit: closest.commit,
                    confidence: 0.8
                }
            });
        }
        yield updateHealth(serviceId);
    });
}
function updateHealth(serviceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const recent = yield prisma.anomaly.findMany({
            where: { serviceId },
            orderBy: { timestamp: "desc" },
            take: 5
        });
        let status = "healthy";
        let score = 100;
        if (recent.length >= 3) {
            status = "critical";
            score = 30;
        }
        else if (recent.length > 0) {
            status = "degrading";
            score = 65;
        }
        yield prisma.healthSnapshot.create({
            data: {
                serviceId,
                status,
                score,
                timestamp: new Date()
            }
        });
    });
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const PORT = Number(process.env.PORT) || 5000;
/* -------------------------------------------------
   SIMPLE ROOT CHECK
--------------------------------------------------*/
app.get("/", (_req, res) => {
    res.send("🧠 DevHops Collector running");
});
/* -------------------------------------------------
   REGISTER SERVICE
--------------------------------------------------*/
app.post("/api/register-service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, metricsUrl, repoUrl } = req.body || {};
        if (!name || !metricsUrl) {
            return res.status(400).json({
                error: "name and metricsUrl required"
            });
        }
        const existing = yield prisma.service.findUnique({
            where: { name }
        });
        if (existing) {
            return res.status(409).json({
                error: "service already registered"
            });
        }
        const service = yield prisma.service.create({
            data: {
                name,
                metricsUrl,
                repoUrl
            }
        });
        res.json(service);
    }
    catch (err) {
        console.error("register-service error", err);
        res.status(500).json({ error: "internal server error" });
    }
}));
/* -------------------------------------------------
   INGEST CHANGE EVENT
--------------------------------------------------*/
app.post("/api/change-event", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Add defensive check for req.body
        if (!req.body) {
            console.error("change-event: req.body is undefined");
            return res.status(400).json({
                error: "request body is required"
            });
        }
        const { service, commit, message, timestamp } = req.body;
        if (!service || !commit) {
            return res.status(400).json({
                error: "service and commit required"
            });
        }
        const svc = yield prisma.service.findUnique({
            where: { name: service }
        });
        if (!svc) {
            return res.status(404).json({
                error: "service not registered"
            });
        }
        const event = yield prisma.changeEvent.create({
            data: {
                serviceId: svc.id,
                commit,
                message,
                timestamp: timestamp ? new Date(timestamp) : new Date()
            }
        });
        res.json(event);
    }
    catch (err) {
        console.error("change-event error", err);
        res.status(500).json({ error: "internal server error" });
    }
}));
/* -------------------------------------------------
   LIST SERVICES
--------------------------------------------------*/
app.get("/api/services", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const services = yield prisma.service.findMany({
            orderBy: { createdAt: "asc" }
        });
        res.json(services);
    }
    catch (err) {
        console.error("list-services error", err);
        res.status(500).json({ error: "internal server error" });
    }
}));
/* -------------------------------------------------
   GET METRICS
--------------------------------------------------*/
app.get("/api/metrics/:service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const name = Array.isArray(req.params.service)
            ? req.params.service[0]
            : req.params.service;
        const svc = yield prisma.service.findUnique({
            where: { name }
        });
        if (!svc) {
            return res.status(404).json({
                error: "service not found"
            });
        }
        const points = yield prisma.metricPoint.findMany({
            where: { serviceId: svc.id },
            orderBy: { timestamp: "desc" },
            take: 200
        });
        res.json(points.reverse());
    }
    catch (err) {
        console.error("get-metrics error", err);
        res.status(500).json({ error: "internal server error" });
    }
}));
/* -------------------------------------------------
   GET ANOMALIES
--------------------------------------------------*/
app.get("/api/anomalies/:service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const name = Array.isArray(req.params.service)
            ? req.params.service[0]
            : req.params.service;
        const svc = yield prisma.service.findUnique({
            where: { name }
        });
        if (!svc) {
            return res.status(404).json({
                error: "service not found"
            });
        }
        const rows = yield prisma.anomaly.findMany({
            where: { serviceId: svc.id },
            orderBy: { timestamp: "desc" }
        });
        res.json(rows);
    }
    catch (err) {
        console.error("get-anomalies error", err);
        res.status(500).json({ error: "internal server error" });
    }
}));
/* -------------------------------------------------
   GET HEALTH
--------------------------------------------------*/
app.get("/api/health/:service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const name = Array.isArray(req.params.service)
            ? req.params.service[0]
            : req.params.service;
        const svc = yield prisma.service.findUnique({
            where: { name }
        });
        if (!svc) {
            return res.status(404).json({
                error: "service not found"
            });
        }
        const latest = yield prisma.healthSnapshot.findFirst({
            where: { serviceId: svc.id },
            orderBy: { timestamp: "desc" }
        });
        res.json(latest || {
            service: name,
            status: "unknown",
            score: 0
        });
    }
    catch (err) {
        console.error("get-health error", err);
        res.status(500).json({ error: "internal server error" });
    }
}));
/* -------------------------------------------------
   GLOBAL ERROR HANDLER
--------------------------------------------------*/
app.use((err, _req, res, _next) => {
    console.error("Global error handler:", err);
    res.status(500).json({ error: "unexpected error" });
});
/* -------------------------------------------------
   SHUTDOWN CLEANUP
--------------------------------------------------*/
process.on("SIGINT", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("🛑 shutting down prisma");
    yield prisma.$disconnect();
    process.exit(0);
}));
/* -------------------------------------------------
   START SERVER
--------------------------------------------------*/
app.listen(PORT, () => {
    console.log(`🧠 Collector running on ${PORT}`);
    // Start the poller after server starts
    startPoller();
});
