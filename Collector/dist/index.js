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
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
/* =====================================================
   CONFIG
===================================================== */
const POLL_INTERVAL_MS = 2000;
const WINDOW_SIZE = 12;
const Z_THRESHOLD = 2.5;
const ANOMALY_DEDUPE_MS = 60 * 1000;
const HEALTH_WINDOW_MS = 10 * 60 * 1000;
const prisma = new client_1.PrismaClient();
let polling = false;
/* =====================================================
   POLLER
===================================================== */
function startPoller() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🔁 Poller started");
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            if (polling)
                return;
            polling = true;
            try {
                const services = yield prisma.service.findMany();
                for (const svc of services) {
                    try {
                        let m;
                        /* ---------- MOCK MODE ---------- */
                        if (svc.metricsUrl === "mock") {
                            const now = Date.now();
                            const wave = Math.sin(now / 12000);
                            m = {
                                cpu: 30 + Math.abs(wave * 25) + Math.random() * 8,
                                memory: 45 + Math.abs(Math.cos(now / 15000) * 30),
                                latency: 100 + Math.abs(wave * 60),
                                error_rate: Math.random() > 0.92 ? Math.random() * 4 : 0,
                                timestamp: now
                            };
                        }
                        else {
                            // Increase timeout to 10s and accept text for Prometheus
                            const res = yield axios_1.default.get(svc.metricsUrl, {
                                timeout: 10000,
                                headers: { 'Accept': 'text/plain, application/json, */*' }
                            });
                            if (typeof res.data === 'string') {
                                // Prometheus Text Format Parsing
                                const text = res.data;
                                const getVal = (regex) => {
                                    const match = text.match(regex);
                                    // console.log(`Regex ${regex} matched: ${match ? match[1] : 'null'}`);
                                    return match ? parseFloat(match[1]) : 0;
                                };
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
                            }
                            else {
                                // JSON Format (Mock or custom exporter)
                                m = res.data;
                            }
                        }
                        if (svc.metricsUrl !== "mock") {
                            // Log parsed values to verify correctness
                            const c = Number(m.cpu || 0).toFixed(1);
                            const mem = Number(m.memory || (typeof m.memory === 'object' ? m.memory.percent : 0)).toFixed(1);
                            console.log(`[${svc.name}] Processed: CPU=${c}%, Mem=${mem}%`);
                        }
                        /* ---------- NORMALIZE PAYLOAD ---------- */
                        // We parse directly in create() but logging helped us see 'memory' might be NaN
                        const ts = new Date(m.timestamp || Date.now());
                        const metricRow = yield prisma.metricPoint.create({
                            data: {
                                serviceId: svc.id,
                                cpu: Number(m.cpu) || 0,
                                // Handle memory if it comes as object or percent
                                memory: Number(typeof m.memory === 'object' ? m.memory.percent : m.memory) || 0,
                                latency: Number(m.latency) || 0,
                                errorRate: Number(m.error_rate || m.errorRate) || 0,
                                timestamp: ts
                            }
                        });
                        yield runAnomalyDetection(svc.id, ts);
                        yield updateHealth(svc.id);
                    }
                    catch (err) {
                        console.error("poll error for", svc.name, err);
                    }
                }
            }
            finally {
                polling = false;
            }
        }), POLL_INTERVAL_MS);
    });
}
/* =====================================================
   ANOMALY ENGINE
===================================================== */
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
        /* ---------- FORECASTING (Experimental) ---------- */
        // Predict if CPU/Memory will hit 100% soon
        // Simple Linear Regression: y = mx + c
        const forecastMetrics = ["cpu", "memory"];
        for (const metric of forecastMetrics) {
            // Need strict ascending time order for regression
            const recentPoints = [...window].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            const n = recentPoints.length;
            if (n < 10)
                continue;
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            // Use index as X (0, 1, 2...) for simplicity, assuming roughly uniform sample rate
            for (let i = 0; i < n; i++) {
                const x = i;
                const y = recentPoints[i][metric];
                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumX2 += x * x;
            }
            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            const currentVal = recentPoints[n - 1][metric];
            // Only care if trending UP and currently below limit
            if (slope > 0.1 && currentVal < 98) {
                const remainingCapacity = 100 - currentVal;
                const ticksToFull = remainingCapacity / slope;
                // Convert ticks to minutes (poll interval is 2s approx)
                // ticks * 2s / 60s
                const minsToFull = (ticksToFull * 2) / 60;
                if (minsToFull > 0 && minsToFull < 60) {
                    console.log(`[Forecast] ${metric} trending up (slope=${slope.toFixed(2)}). Full in ~${minsToFull.toFixed(1)}m`);
                    // Dedup: Check if we recently alerted on this
                    const recentForecast = yield prisma.anomaly.findFirst({
                        where: {
                            serviceId,
                            metric: 'resource_forecast',
                            timestamp: { gt: new Date(Date.now() - ANOMALY_DEDUPE_MS) } // Uses same dedupe window
                        }
                    });
                    if (!recentForecast) {
                        yield createAnomaly(serviceId, 'resource_forecast', minsToFull, // store minutes as value
                        slope, // store slope as baseline
                        0, // no z-score
                        ts, `${metric.toUpperCase()} projected to hit 100% in ~${Math.round(minsToFull)} mins`);
                    }
                }
            }
        }
    });
}
/* =====================================================
   CREATE + CORRELATE
===================================================== */
function createAnomaly(serviceId, metric, value, baseline, zScore, timestamp, description) {
    return __awaiter(this, void 0, void 0, function* () {
        const recent = yield prisma.anomaly.findFirst({
            where: {
                serviceId,
                metric,
                timestamp: {
                    gte: new Date(timestamp.getTime() - ANOMALY_DEDUPE_MS)
                }
            }
        });
        if (recent)
            return;
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
    });
}
/* =====================================================
   HEALTH ENGINE
===================================================== */
function updateHealth(serviceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const recent = yield prisma.anomaly.findMany({
            where: {
                serviceId,
                timestamp: {
                    gte: new Date(Date.now() - HEALTH_WINDOW_MS)
                }
            }
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
/* =====================================================
   EXPRESS APP
===================================================== */
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)({ origin: "*" }));
app.use(express_1.default.urlencoded({ extended: true }));
const PORT = Number(process.env.PORT) || 5000;
app.get("/", (_req, res) => {
    res.send("🧠 DevHops Collector running");
});
/* =====================================================
   REGISTER NODE
===================================================== */
app.post("/api/register-node", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, metricsUrl } = req.body || {};
        if (!name || !metricsUrl) {
            return res.status(400).json({ error: "name and metricsUrl required" });
        }
        const existing = yield prisma.service.findUnique({ where: { name } });
        if (existing) {
            return res.status(409).json({ error: "node already registered" });
        }
        const node = yield prisma.service.create({
            data: {
                name,
                metricsUrl,
                repoUrl: null
            }
        });
        res.json(node);
    }
    catch (err) {
        console.error("register-node error", err);
        res.status(500).json({ error: "internal server error" });
    }
}));
/* =====================================================
   REGISTER SERVICE
===================================================== */
app.post("/api/register-service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, metricsUrl, repoUrl } = req.body || {};
        if (!name || !metricsUrl) {
            return res.status(400).json({ error: "name and metricsUrl required" });
        }
        const existing = yield prisma.service.findUnique({ where: { name } });
        if (existing) {
            return res.status(409).json({ error: "service already registered" });
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
/* =====================================================
   CHANGE EVENT
===================================================== */
app.post("/api/change-event", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { service, commit, message, timestamp } = req.body || {};
        if (!service || !commit) {
            return res.status(400).json({ error: "service and commit required" });
        }
        const svc = yield prisma.service.findUnique({ where: { name: service } });
        if (!svc) {
            return res.status(404).json({ error: "service not registered" });
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
/* =====================================================
   LIST SERVICES
===================================================== */
app.get("/api/services", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const services = yield prisma.service.findMany({
        orderBy: { createdAt: "asc" }
    });
    res.json(services);
}));
/* =====================================================
   GET METRICS
===================================================== */
app.get("/api/metrics/:service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const name = req.params.service;
    const svc = yield prisma.service.findUnique({ where: { name } });
    if (!svc)
        return res.status(404).json({ error: "service not found" });
    const points = yield prisma.metricPoint.findMany({
        where: { serviceId: svc.id },
        orderBy: { timestamp: "desc" },
        take: 200
    });
    res.json(points.reverse());
}));
/* =====================================================
   GET ANOMALIES
===================================================== */
app.get("/api/anomalies/:service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const name = req.params.service;
    const svc = yield prisma.service.findUnique({ where: { name } });
    if (!svc)
        return res.status(404).json({ error: "service not found" });
    const rows = yield prisma.anomaly.findMany({
        where: { serviceId: svc.id },
        orderBy: { timestamp: "desc" }
    });
    res.json(rows);
}));
/* =====================================================
   GET HEALTH
===================================================== */
app.get("/api/health/:service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const name = req.params.service;
    const svc = yield prisma.service.findUnique({ where: { name } });
    if (!svc)
        return res.status(404).json({ error: "service not found" });
    const latest = yield prisma.healthSnapshot.findFirst({
        where: { serviceId: svc.id },
        orderBy: { timestamp: "desc" }
    });
    res.json(latest || {
        service: name,
        status: "unknown",
        score: 0
    });
}));
/* =====================================================
   GLOBAL ERROR
===================================================== */
app.use((err, _req, res, _next) => {
    console.error("global error:", err);
    res.status(500).json({ error: "unexpected error" });
});
/* =====================================================
   SHUTDOWN
===================================================== */
process.on("SIGINT", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("🛑 shutting down prisma");
    yield prisma.$disconnect();
    process.exit(0);
}));
/* =====================================================
   START
===================================================== */
app.listen(PORT, () => {
    console.log(`🧠 Collector running on ${PORT}`);
    startPoller();
});
