"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
let state = {
    service: "payments",
    cpu: 35,
    memory: 400,
    latency: 120,
    error_rate: 0.01,
    bug: null, // "memory_leak" | "latency_spike"
};
// ---- HELPERS ----
function randomDrift(val, amount) {
    return val + (Math.random() * amount * 2 - amount);
}
// ---- ROUTES ----
// 1️⃣ GET /metrics
app.get("/metrics", (req, res) => {
    // normal fluctuations
    state.cpu = randomDrift(state.cpu, 1);
    state.latency = randomDrift(state.latency, 2);
    // bug behavior
    if (state.bug === "memory_leak") {
        state.memory += Math.random() * 15 + 5;
    }
    if (state.bug === "latency_spike") {
        state.latency += Math.random() * 30 + 10;
        state.error_rate += Math.random() * 0.05;
    }
    res.json({
        service: state.service,
        cpu: Number(state.cpu.toFixed(2)),
        memory: Number(state.memory.toFixed(2)),
        latency: Number(state.latency.toFixed(2)),
        error_rate: Number(state.error_rate.toFixed(3)),
    });
});
// 2️⃣ POST /inject-bug
app.post("/inject-bug", (req, res) => {
    const { type } = req.body;
    if (!["memory_leak", "latency_spike"].includes(type)) {
        return res.status(400).json({
            error: "type must be memory_leak or latency_spike",
        });
    }
    state.bug = type;
    res.json({
        status: "bug injected",
        bug: state.bug,
    });
});
app.post("/reset", (req, res) => {
    state.bug = null;
    state.cpu = 35;
    state.memory = 400;
    state.latency = 120;
    state.error_rate = 0.01;
    res.json({
        status: "service reset",
    });
});
const PORT = 8002;
app.listen(PORT, () => {
    console.log(`payments-service running on http://localhost:${PORT}`);
});
