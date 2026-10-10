/**
 * Cafe24 Private 재설치 대기 안내. 권한 추가 · 재인증이 행에 `reinstallRequestedAt`
 * 표시를 남기면 상세 화면이 Cafe24 Developers 의 '테스트 실행'을 누르라고 안내한다.
 * 표시가 없으면 아무것도 그리지 않는다.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/utils/date";
import { ReinstallRequestedNotice } from "../reinstall-requested-notice";

function Shell({ reinstallRequestedAt }: { reinstallRequestedAt: string | null | undefined }) {
  const t = useT();
  return <ReinstallRequestedNotice reinstallRequestedAt={reinstallRequestedAt} t={t} />;
}

describe("ReinstallRequestedNotice", () => {
  beforeEach(() => useLocaleStore.setState({ locale: "ko" }));
  afterEach(() => cleanup());

  it.each([null, undefined])("표시가 없으면(%s) 렌더하지 않는다", (value) => {
    const { container } = render(<Shell reinstallRequestedAt={value} />);
    expect(container.firstChild).toBeNull();
  });

  it("표시가 있으면 role=status 안내와 요청 시각을 보여 준다", () => {
    const at = "2026-10-10T03:04:05.000Z";
    render(<Shell reinstallRequestedAt={at} />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Cafe24 Developers 에서 '테스트 실행'을 눌러 주세요");
    expect(notice).toHaveTextContent(`요청 시각: ${formatDate(at, "datetime")}`);
  });

  it("영어 로케일에서도 같은 안내를 보여 준다", () => {
    useLocaleStore.setState({ locale: "en" });
    render(<Shell reinstallRequestedAt="2026-10-10T03:04:05.000Z" />);
    expect(screen.getByRole("status")).toHaveTextContent('Click "Test run" in Cafe24 Developers');
  });
});
