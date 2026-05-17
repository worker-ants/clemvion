import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CandidatePicker } from "./candidate-picker";
import { useLocaleStore } from "@/lib/stores/locale-store";

/**
 * Spec ED-AI-39 (§3.2 / §3.3) — candidate picker 의 UX 경계를 고정:
 *  (a) 후보 0 → amber 안내 박스, Settings 링크.
 *  (b) 후보 1+ → 드롭다운(single) 또는 체크박스(multi) + Confirm.
 *      Confirm 전에는 onConfirm 미호출.
 *  (c) 후보 1개여도 자동 선택 금지 — 사용자가 직접 골라야 Confirm 활성.
 *  (d) currentValue 가 이미 채워져 있으면 "✓ 설정됨" 진입 (rehydrate).
 *  (e) selectionMode='multi' (KB · MCP) — 여러 후보를 한 번에 선택해 ids 배열로
 *      onConfirm. selectionMode 누락 시 'single' 로 fallback (legacy 호환).
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
    expect(onConfirm).toHaveBeenCalledWith({ mode: "single", id: "int-2" });
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
    expect(onConfirm).toHaveBeenCalledWith({ mode: "single", id: "only-1" });
  });

  describe("multi-select mode (kb-selector / mcp-server-selector)", () => {
    it("renders a checkbox list and emits ids[] on Confirm", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
        <CandidatePicker
          field={{
            field: "knowledgeBaseIds",
            widget: "kb-selector",
            label: "Knowledge Bases",
            selectionMode: "multi",
            candidates: [
              { id: "kb-1", label: "Product docs" },
              { id: "kb-2", label: "Onboarding" },
              { id: "kb-3", label: "Compliance" },
            ],
          }}
          currentValue={[]}
          onConfirm={onConfirm}
        />,
      );

      // 단일선택 <select> 가 아니라 체크박스 그룹이 렌더된다.
      expect(screen.queryByRole("combobox")).toBeNull();
      const kb1 = screen.getByRole("checkbox", { name: /Product docs/ });
      const kb3 = screen.getByRole("checkbox", { name: /Compliance/ });

      const confirmBtn = screen.getByRole("button", {
        name: /이 항목으로 설정/,
      }) as HTMLButtonElement;
      // 0개 선택 상태에서는 disabled.
      expect(confirmBtn.disabled).toBe(true);

      await user.click(kb1);
      await user.click(kb3);
      expect(confirmBtn.disabled).toBe(false);
      await user.click(confirmBtn);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith({
        mode: "multi",
        ids: ["kb-1", "kb-3"],
      });
    });

    it("enters '✓ 설정됨' when currentValue is a non-empty array (rehydrate)", () => {
      render(
        <CandidatePicker
          field={{
            field: "knowledgeBaseIds",
            widget: "kb-selector",
            label: "Knowledge Bases",
            selectionMode: "multi",
            candidates: [
              { id: "kb-1", label: "Product docs" },
              { id: "kb-2", label: "Onboarding" },
            ],
          }}
          currentValue={["kb-1", "kb-2"]}
          onConfirm={vi.fn()}
        />,
      );
      expect(screen.getByRole("status")).toBeDefined();
      // 다중선택 라벨은 모든 선택된 후보의 라벨이 표시된다 (콤마 결합).
      expect(screen.getByText(/Product docs/)).toBeDefined();
      expect(screen.getByText(/Onboarding/)).toBeDefined();
      expect(screen.queryByRole("checkbox")).toBeNull();
    });

    it("treats an empty array currentValue as not-yet-filled (interactive picker shown)", () => {
      render(
        <CandidatePicker
          field={{
            field: "mcpServers",
            widget: "mcp-server-selector",
            label: "MCP Servers",
            selectionMode: "multi",
            candidates: [{ id: "int-mcp-1", label: "GitHub MCP" }],
          }}
          currentValue={[]}
          onConfirm={vi.fn()}
        />,
      );
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByRole("checkbox", { name: /GitHub MCP/ })).toBeDefined();
    });

    it("rehydrate: mcp-server-selector currentValue ({integrationId}[]) shows '✓ 설정됨' with matched labels", () => {
      render(
        <CandidatePicker
          field={{
            field: "mcpServers",
            widget: "mcp-server-selector",
            label: "MCP Servers",
            selectionMode: "multi",
            candidates: [
              { id: "int-mcp-1", label: "GitHub MCP" },
              { id: "int-mcp-2", label: "Linear MCP" },
            ],
          }}
          currentValue={[
            { integrationId: "int-mcp-1", includeResources: true },
            { integrationId: "int-mcp-2", includeResources: true },
          ]}
          onConfirm={vi.fn()}
        />,
      );
      // 후보 라벨이 콤마 결합되어 status 박스에 표시되어야 한다 (raw id 노출 금지).
      expect(screen.getByRole("status")).toBeDefined();
      expect(screen.getByText(/GitHub MCP/)).toBeDefined();
      expect(screen.getByText(/Linear MCP/)).toBeDefined();
      expect(screen.queryByRole("checkbox")).toBeNull();
    });

    it("toggling a previously selected checkbox off re-disables Confirm", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
        <CandidatePicker
          field={{
            field: "knowledgeBaseIds",
            widget: "kb-selector",
            label: "Knowledge Bases",
            selectionMode: "multi",
            candidates: [
              { id: "kb-1", label: "Product docs" },
              { id: "kb-2", label: "Onboarding" },
            ],
          }}
          currentValue={[]}
          onConfirm={onConfirm}
        />,
      );
      const kb1 = screen.getByRole("checkbox", { name: /Product docs/ });
      const confirmBtn = screen.getByRole("button", {
        name: /이 항목으로 설정/,
      }) as HTMLButtonElement;
      // 선택 → 활성 → 다시 해제 → 비활성.
      await user.click(kb1);
      expect(confirmBtn.disabled).toBe(false);
      await user.click(kb1);
      expect(confirmBtn.disabled).toBe(true);
      // 해제된 상태로는 onConfirm 이 호출되지 않는다.
      await user.click(confirmBtn);
      expect(onConfirm).not.toHaveBeenCalled();
    });
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
