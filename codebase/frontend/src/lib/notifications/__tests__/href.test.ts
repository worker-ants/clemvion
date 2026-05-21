import { describe, it, expect } from "vitest";
import { notificationHref, type NotificationLite } from "../href";

function notif(overrides: Partial<NotificationLite>): NotificationLite {
  return {
    type: undefined,
    resourceType: null,
    resourceId: null,
    ...overrides,
  };
}

describe("notificationHref", () => {
  describe("integration_action_required", () => {
    it("deep-links to /integrations/<id> when resourceId is present", () => {
      expect(
        notificationHref(
          notif({
            type: "integration_action_required",
            resourceType: "integration",
            resourceId: "int-abc",
          }),
        ),
      ).toBe("/integrations/int-abc");
    });

    it("falls back to /integrations list when resourceId is null", () => {
      // Defensive: even though emitter always sets resource_id, the row could
      // be migrated or hand-crafted. Don't 404 the user — land on the list.
      expect(
        notificationHref(
          notif({
            type: "integration_action_required",
            resourceType: "integration",
            resourceId: null,
          }),
        ),
      ).toBe("/integrations");
    });
  });

  describe("integration_expired", () => {
    it("deep-links to /integrations/<id> when resourceId is present", () => {
      expect(
        notificationHref(
          notif({
            type: "integration_expired",
            resourceType: "integration",
            resourceId: "int-xyz",
          }),
        ),
      ).toBe("/integrations/int-xyz");
    });

    it("falls back to /integrations list when resourceId is null", () => {
      expect(
        notificationHref(
          notif({ type: "integration_expired", resourceId: null }),
        ),
      ).toBe("/integrations");
    });
  });

  describe("execution_failed / background_failed / schedule_failed", () => {
    it.each([
      ["execution_failed", "wf-1", "/workflows/wf-1"],
      ["background_failed", "wf-2", "/workflows/wf-2"],
      ["schedule_failed", "wf-3", "/workflows/wf-3"],
    ])("%s with resourceId → %s", (type, resourceId, expected) => {
      expect(notificationHref(notif({ type, resourceId }))).toBe(expected);
    });

    it("falls back to /workflows when resourceId missing", () => {
      expect(
        notificationHref(notif({ type: "execution_failed", resourceId: null })),
      ).toBe("/workflows");
    });
  });

  describe("team_invite", () => {
    it("goes to /profile", () => {
      expect(notificationHref(notif({ type: "team_invite" }))).toBe("/profile");
    });
  });

  describe("unknown / missing type", () => {
    it("returns null when type missing", () => {
      expect(notificationHref(notif({ type: undefined }))).toBeNull();
    });

    it("returns null for unknown type", () => {
      expect(
        notificationHref(notif({ type: "marketplace_update" })),
      ).toBeNull();
    });
  });
});
