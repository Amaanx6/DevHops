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
exports.correlateAnomaly = correlateAnomaly;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const LOOKBACK_MINUTES = 15;
function correlateAnomaly(anomalyId) {
    return __awaiter(this, void 0, void 0, function* () {
        const anomaly = yield prisma.anomaly.findUnique({
            where: { id: anomalyId },
            include: { service: true },
        });
        if (!anomaly)
            return;
        const since = new Date(anomaly.timestamp.getTime() - LOOKBACK_MINUTES * 60 * 1000);
        const deploys = yield prisma.deployEvent.findMany({
            where: {
                serviceId: anomaly.serviceId,
                timestamp: { gte: since },
            },
            orderBy: { timestamp: "desc" },
        });
        for (const deploy of deploys) {
            const minutesDiff = (anomaly.timestamp.getTime() - deploy.timestamp.getTime()) / 1000 / 60;
            const confidence = Math.max(0.2, 1 - minutesDiff / LOOKBACK_MINUTES);
            yield prisma.anomalyCause.create({
                data: {
                    anomalyId: anomaly.id,
                    deployId: deploy.id,
                    confidence,
                    reason: `Anomaly occurred ${minutesDiff.toFixed(1)} min after deployment ${deploy.version}`,
                },
            });
            console.log(`🔗 Correlated anomaly ${anomaly.id} with deploy ${deploy.version}`);
        }
        console.log("🔍 Correlating anomaly:", anomalyId);
        console.log("Looking for deploys after:", since.toISOString());
        console.log("Deploys found:", deploys.length);
    });
}
