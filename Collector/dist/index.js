"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const monitor_routes_1 = require("./Routes/monitor.routes");
const poller_1 = require("./services/poller");
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get("/", (req, res) => {
    res.json({ status: "collector running" });
});
app.use("/api", monitor_routes_1.monitorRouter);
const PORT = 9000;
app.listen(PORT, () => {
    console.log(`Collector running at http://localhost:${PORT}`);
    (0, poller_1.startPoller)();
});
