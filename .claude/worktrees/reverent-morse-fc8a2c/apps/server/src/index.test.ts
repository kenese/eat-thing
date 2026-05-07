import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./index";

describe("Express REST API", () => {
    it("should return ok for GET /api/health", async () => {
        const response = await request(app).get("/api/health");
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });

    it("should return the initial counter state for GET /api/counter", async () => {
        const response = await request(app).get("/api/counter");
        expect(response.status).toBe(200);
        expect(response.body.counter).toBe(0);
    });

    it("should update the counter state for POST /api/counter", async () => {
        const response = await request(app)
            .post("/api/counter")
            .send({ counter: 5 });
            
        expect(response.status).toBe(200);
        expect(response.body.counter).toBe(5);

        // Verify the state persisted
        const getResponse = await request(app).get("/api/counter");
        expect(getResponse.body.counter).toBe(5);
    });
});
