import { describe, it, expect } from "vitest";
import { OVERRIDE_REGISTRY } from "../override-registry";

// cross-audit V-02: ai_agent · text_classifier · information_extractor 는
// schema-driven auto-form(SchemaForm)으로 렌더돼야 한다 — bespoke override 폼이
// zod schema 가 노출 명시한 필드(conversation-context · agent-memory ·
// system-context · examples · enumValues 등)를 렌더 못 해 폐기됐다.
// 누군가 이 노드를 다시 OVERRIDE_REGISTRY 에 추가하면 spec
// 3-workflow-editor/1-node-common.md §2.6.3 트랙 배정과 어긋나고 필드 노출
// 회귀가 재발하므로, 단위 테스트로 미등록을 고정한다.
describe("OVERRIDE_REGISTRY — AI 노드 auto-form 트랙 (V-02)", () => {
  it("ai_agent · text_classifier · information_extractor 는 override 미등록(auto-form)", () => {
    expect(OVERRIDE_REGISTRY.ai_agent).toBeUndefined();
    expect(OVERRIDE_REGISTRY.text_classifier).toBeUndefined();
    expect(OVERRIDE_REGISTRY.information_extractor).toBeUndefined();
  });

  it("cross-field side effect 가 남은 노드는 override 등록 유지", () => {
    // switch(case/port 동기화) · table(column/row 동기화) 는 auto-form 표현력
    // 밖이라 bespoke override 를 유지한다 (§2.6.3 override 잔존 목록).
    expect(OVERRIDE_REGISTRY.switch).toBeDefined();
    expect(OVERRIDE_REGISTRY.table).toBeDefined();
  });
});
