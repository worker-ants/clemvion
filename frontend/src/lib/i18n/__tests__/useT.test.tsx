import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useT, useLocale } from "..";
import { useLocaleStore } from "@/lib/stores/locale-store";

// 회귀 가드: `useT` / `useLocale` 의 `useSyncExternalStore` 가 store 를 무시하고
// hardcoded `DEFAULT_LOCALE` 을 `getServerSnapshot` 으로 반환하던 회귀
// (executions-list-test-regression · candidate-picker-test-regression) 의 재발 방지.
// beforeEach 의 setState 가 첫 렌더에 즉시 반영되는지 + 이후 setState 호출이 re-render
// 를 일으키는지 두 경로 모두 검증한다.

function Probe() {
  const t = useT();
  const locale = useLocale();
  return (
    <div>
      <span data-testid="t">{t("common.cancel")}</span>
      <span data-testid="locale">{locale}</span>
    </div>
  );
}

describe("useT / useLocale", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });

  afterEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "ko" });
  });

  it("first render reflects the store locale (en)", () => {
    useLocaleStore.setState({ locale: "en" });
    render(<Probe />);
    expect(screen.getByTestId("t").textContent).toBe("Cancel");
    expect(screen.getByTestId("locale").textContent).toBe("en");
  });

  it("first render reflects the store locale (ko)", () => {
    useLocaleStore.setState({ locale: "ko" });
    render(<Probe />);
    // ko 사전의 common.cancel 은 "취소" — getServerSnapshot 하드코딩 회귀가 났을 때도
    // 우연히 ko 가 일치해 통과해 버리지 않도록 정확한 ko 문자열을 박제.
    expect(screen.getByTestId("t").textContent).toBe("취소");
    expect(screen.getByTestId("locale").textContent).toBe("ko");
  });

  it("re-renders when the store locale flips after mount", () => {
    useLocaleStore.setState({ locale: "en" });
    render(<Probe />);
    expect(screen.getByTestId("t").textContent).toBe("Cancel");

    act(() => {
      useLocaleStore.setState({ locale: "ko" });
    });
    expect(screen.getByTestId("t").textContent).toBe("취소");
    expect(screen.getByTestId("locale").textContent).toBe("ko");
  });
});
