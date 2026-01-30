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
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeLatest = analyzeLatest;
const client_1 = require("@prisma/client");
const correlationEngine_1 = require("./correlationEngine");
const prisma = new client_1.PrismaClient();
const WINDOW = 20; // rolling baseline size
function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function std(arr, m) {
    const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
}
function analyzeLatest(serviceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const metrics = yield prisma.metric.findMany({
            where: { serviceId },
            orderBy: { timestamp: "desc" },
            take: WINDOW,
        });
        // Warm-up phase
        if (metrics.length < WINDOW)
            return;
        const fields = ["cpu", "memory", "latency", "errorRate"];
        for (const field of fields) {
            const values = metrics.map((m) => m[field]);
            const latest = values[0];
            const baseline = mean(values.slice(1));
            const deviation = std(values.slice(1), baseline);
            if (deviation === 0)
                continue;
            const zScore = Math.abs(latest - baseline) / deviation;
            if (zScore > 3) {
                const anomaly = yield prisma.anomaly.create({
                    data: {
                        serviceId,
                        metric: field,
                        value: latest,
                        baseline,
                        severity: zScore,
                    },
                });
                console.log(`🚨 ANOMALY → svc=${serviceId} ${field}=${latest.toFixed(2)} baseline=${baseline.toFixed(2)} z=${zScore.toFixed(2)}`);
                yield (0, correlationEngine_1.correlateAnomaly)(anomaly.id);
            }
        }
    });
}
