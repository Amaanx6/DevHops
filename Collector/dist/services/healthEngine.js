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
exports.getServiceHealth = getServiceHealth;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function getServiceHealth(serviceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = new Date();
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const [latestMetric] = yield prisma.metric.findMany({
            where: { serviceId },
            orderBy: { timestamp: "desc" },
            take: 1,
        });
        const recentAnomalies = yield prisma.anomaly.findMany({
            where: {
                serviceId,
                timestamp: { gte: fiveMinAgo },
            },
            orderBy: { timestamp: "desc" },
        });
        const recentDeploy = yield prisma.deployEvent.findFirst({
            where: {
                serviceId,
                timestamp: { gte: tenMinAgo },
            },
            orderBy: { timestamp: "desc" },
        });
        let risk = 0;
        if (recentAnomalies.length > 0)
            risk += 0.4;
        risk += Math.min(0.4, recentAnomalies.length * 0.2);
        if (recentDeploy)
            risk += 0.2;
        risk = Math.min(1, risk);
        let status = "HEALTHY";
        if (risk >= 0.6)
            status = "CRITICAL";
        else if (risk >= 0.3)
            status = "DEGRADED";
        return {
            status,
            riskScore: Number(risk.toFixed(2)),
            latestMetrics: latestMetric || null,
            recentAnomalies,
            recentDeploy,
        };
    });
}
