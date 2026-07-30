import { describe, expect, it } from "vitest";
import { SYSTEM_ROLES, TEAM_PROFILE_KEYS } from "./rbac";

describe("perfiles de usuarios de tienda", () => {
  it("limita vendedor a dashboard y envíos", () => {
    expect(SYSTEM_ROLES.vendedor).toEqual([
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "shipments:read",
      "shipments:create",
    ]);
  });

  it("separa bodeguero y finanzas", () => {
    expect(TEAM_PROFILE_KEYS).toEqual(["vendedor", "bodega", "finanzas"]);
    expect(SYSTEM_ROLES.bodega).toContain("inventory:adjust");
    expect(SYSTEM_ROLES.bodega).not.toContain("shipments:read");
    expect(SYSTEM_ROLES.finanzas).toEqual([
      "referrals:read",
      "referrals:manage",
      "finance:read",
      "finance:manage",
    ]);
  });
});
