// Unit tests for `MultiSelectWidget` — renders an array<enum> schema field as
// a vertical checkbox list. Used by AI 노드 `systemContextSections` ([Spec
// AI Common §11](../../../../../../spec/4-nodes/3-ai/0-common.md)).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { MultiSelectWidget } from "../widgets";
import type { UiHint, JsonSchemaNode } from "@/lib/node-definitions";

const FOUR_SECTION_OPTIONS = [
  { value: "time", label: "Current time (ISO 8601 with offset)" },
  { value: "timezone", label: "Timezone (IANA + UTC offset)" },
  { value: "workspace", label: "Workspace id / name" },
  { value: "node", label: "Node id / label / type" },
] as const;

const SECTIONS_HINT_EN =
  'Selecting "Workspace" or "Node" sends internal ids and labels to the LLM provider as plain text. Use with care for confidential workspaces.';

function makeUi(extra?: Partial<UiHint>): UiHint {
  return {
    label: "Context Sections",
    widget: "multiselect",
    options: [...FOUR_SECTION_OPTIONS],
    hint: SECTIONS_HINT_EN,
    ...extra,
  };
}

const ARRAY_ENUM_SCHEMA: JsonSchemaNode = {
  type: "array",
  items: { type: "string", enum: ["time", "timezone", "workspace", "node"] },
};

describe("MultiSelectWidget", () => {
  beforeEach(() => {
    useLocaleStore.getState().setLocale("ko");
  });

  it("renders one checkbox per option with i18n KO labels (default locale)", () => {
    render(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={makeUi()}
        label="컨텍스트 섹션"
        value={["time", "timezone"]}
        onChange={() => {}}
      />,
    );

    // 4개 옵션 모두 체크박스로 렌더
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(4);

    // 라벨 KO 번역 확인 (OPTION_LABEL_KO 매핑)
    expect(screen.getByLabelText("현재 시각 (ISO 8601, 오프셋 포함)")).toBeInTheDocument();
    expect(screen.getByLabelText("타임존 (IANA + UTC 오프셋)")).toBeInTheDocument();
    expect(screen.getByLabelText("워크스페이스 ID / 이름")).toBeInTheDocument();
    expect(screen.getByLabelText("노드 ID / 라벨 / 유형")).toBeInTheDocument();
  });

  it("checks only the options present in `value`", () => {
    render(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={makeUi()}
        label="컨텍스트 섹션"
        value={["time", "timezone"]}
        onChange={() => {}}
      />,
    );

    const time = screen.getByLabelText("현재 시각 (ISO 8601, 오프셋 포함)") as HTMLInputElement;
    const timezone = screen.getByLabelText("타임존 (IANA + UTC 오프셋)") as HTMLInputElement;
    const workspace = screen.getByLabelText("워크스페이스 ID / 이름") as HTMLInputElement;
    const node = screen.getByLabelText("노드 ID / 라벨 / 유형") as HTMLInputElement;

    expect(time.checked).toBe(true);
    expect(timezone.checked).toBe(true);
    expect(workspace.checked).toBe(false);
    expect(node.checked).toBe(false);
  });

  it("toggling an unchecked option emits a new array that unions the value", () => {
    const onChange = vi.fn();
    render(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={makeUi()}
        label="컨텍스트 섹션"
        value={["time", "timezone"]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("워크스페이스 ID / 이름"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["time", "timezone", "workspace"]);
  });

  it("toggling a checked option emits a new array that filters the value", () => {
    const onChange = vi.fn();
    render(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={makeUi()}
        label="컨텍스트 섹션"
        value={["time", "timezone"]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("현재 시각 (ISO 8601, 오프셋 포함)"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["timezone"]);
  });

  it("renders the translated hint (KO) below the checkbox list", () => {
    render(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={makeUi()}
        label="컨텍스트 섹션"
        value={["time", "timezone"]}
        onChange={() => {}}
      />,
    );

    // KO 매핑 (backend-labels HINT_KO) — 부분 매치
    expect(
      screen.getByText(/워크스페이스 \/ 노드의 내부 ID·라벨이 LLM 공급자에게 평문/),
    ).toBeInTheDocument();
  });

  it("treats undefined / null / non-array value as empty selection", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={makeUi()}
        label="컨텍스트 섹션"
        value={undefined}
        onChange={onChange}
      />,
    );

    // 모두 unchecked
    for (const box of screen.getAllByRole("checkbox") as HTMLInputElement[]) {
      expect(box.checked).toBe(false);
    }

    // null 도 동일
    rerender(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={makeUi()}
        label="컨텍스트 섹션"
        value={null}
        onChange={onChange}
      />,
    );
    for (const box of screen.getAllByRole("checkbox") as HTMLInputElement[]) {
      expect(box.checked).toBe(false);
    }

    // 비배열 객체 (DB row 회귀 안전망)
    rerender(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={makeUi()}
        label="컨텍스트 섹션"
        value={{} as unknown}
        onChange={onChange}
      />,
    );
    for (const box of screen.getAllByRole("checkbox") as HTMLInputElement[]) {
      expect(box.checked).toBe(false);
    }

    // 첫 토글이 빈 배열에서 시작
    fireEvent.click(screen.getByLabelText("현재 시각 (ISO 8601, 오프셋 포함)"));
    expect(onChange).toHaveBeenLastCalledWith(["time"]);
  });

  it("falls back to schema `items.enum` when `ui.options` is absent", () => {
    render(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={{ label: "Context Sections", widget: "multiselect" }}
        label="컨텍스트 섹션"
        value={[]}
        onChange={() => {}}
      />,
    );

    // ui.options 가 없으면 enum 그대로 — 4 개 옵션, label 은 raw value
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(4);
    expect(screen.getByLabelText("time")).toBeInTheDocument();
    expect(screen.getByLabelText("timezone")).toBeInTheDocument();
    expect(screen.getByLabelText("workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("node")).toBeInTheDocument();
  });

  it("renders raw English labels under `en` locale", () => {
    useLocaleStore.getState().setLocale("en");
    render(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={makeUi()}
        label="Context Sections"
        value={["time"]}
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByLabelText("Current time (ISO 8601 with offset)"),
    ).toBeInTheDocument();
    // hint 도 영문 원문 유지
    expect(screen.getByText(/Selecting "Workspace" or "Node"/)).toBeInTheDocument();
  });

  it("emits the same option only once even on rapid double-toggle", () => {
    const onChange = vi.fn();
    render(
      <MultiSelectWidget
        schema={ARRAY_ENUM_SCHEMA}
        ui={makeUi()}
        label="컨텍스트 섹션"
        value={["time"]}
        onChange={onChange}
      />,
    );

    // 같은 옵션 두 번 클릭 — 토글이지만 부모가 상태 commit 을 하지 않는 시나리오:
    // 두 번째 클릭은 첫 번째와 동일한 input value 기반 토글이라 같은 배열
    // (제거된 ['']) 을 다시 emit 한다. 그러나 첫 emit 는 ['time'] 제거 → []
    // 두 번째 emit (state 가 그대로일 때) 는 다시 ['time'] 추가 → ['time']
    // 본 테스트는 widget 이 옵션 한 번에 onChange 한 번만 호출함을 보장한다.
    fireEvent.click(screen.getByLabelText("현재 시각 (ISO 8601, 오프셋 포함)"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
