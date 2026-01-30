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
exports.startPoller = startPoller;
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const anomalyEngine_1 = require("./anomalyEngine");
const prisma = new client_1.PrismaClient();
function startPoller() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🔄 Poller started");
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const services = yield prisma.service.findMany();
                for (const svc of services) {
                    try {
                        const headers = {};
                        if (svc.authHeader) {
                            headers["Authorization"] = svc.authHeader;
                        }
                        // scrape metrics
                        const res = yield axios_1.default.get(svc.url, {
                            timeout: 3000,
                            headers,
                        });
                        const { cpu, memory, latency, error_rate } = res.data;
                        // store metric
                        yield prisma.metric.create({
                            data: {
                                serviceId: svc.id,
                                cpu: Number(cpu),
                                memory: Number(memory),
                                latency: Number(latency),
                                errorRate: Number(error_rate),
                            },
                        });
                        console.log(`📥 [${svc.name}] mem=${memory} lat=${latency}`);
                        // 🔥 NOW analyze
                        yield (0, anomalyEngine_1.analyzeLatest)(svc.id);
                    }
                    catch (err) {
                        const msg = ((_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status)
                            ? `HTTP ${err.response.status}`
                            : err.message;
                        console.error(`❌ Poll ${svc.name}:`, msg);
                    }
                }
            }
            catch (err) {
                console.error("❌ Poller loop error:", err);
            }
        }), 5000);
    });
}
