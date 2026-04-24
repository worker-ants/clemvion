import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CandidatePicker } from "./candidate-picker";
import { useLocaleStore } from "@/lib/stores/locale-store";

/**
 * Spec ED-AI-39 (§3.2 / §3.3) — candidate picker 의 네 가지 UX 경계를 고정:
 *  (a) 후보 0 → amber 안내 박스, Settings 링크.
 *  (b) 후보 1+ → 드롭다운 + Confirm. Confirm 전에는 onConfirm 미호출.
 *  (c) 후보 1개여도 자동 선택 금지 — 사용자가 드롭다운을 열어 고른 뒤
 *      Confirm 을 눌러야 비로소 onConfirm 이 호출된다.
 *  (d) currentValue 가 이미 채워져 있으면 "✓ 설정됨" 진입 (rehydrate).
 */

describe("CandidatePicker", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });
  afterEach(() => cleanup());

  it("renders an amber guidance box when there are no candidates", () => {
    const onConfirm = vi.fn();
    render(
      <CandidatePicker
        field={{
          field: "integrationId",
          widget: "integration-selector",
          label: "Integration",
          candidates: [],
        }}
        currentValue=""
        onConfirm={onConfirm}
        settingsHref="/integrations"
      />,
    );
    // "사용 가능한 Integration 이(가) 없어요. Settings 에서 먼저 등록해 주세요." 문구.
    expect(screen.getByRole("note")).toBeDefined();
    expect(
      screen.getByText(/사용 가능한 Integration 이\(가\) 없어요/),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: /설정 화면으로 이동/ }),
    ).toBeDefined();
  });

  it("renders a dropdown + confirm button when candidates exist, and does not fire onConfirm until confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <CandidatePicker
        field={{
          field: "integrationId",
          widget: "integration-selector",
          label: "Integration",
          candidates: [
            { id: "int-1", label: "Gmail SMTP", sublabel: "email" },
            { id: "int-2", label: "Mailgun", sublabel: "email" },
          ],
        }}
        currentValue=""
        onConfirm={onConfirm}
      />,
    );

    const select = screen.getByRole("combobox", {
      name: "Integration",
    }) as HTMLSelectElement;
    expect(select).toBeDefined();

    // Confirm 버튼은 선택 전이면 비활성.
    const confirmBtn = screen.getByRole("button", {
      name: /이 항목으로 설정/,
    }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();

    // 사용자가 선택 → 활성 → 클릭 → onConfirm 호출.
    await user.selectOptions(select, "int-2");
    expect(confirmBtn.disabled).toBe(false);
    await user.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("int-2");
  });

  it("does NOT auto-select when only one candidate is present (explicit confirmation required, ED-AI-39)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <CandidatePicker
        field={{
          field: "integrationId",
          widget: "integration-selector",
          label: "Integration",
          candidates: [{ id: "only-1", label: "Prod SMTP" }],
        }}
        currentValue=""
        onConfirm={onConfirm}
      />,
    );
    const confirmBtn = screen.getByRole("button", {
      name: /이 항목으로 설정/,
    }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    // 사용자가 드롭다운에서 only-1 을 직접 선택해야 활성.
    const select = screen.getByRole("combobox", {
      name: "Integration",
    }) as HTMLSelectElement;
    await user.selectOptions(select, "only-1");
    expect(confirmBtn.disabled).toBe(false);

    await user.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith("only-1");
  });

  it("enters the confirmed state directly when currentValue is already filled (rehydrate)", () => {
    render(
      <CandidatePicker
        field={{
          field: "integrationId",
          widget: "integration-selector",
          label: "Integration",
          candidates: [{ id: "int-1", label: "Gmail SMTP" }],
        }}
        currentValue="int-1"
        onConfirm={vi.fn()}
      />,
    );
    // "✓ Integration: ... 로 설정됨" 이 role=status 로 표시.
    expect(screen.getByRole("status")).toBeDefined();
    // rehydrate 시 후보 라벨을 보여줘야 한다 (raw id 가 아닌 label). W-10.
    expect(screen.getByText(/Gmail SMTP/)).toBeDefined();
    // 드롭다운·Confirm 버튼은 렌더되지 않는다.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /이 항목으로 설정/ }),
    ).toBeNull();
  });

  // review W-1: 레거시 DB 메시지(candidates 필드 부재) 가 rehydrate 되어도
  // 패널 전체가 TypeError 로 크래시하지 않아야 한다. undefined 를 빈 배열로
  // normalize 해 amber 안내 박스로 렌더.
  it("survives a legacy payload with missing candidates (no TypeError)", () => {
    render(
      <CandidatePicker
        // @ts-expect-error — legacy shape (candidates missing) simulation
        field={{
          field: "integrationId",
          widget: "integration-selector",
          label: "Integration",
        }}
        currentValue=""
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("note")).toBeDefined();
  });

  // review W-5: settingsHref 가 `/` 로 시작하지 않는 값 (외부 URL 또는
  // javascript: URI) 이면 링크를 렌더하지 않는다.
  it("refuses to render an external or javascript: settingsHref", () => {
    const { rerender } = render(
      <CandidatePicker
        field={{
          field: "integrationId",
          widget: "integration-selector",
          label: "Integration",
          candidates: [],
        }}
        currentValue=""
        onConfirm={vi.fn()}
        settingsHref="javascript:alert(1)"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();

    rerender(
      <CandidatePicker
        field={{
          field: "integrationId",
          widget: "integration-selector",
          label: "Integration",
          candidates: [],
        }}
        currentValue=""
        onConfirm={vi.fn()}
        settingsHref="https://evil.example.com/steal"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();

    rerender(
      <CandidatePicker
        field={{
          field: "integrationId",
          widget: "integration-selector",
          label: "Integration",
          candidates: [],
        }}
        currentValue=""
        onConfirm={vi.fn()}
        settingsHref="/integrations"
      />,
    );
    expect(screen.getByRole("link")).toBeDefined();
  });
});
