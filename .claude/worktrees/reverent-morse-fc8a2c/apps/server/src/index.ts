import express from "express";
import { createServer } from "http";
import cors from "cors";
import type { AppState } from "@starter/shared";
import { INITIAL_APP_STATE } from "@starter/shared";

const app: express.Express = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

// ─── In-memory storage ──────────────────────────────────────────

let appState: AppState = { ...INITIAL_APP_STATE };

// ─── REST API ───────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
});

// Get current state
app.get("/api/counter", (_req, res) => {
    res.json(appState);
});

// Update state (e.g. increment)
app.post("/api/counter", (req, res) => {
    const update = req.body as Partial<AppState>;
    appState = { ...appState, ...update };
    res.json(appState);
});

// ─── Start ──────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== "test") {
    httpServer.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

export { app };

