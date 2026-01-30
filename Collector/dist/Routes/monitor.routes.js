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
exports.monitorRouter = void 0;
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const healthEngine_1 = require("../services/healthEngine");
exports.monitorRouter = express_1.default.Router();
const prisma = new client_1.PrismaClient();
exports.monitorRouter.post("/register-service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, metricsUrl, authHeader, provider } = req.body;
    if (!name || !metricsUrl) {
        return res.status(400).json({
            error: "name and metricsUrl required",
        });
    }
    try {
        const service = yield prisma.service.upsert({
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
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to register service:", errorMessage);
        return res.status(500).json({ error: "failed to register service" });
    }
}));
exports.monitorRouter.post("/deploy-event", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { service, version } = req.body;
    if (!service || !version) {
        return res.status(400).json({ error: "service and version required" });
    }
    try {
        const svc = yield prisma.service.findUnique({
            where: { name: service },
        });
        if (!svc) {
            return res.status(404).json({ error: "service not found" });
        }
        const deploy = yield prisma.deployEvent.create({
            data: {
                version,
                serviceId: svc.id,
                timestamp: new Date(),
            },
        });
        res.json(deploy);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed to store deploy event" });
    }
}));
exports.monitorRouter.get("/metrics/:service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { service } = req.params;
    try {
        const svc = yield prisma.service.findUnique({
            where: { name: service },
        });
        if (!svc) {
            return res.status(404).json({ error: "service not found" });
        }
        const metrics = yield prisma.metric.findMany({
            where: { serviceId: svc.id },
            orderBy: { timestamp: "desc" },
            take: 200,
        });
        res.json(metrics);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed to fetch metrics" });
    }
}));
exports.monitorRouter.get("/anomalies/:service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { service } = req.params;
    try {
        const svc = yield prisma.service.findUnique({
            where: { name: service },
        });
        if (!svc) {
            return res.status(404).json({ error: "service not found" });
        }
        const anomalies = yield prisma.anomaly.findMany({
            where: { serviceId: svc.id },
            orderBy: { timestamp: "desc" },
            take: 50,
        });
        res.json(anomalies);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed to fetch anomalies" });
    }
}));
exports.monitorRouter.get("/anomaly-causes/:anomalyId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const anomalyId = Number(req.params.anomalyId);
    try {
        const causes = yield prisma.anomalyCause.findMany({
            where: { anomalyId },
            include: { deployEvent: true },
            orderBy: { confidence: "desc" },
        });
        res.json(causes);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed to fetch causes" });
    }
}));
exports.monitorRouter.get("/health/:service", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { service } = req.params;
    try {
        const svc = yield prisma.service.findUnique({
            where: { name: service },
        });
        if (!svc) {
            return res.status(404).json({ error: "service not found" });
        }
        const health = yield (0, healthEngine_1.getServiceHealth)(svc.id);
        res.json(Object.assign({ service: svc.name }, health));
    }
    catch (err) {
        console.error("Health error:", err);
        res.status(500).json({ error: "failed to compute health" });
    }
}));
