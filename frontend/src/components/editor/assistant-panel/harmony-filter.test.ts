import { describe, it, expect } from "vitest";
import { sanitizeAssistantText } from "./harmony-filter";

/**
 * harmony-filter 는 LLM 이 assistant text 채널로 새어나오는 OpenAI
 * harmony 제어 토큰(`<|channel|>...`, `<|message|>...`, `<|end|>` 등) 을
 * UI 렌더 직전에 제거한다. 목적은 두 가지다:
 *  1) 사용자가 제어 토큰·JSON 인자 덩어리를 날것으로 보지 않도록.
 *  2) 정상적인 prose 가 있다면 그것만 깔끔히 남기도록.
 */
describe("sanitizeAssistantText", () => {
  it("returns empty string when the entire content is a commentary/json block", () => {
    const leak =
      '<|channel|>commentary <|constrain|>json<|message|>{"steps":[{"id":"P1","action":"add_node"}],"title":"x"}';
    expect(sanitizeAssistantText(leak)).toBe("");
  });

  it("drops analysis channel blocks entirely", () => {
    const leak =
      "<|channel|>analysis<|message|>reasoning stuff we should not show";
    expect(sanitizeAssistantText(leak)).toBe("");
  });

  it("keeps prose that precedes a trailing commentary leak", () => {
    // 모델이 정상 답변 뒤에 commentary 채널을 흘리는 패턴
    const mixed =
      '사용자에게 보여줄 답변입니다.\n\n<|channel|>commentary <|constrain|>json<|message|>{"k":1}';
    expect(sanitizeAssistantText(mixed)).toBe("사용자에게 보여줄 답변입니다.");
  });

  it("extracts only the body of a final-channel block when present", () => {
    const framed =
      "<|start|>assistant<|channel|>final<|message|>최종 답변입니다.<|end|>";
    expect(sanitizeAssistantText(framed)).toBe("최종 답변입니다.");
  });

  it("prefers final-channel body over other leaked channels", () => {
    const framed =
      "<|channel|>analysis<|message|>생각 중<|end|>" +
      "<|channel|>final<|message|>정답<|end|>" +
      "<|channel|>commentary <|constrain|>json<|message|>{}";
    expect(sanitizeAssistantText(framed)).toBe("정답");
  });

  it("strips stray harmony tokens from otherwise normal prose (inner whitespace is preserved, not collapsed)", () => {
    const tokensOnly = "hello <|start|>assistant<|message|> world";
    // role header 전체(`<|start|>assistant<|message|>`)는 잘려나가고, 원본
    // 텍스트에 있던 두 개의 공백 사이는 그대로 유지된다. sanitize 는 공백을
    // 정규화하지 않는다.
    expect(sanitizeAssistantText(tokensOnly)).toBe("hello  world");
  });

  it("treats channel name case-insensitively (Final, FINAL as final)", () => {
    const mixedCase =
      "<|channel|>Final<|message|>정답 A<|end|>" +
      "<|channel|>FINAL<|message|>정답 B<|end|>";
    expect(sanitizeAssistantText(mixedCase)).toBe("정답 A\n\n정답 B");
  });

  it("removes repeated non-final channel blocks globally (replaceAll semantics)", () => {
    // 동일한 commentary 블록이 두 번 이상 연속 등장해도 모두 제거되어야 한다.
    // (블록 사이에 prose 가 끼는 케이스는 실제 leak 패턴이 아니므로 여기서는
    //  블록이 prose 뒤에 붙어있는 현실적 형태를 검증한다.)
    const repeated =
      '사용자 답변\n<|channel|>commentary<|message|>{"x":1}<|channel|>commentary<|message|>{"x":1}';
    expect(sanitizeAssistantText(repeated)).toBe("사용자 답변");
  });

  it("drops trailing partial harmony tokens mid-stream", () => {
    // 스트리밍 delta 경계에서 토큰이 반만 들어온 꼬리 — 다음 delta 가 붙기
    // 전까지 사용자에게 노출되지 않도록 렌더 시 제거한다.
    expect(sanitizeAssistantText("hello <|chan")).toBe("hello");
    expect(sanitizeAssistantText("정상 본문 <|channel")).toBe("정상 본문");
  });

  it("leaves regular text untouched", () => {
    const normal =
      "플랜을 승인해 주시면 1단계부터 시작하겠습니다.\n\n- HTTP 노드 추가\n- Switch 연결";
    expect(sanitizeAssistantText(normal)).toBe(normal);
  });

  it("handles empty/undefined-like input safely", () => {
    expect(sanitizeAssistantText("")).toBe("");
    expect(sanitizeAssistantText("   \n ")).toBe("");
  });
});
