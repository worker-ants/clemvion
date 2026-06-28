import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  computeStatus,
  computeAttentionBreakdown,
  humanizeUntil,
  needsAttention,
} from "../status-badge";
import type { IntegrationDto } from "@/lib/api/integrations";

// 이 파일의 단언은 모두 `Date.now()` 상대 시각(만료 임박 판정·humanizeUntil
// 단위 경계)에 의존한다. 실제 시간을 쓰면 테스트가 타임스탬프를 만든 시점과
// 함수가 내부에서 `Date.now()` 를 다시 읽는 시점 사이에 수 ms 가 흘러,
// 예컨대 minutesFromNow(60) 이 60분에서 살짝 모자라 "1h" 가 아닌 "59m" 으로
// 떨어지는 flaky 가 났다(전체 스위트 부하 시 간헐 발생). 시스템 시간을 고정해
// 두 번의 읽기가 동일 시각을 보게 하여 경계 단언을 결정적으로 만든다.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-28T00:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

function row(overrides: Partial<IntegrationDto>): IntegrationDto {
  return {
    id: "i",
    workspaceId: "ws",
    serviceType: "cafe24",
    name: "",
    authType: "oauth2",
    credentials: {},
    scope: "personal",
    status: "connected",
    statusReason: null,
    credentialsStatus: "ok",
    lastError: null,
    meta: { appType: null },
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    autoRefresh: true,
    appUrl: null,
    createdBy: "u",
    createdAt: "2026-05-14T00:00:00Z",
    updatedAt: "2026-05-14T00:00:00Z",
    ...overrides,
  } as IntegrationDto;
}

describe("computeStatus", () => {
  it("returns connected for connected status", () => {
    expect(computeStatus(row({ status: "connected" })).label).toBe("Connected");
  });

  it("returns Pending install with default hint when no statusReason", () => {
    const view = computeStatus(
      row({ status: "pending_install", statusReason: null }),
    );
    expect(view.label).toBe("Pending install");
    expect(view.tone).toBe("warn");
    expect(view.detail).toBe("Complete Cafe24 Test Run to activate");
  });

  it("surfaces the diagnostic detail when pending_install has a statusReason", () => {
    // Callback failure populated last_error/status_reason — UI must show the
    // diagnostic so the user can fix the underlying cause (e.g. wrong
    // client_id) and re-run "테스트 실행".
    const view = computeStatus(
      row({
        status: "pending_install",
        statusReason: "oauth_token_exchange_failed",
      }),
    );
    expect(view.label).toBe("Pending install");
    expect(view.detail).toContain("oauth_token_exchange_failed");
    expect(view.tone).toBe("err");
  });

  it("returns Error with statusReason as detail for error status", () => {
    const view = computeStatus(
      row({ status: "error", statusReason: "auth_failed" }),
    );
    expect(view.label).toBe("Error");
    expect(view.tone).toBe("err");
    expect(view.detail).toBe("auth_failed");
  });

  it("prefers needs_reauth banner over status", () => {
    expect(
      computeStatus(
        row({ status: "connected", credentialsStatus: "needs_reauth" }),
      ).label,
    ).toBe("Reconnection required");
  });

  it("returns Expired without bespoke detail", () => {
    expect(computeStatus(row({ status: "expired" })).label).toBe("Expired");
    expect(computeStatus(row({ status: "expired" })).detail).toBeUndefined();
  });

  it("surfaces install_timeout hint on expired Cafe24 Private rows", () => {
    const view = computeStatus(
      row({ status: "expired", statusReason: "install_timeout" }),
    );
    expect(view.label).toBe("Expired");
    expect(view.detail).toContain("delete and re-register");
  });

  it("prefers lastError.message over status_reason for pending_install diagnostic", () => {
    const view = computeStatus(
      row({
        status: "pending_install",
        statusReason: "oauth_token_exchange_failed",
        lastError: { message: "Failed to exchange code: invalid_grant" },
      }),
    );
    expect(view.detail).toContain("invalid_grant");
  });

  // -----------------------------------------------------------------
  // autoRefresh — spec/2-navigation/4-integration.md §4.1 헤더 정책 +
  // Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)".
  // 짧은-수명 OAuth 토큰(cafe24 2h 등)이 항상 "Expires today" 노란 톤
  // 으로 표시되는 거짓 양성을 막기 위한 분기. autoRefresh=true 통합은
  // 만료 임박해도 메인 라벨 "Connected" 유지 + 보조 라벨로만 안내.
  // -----------------------------------------------------------------
  const inMinutes = (m: number) =>
    new Date(Date.now() + m * 60 * 1000).toISOString();
  const inDaysIso = (d: number) =>
    new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();

  describe("autoRefresh + expiresSoon", () => {
    it("keeps 'Connected' label when autoRefresh=true even if expiring within 7d", () => {
      // cafe24 2h token: tokenExpiresAt 90분 후 → expiresSoon true 인데도
      // autoRefresh=true 라 노란 'Expires today' 가 아닌 'Connected' 가
      // 메인 라벨이어야 한다.
      const view = computeStatus(
        row({
          status: "connected",
          autoRefresh: true,
          tokenExpiresAt: inMinutes(90),
        }),
      );
      expect(view.label).toBe("Connected");
      expect(view.tone).toBe("ok");
      expect(view.dotClassName).toBe("bg-green-500");
    });

    it("emits 'Auto-renews' subLabel when autoRefresh=true and connected", () => {
      const view = computeStatus(
        row({
          status: "connected",
          autoRefresh: true,
          tokenExpiresAt: inMinutes(90),
        }),
      );
      expect(view.subLabel).toBeDefined();
      // spec §4.1 헤더 메타 라인: "Auto-renews · next in <duration>".
      expect(view.subLabel).toMatch(/^Auto-renews · next in /);
    });

    it("falls back to 'Expires in Nd' when autoRefresh=false and expiresSoon", () => {
      const view = computeStatus(
        row({
          status: "connected",
          autoRefresh: false,
          tokenExpiresAt: inDaysIso(3),
        }),
      );
      expect(view.label).toMatch(/Expires/);
      expect(view.tone).toBe("warn");
    });

    it("no subLabel when autoRefresh=true but not connected (error/expired)", () => {
      const errView = computeStatus(
        row({
          status: "error",
          autoRefresh: true,
          statusReason: "auth_failed",
        }),
      );
      expect(errView.subLabel).toBeUndefined();

      const expView = computeStatus(
        row({ status: "expired", autoRefresh: true }),
      );
      expect(expView.subLabel).toBeUndefined();
    });

    it("no subLabel when autoRefresh=true and connected but tokenExpiresAt is null (MCP 등)", () => {
      const view = computeStatus(
        row({
          status: "connected",
          autoRefresh: true,
          tokenExpiresAt: null,
        }),
      );
      expect(view.label).toBe("Connected");
      // tokenExpiresAt 가 없으면 만료 카운트다운이 무의미 → subLabel 미노출
      expect(view.subLabel).toBeUndefined();
    });
  });
});

// spec/2-navigation/4-integration.md §4.1 헤더 메타 라인 규약 — `Auto-renews ·
// in <duration>` 보조 라벨에서 사용. 단위 변환 경계 + 입력 가드 보장.
describe("humanizeUntil", () => {
  const minutesFromNow = (m: number) =>
    new Date(Date.now() + m * 60_000).toISOString();

  it("returns empty string for past timestamps (no misleading '0m')", () => {
    expect(humanizeUntil(minutesFromNow(-1))).toBe("");
  });

  it("returns empty string for zero / 'now' timestamps", () => {
    expect(humanizeUntil(new Date(Date.now()).toISOString())).toBe("");
  });

  it("returns empty string for invalid ISO input (NaN guard)", () => {
    expect(humanizeUntil("not-a-date")).toBe("");
    expect(humanizeUntil("")).toBe("");
  });

  it("returns 'less than a minute' when remaining < 60s", () => {
    const in30s = new Date(Date.now() + 30 * 1000).toISOString();
    expect(humanizeUntil(in30s)).toBe("less than a minute");
  });

  it("returns minutes-only form when under an hour", () => {
    expect(humanizeUntil(minutesFromNow(45))).toBe("45m");
  });

  it("returns hours-only form when remainder minutes are zero", () => {
    expect(humanizeUntil(minutesFromNow(60))).toBe("1h");
    expect(humanizeUntil(minutesFromNow(120))).toBe("2h");
  });

  it("returns hours + minutes when both nonzero", () => {
    // 84m → 1h 24m — the case the bug report originally showed.
    expect(humanizeUntil(minutesFromNow(84))).toBe("1h 24m");
  });

  it("returns days when remaining ≥ 24h", () => {
    expect(humanizeUntil(minutesFromNow(24 * 60))).toBe("1d");
    expect(humanizeUntil(minutesFromNow(3 * 24 * 60))).toBe("3d");
  });
});

// needsAttention 단일 술어 — computeAttentionBreakdown·사이드바 카운트의 기반.
// spec/2-navigation/4-integration.md §2.4·§11.4 + Rationale.
describe("needsAttention", () => {
  const inDays = (days: number) =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  it("connected + expiring + autoRefresh=false → true", () => {
    expect(
      needsAttention(
        row({ status: "connected", autoRefresh: false, tokenExpiresAt: inDays(2) }),
      ),
    ).toBe(true);
  });

  it("connected + expiring + autoRefresh=true → false (만료 임박 분기 제외)", () => {
    expect(
      needsAttention(
        row({ status: "connected", autoRefresh: true, tokenExpiresAt: inDays(2) }),
      ),
    ).toBe(false);
  });

  it("connected + 만료 임박 아님 → false", () => {
    expect(
      needsAttention(
        row({ status: "connected", autoRefresh: false, tokenExpiresAt: inDays(30) }),
      ),
    ).toBe(false);
  });

  it("error/expired → 항상 true (autoRefresh 무관)", () => {
    expect(needsAttention(row({ status: "error", autoRefresh: true }))).toBe(true);
    expect(needsAttention(row({ status: "expired", autoRefresh: true }))).toBe(true);
  });

  it("pending_install → false", () => {
    expect(needsAttention(row({ status: "pending_install" }))).toBe(false);
  });
});

// spec/2-navigation/4-integration.md §2.4 + Rationale "Attention 가상 필터값"
describe("computeAttentionBreakdown", () => {
  // 7d ahead → expiring; 1d ahead → expiring; past → not expiring on its own.
  const inDays = (days: number) =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  it("counts expired/expiring/error separately and totals them", () => {
    const items: IntegrationDto[] = [
      row({ id: "a", status: "expired" }),
      row({ id: "b", status: "error", statusReason: "auth_failed" }),
      row({
        id: "c",
        status: "connected",
        autoRefresh: false,
        tokenExpiresAt: inDays(2), // expiring (within 7d, not auto-refresh)
      }),
      row({
        id: "d",
        status: "connected",
        tokenExpiresAt: inDays(30), // not expiring
      }),
      row({ id: "e", status: "pending_install" }), // explicitly excluded
    ];
    const br = computeAttentionBreakdown(items);
    expect(br.expired).toBe(1);
    expect(br.error).toBe(1);
    expect(br.expiring).toBe(1);
    expect(br.total).toBe(3);
  });

  // spec §2.4·§9.1 + Rationale "자동 갱신 통합을 attention 술어에서 제외":
  // autoRefresh=true(cafe24 2h 토큰 등) connected 행은 만료 임박이어도
  // attention/expiring 에 포함되지 않는다 — 거짓 양성 방지.
  it("excludes autoRefresh=true connected rows from expiring/attention", () => {
    const items: IntegrationDto[] = [
      row({
        id: "auto",
        status: "connected",
        autoRefresh: true,
        tokenExpiresAt: inDays(2), // 만료 임박이지만 자동 갱신 → 제외
      }),
      row({
        id: "manual",
        status: "connected",
        autoRefresh: false,
        tokenExpiresAt: inDays(2), // 자동 갱신 아님 → expiring
      }),
    ];
    const br = computeAttentionBreakdown(items);
    expect(br.expiring).toBe(1);
    expect(br.total).toBe(1);
    expect(br.mostUrgentId).toBe("manual");
  });

  // autoRefresh=true 갱신이 실패해 error 로 전이하면 다시 attention 에 포함된다
  // (§10.5) — 만료 임박 분기에서만 제외되지 상태 기반 분기는 그대로.
  it("still counts autoRefresh=true rows once they transition to error/expired", () => {
    const items: IntegrationDto[] = [
      row({ id: "auto-err", status: "error", autoRefresh: true }),
      row({ id: "auto-exp", status: "expired", autoRefresh: true }),
    ];
    const br = computeAttentionBreakdown(items);
    expect(br.error).toBe(1);
    expect(br.expired).toBe(1);
    expect(br.total).toBe(2);
  });

  it("returns 0 totals for a list with no attention rows", () => {
    const items: IntegrationDto[] = [
      row({ id: "a", status: "connected" }),
      row({ id: "b", status: "pending_install" }),
    ];
    expect(computeAttentionBreakdown(items).total).toBe(0);
  });

  // The single-row UX (banner → detail jump) needs a deterministic target.
  it("exposes mostUrgentId when exactly one row needs attention", () => {
    const items: IntegrationDto[] = [
      row({ id: "only-one", status: "error" }),
      row({ id: "ok", status: "connected" }),
    ];
    const br = computeAttentionBreakdown(items);
    expect(br.total).toBe(1);
    expect(br.mostUrgentId).toBe("only-one");
  });

  // When multiple categories are present, error > expired > expiring is the
  // priority order so the most actionable case wins. mostUrgentId is only
  // meaningful when total === 1, but we still expose a deterministic value.
  it("agrees with needsAttention's single-row predicate", () => {
    const items: IntegrationDto[] = [
      row({ id: "a", status: "expired" }),
      row({ id: "b", status: "connected" }),
    ];
    const br = computeAttentionBreakdown(items);
    const filtered = items.filter(needsAttention);
    expect(br.total).toBe(filtered.length);
  });

  it("picks error > expired > expiring for mostUrgentId when categories coexist", () => {
    const items: IntegrationDto[] = [
      row({ id: "exp-1", status: "expired" }),
      row({
        id: "soon-1",
        status: "connected",
        autoRefresh: false,
        tokenExpiresAt: inDays(2),
      }),
      row({ id: "err-1", status: "error" }),
    ];
    expect(computeAttentionBreakdown(items).mostUrgentId).toBe("err-1");
  });

  it("falls back to expired when no error rows are present", () => {
    const items: IntegrationDto[] = [
      row({
        id: "soon-1",
        status: "connected",
        autoRefresh: false,
        tokenExpiresAt: inDays(2),
      }),
      row({ id: "exp-1", status: "expired" }),
    ];
    expect(computeAttentionBreakdown(items).mostUrgentId).toBe("exp-1");
  });

  it("returns null mostUrgentId on an empty list", () => {
    expect(computeAttentionBreakdown([])).toEqual({
      expired: 0,
      expiring: 0,
      error: 0,
      total: 0,
      mostUrgentId: null,
    });
  });

  // EXPIRING_SOON_DAYS = 7 — locked-in boundary. Tokens expiring within 7
  // days are attention-worthy; anything beyond is not.
  it("counts a token expiring in just under 7 days as expiring", () => {
    const justUnder = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000 - 60_000,
    ).toISOString();
    const items: IntegrationDto[] = [
      row({
        id: "edge",
        status: "connected",
        autoRefresh: false,
        tokenExpiresAt: justUnder,
      }),
    ];
    expect(computeAttentionBreakdown(items).expiring).toBe(1);
  });

  it("does NOT count a token expiring well past 7 days as expiring", () => {
    const items: IntegrationDto[] = [
      row({
        id: "far",
        status: "connected",
        tokenExpiresAt: inDays(30),
      }),
    ];
    expect(computeAttentionBreakdown(items).total).toBe(0);
  });
});
