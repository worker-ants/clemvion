import { describe, it, expect } from "vitest";
import {
  INTEGRATION_CHANGE_ACTIONS,
  canChangeIntegration,
  hasDangerZoneAction,
  integrationPermissions,
  type IntegrationChangeAction,
} from "../integration-permissions";
import type { WorkspaceRole } from "@/lib/stores/workspace-store";

/*
 * 통합 상세 화면이 변경 동작을 보일지 정하는 표 — NERV CLE-INT-MANAGE 「권한」 표, Task CLE-T-EDQYGH.
 * 서버 판정(라우트 가드 · 서비스)과 같은 규칙이어야 버튼을 눌러 403 을 받는 경로가 없다.
 */

const ME = "user-me";
const OTHER = "user-other";
const ROLES: WorkspaceRole[] = ["viewer", "editor", "admin", "owner"];

const personal = (createdBy: string) =>
  ({ scope: "personal", createdBy }) as const;
const organization = { scope: "organization", createdBy: OTHER } as const;

/** 동작마다 허용되는 역할. 표에 없는 역할은 거부다. */
const PERSONAL_OWNER_ALLOWED: Record<IntegrationChangeAction, WorkspaceRole[]> =
  {
    rename: ["editor", "admin", "owner"],
    reauthorize: ["editor", "admin", "owner"],
    rotate: ["editor", "admin", "owner"],
    requestScopes: ["editor", "admin", "owner"],
    changeScope: ["admin", "owner"],
    // 뷰어도 자기 개인 통합은 지운다(REQ-INTMGMT-051).
    delete: ["viewer", "editor", "admin", "owner"],
  };

describe("canChangeIntegration", () => {
  describe("조직 통합 — 동작과 상관없이 관리자 이상", () => {
    it.each(
      INTEGRATION_CHANGE_ACTIONS.flatMap((action) =>
        ROLES.map((role) => [action, role] as const),
      ),
    )("%s · %s", (action, role) => {
      expect(
        canChangeIntegration(action, organization, { userId: ME, role }),
      ).toBe(role === "admin" || role === "owner");
    });

    it("조직 통합은 만든 사람이어도 관리자 미만이면 바꾸지 못한다", () => {
      expect(
        canChangeIntegration(
          "rename",
          { scope: "organization", createdBy: ME },
          { userId: ME, role: "editor" },
        ),
      ).toBe(false);
    });
  });

  describe("자기 개인 통합 — 동작마다 역할 하한이 다르다", () => {
    it.each(
      INTEGRATION_CHANGE_ACTIONS.flatMap((action) =>
        ROLES.map((role) => [action, role] as const),
      ),
    )("%s · %s", (action, role) => {
      expect(
        canChangeIntegration(action, personal(ME), { userId: ME, role }),
      ).toBe(PERSONAL_OWNER_ALLOWED[action].includes(role));
    });
  });

  it.each(INTEGRATION_CHANGE_ACTIONS)(
    "남의 개인 통합은 소유자 역할도 %s 하지 못한다(역할 우위 없음)",
    (action) => {
      expect(
        canChangeIntegration(action, personal(OTHER), {
          userId: ME,
          role: "owner",
        }),
      ).toBe(false);
    },
  );

  it("역할이나 사용자를 아직 모르면 아무 동작도 보이지 않는다", () => {
    for (const action of INTEGRATION_CHANGE_ACTIONS) {
      expect(
        canChangeIntegration(action, organization, { userId: ME, role: null }),
      ).toBe(false);
      expect(
        canChangeIntegration(action, personal(ME), {
          userId: null,
          role: "owner",
        }),
      ).toBe(false);
    }
  });
});

describe("integrationPermissions", () => {
  it("동작마다 canChangeIntegration 과 같은 값을 모은다", () => {
    const viewer = { userId: ME, role: "editor" as const };
    const permissions = integrationPermissions(personal(ME), viewer);
    expect(Object.keys(permissions).sort()).toEqual(
      [...INTEGRATION_CHANGE_ACTIONS].sort(),
    );
    for (const action of INTEGRATION_CHANGE_ACTIONS) {
      expect(permissions[action]).toBe(
        canChangeIntegration(action, personal(ME), viewer),
      );
    }
  });
});

describe("hasDangerZoneAction", () => {
  it.each([
    ["조직 통합 · 편집자", organization, "editor", false],
    ["조직 통합 · 관리자", organization, "admin", true],
    // 공개 범위 전환은 못 해도 삭제는 보이므로 탭을 둔다.
    ["자기 개인 통합 · 뷰어", personal(ME), "viewer", true],
    ["남의 개인 통합 · 소유자", personal(OTHER), "owner", false],
  ] as const)("%s → %s", (_label, integration, role, expected) => {
    expect(
      hasDangerZoneAction(
        integrationPermissions(integration, { userId: ME, role }),
      ),
    ).toBe(expected);
  });
});
