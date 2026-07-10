/**
 * §4.6 — 활동 탭 "연결 안 됨" 배너. 통합 status 가 connected 가 아니면 (error /
 * expired / pending_install) 새 활동이 기록되지 않으므로, "활동 없음"(빈 상태)과
 * 구분해 원인을 알리는 경고 배너 + [개요 탭] 이동 버튼을 노출한다.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useT } from "@/lib/i18n";
import type { IntegrationDto } from "@/lib/api/integrations";
import { ActivityDisconnectedBanner } from "../activity-disconnected-banner";

function Shell({
  status,
  onGoToOverview = () => {},
}: {
  status: IntegrationDto["status"];
  onGoToOverview?: () => void;
}) {
  const t = useT();
  return (
    <ActivityDisconnectedBanner
      status={status}
      onGoToOverview={onGoToOverview}
      t={t}
    />
  );
}

describe("ActivityDisconnectedBanner", () => {
  beforeEach(() => useLocaleStore.setState({ locale: "ko" }));
  afterEach(() => cleanup());

  it("connected 상태면 아무것도 렌더하지 않는다 (배너 미노출)", () => {
    const { container } = render(<Shell status="connected" />);
    expect(container.firstChild).toBeNull();
  });

  it.each(["error", "expired", "pending_install"] as const)(
    "%s 상태면 role=status 경고 배너 + [상태 확인] 버튼을 노출한다",
    (status) => {
      render(<Shell status={status} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(
        screen.getByText("새 활동이 기록되지 않고 있어요"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "상태 확인" }),
      ).toBeInTheDocument();
    },
  );

  // §3.4 status→tone escalation — error 는 red, 그 외 미연결은 warning(amber).
  it("error 상태는 red 톤으로 escalation 한다 (헤더 StatusBadge 와 신호 일치)", () => {
    render(<Shell status="error" />);
    const banner = screen.getByRole("status");
    expect(banner.className).toMatch(/red/);
    expect(banner.className).not.toMatch(/amber/);
  });

  it("expired/pending_install 는 warning(amber) 톤이다", () => {
    render(<Shell status="expired" />);
    expect(screen.getByRole("status").className).toMatch(/amber/);
  });

  it("버튼 클릭 시 onGoToOverview 를 호출한다 (개요 탭 이동)", async () => {
    const onGoToOverview = vi.fn();
    const user = userEvent.setup();
    render(<Shell status="error" onGoToOverview={onGoToOverview} />);
    await user.click(screen.getByRole("button", { name: "상태 확인" }));
    expect(onGoToOverview).toHaveBeenCalledTimes(1);
  });

  it("en 로케일이면 영어 문구를 렌더한다", () => {
    useLocaleStore.setState({ locale: "en" });
    render(<Shell status="expired" />);
    expect(
      screen.getByText("New activity isn't being recorded"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View status" }),
    ).toBeInTheDocument();
  });
});
