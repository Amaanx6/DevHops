import express from "express";
import { PrismaClient } from "@prisma/client";
import {monitorRouter} from "./Routes/monitor.routes"
import { startPoller } from "./services/poller";

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "collector running" });
});

app.use("/api", monitorRouter);

const PORT = 9000;
app.listen(PORT, () => {
  console.log(`Collector running at http://localhost:${PORT}`);
  startPoller()
});
