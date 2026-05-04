import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TriggerCell } from "../trigger-cell";
import { useLocaleStore } from "@/lib/stores/locale-store";
import type { ExecutionTriggerSource } from "@/lib/api/executions";

describe("TriggerCell", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
  });

  it.each<[ExecutionTriggerSource, string]>([
    ["manual", "Manual"],
    ["schedule", "Schedule"],
    ["webhook", "Webhook"],
    ["subworkflow", "Sub-workflow"],
    ["unknown", "—"],
  ])("renders source=%s with main label '%s'", (source, expected) => {
    render(<TriggerCell source={source} label={null} />);
    expect(screen.getByText(expected)).toBeDefined();
  });

  it("renders secondary label when provided", () => {
    render(<TriggerCell source="manual" label="Alice" />);
    expect(screen.getByText("Manual")).toBeDefined();
    expect(screen.getByText("Alice")).toBeDefined();
  });

  it("omits secondary label when null", () => {
    render(<TriggerCell source="schedule" label={null} />);
    expect(screen.getByText("Schedule")).toBeDefined();
    // null 라벨이면 "—" 같은 placeholder 도 추가로 렌더하지 않는다.
    expect(screen.queryByText("null")).toBeNull();
  });

  it("falls back to unknown for an unsupported source (defensive)", () => {
    // 배포 순서 불일치로 백엔드가 신규 source 를 보내거나, optional 타입이 풀린 데이터가
    // 캐시에 남아 있는 경우 등을 가정. 컴포넌트는 크래시하지 않고 unknown 으로 떨어진다.
    render(
      <TriggerCell
        source={"future_source" as unknown as ExecutionTriggerSource}
        label={null}
      />,
    );
    expect(screen.getByText("—")).toBeDefined();
  });
});
