import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("health route", () => {
  it("returns an operational response", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok", service: "trajetix-web" });
  });
});
