import { describe, expect, it } from "vitest";
import { AuthorizationError, requirePermission, type TenantContext, type TenantId, type UserId } from "./index";

const context: TenantContext = { tenantId: "tenant-1" as TenantId, userId: "user-1" as UserId, permissions: new Set(["orders:read"]), correlationId: "test" };

describe("requirePermission", () => {
  it("allows granted permissions", () => expect(() => requirePermission(context, "orders:read")).not.toThrow());
  it("rejects missing permissions", () => expect(() => requirePermission(context, "orders:write")).toThrow(AuthorizationError));
});
