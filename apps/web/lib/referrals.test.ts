import { describe, expect, it } from "vitest";
import { defaultReferralCode, normalizeReferralCode } from "./referrals";

describe("referral codes", () => {
  it("normalizes a custom code into a safe URL segment", () => {
    expect(normalizeReferralCode("  Mi Red Élite 2026!  ")).toBe(
      "mi-red-elite-2026",
    );
  });

  it("builds a stable unique default code", () => {
    expect(
      defaultReferralCode(
        "quality-shop",
        "8c8073fe-b9d8-40f6-b26b-99fcdb01828d",
      ),
    ).toBe("quality-shop-8c8073fe");
  });
});
