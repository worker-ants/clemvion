## 리뷰 발견사항

### [WARNING] 이중 sanitization (불필요한 중복 호출)
- **위치:** `assistant-message.tsx:43`, `markdown-renderer.tsx:27`
- **상세:** `AssistantMessageView`가 `sanitizeAssistantText(message.content)` → `displayText`를 만든 뒤, 이 값을 `<MarkdownRenderer content={displayText} />`에 전달한다. 그런데 `MarkdownRenderer` 내부에서 동일한 `sanitizeAssistantText(content)`를 또 한 번 호출한다. 함수 자체는 순수 함수이므로 멱등(idempotent)하여 결과에 영향은 없지만, 하위 컴포넌트가 "이미 정제된 문자열"을 받는다는 사실을 인지하지 못하는 상황이 된다.
- **제안:** `MarkdownRenderer`의 sanitize 호출을 제거하거나, `AssistantMessageView`의 sanitize를 제거하고 `MarkdownRenderer` 단독에서만 수행. 어느 레이어가 책임을 갖는지 명확히 선택.

---

### [WARNING] 스트리밍 중 불완전 토큰 노출 — 테스트 미비
- **위치:** `harmony-filter.ts`, `harmony-filter.test.ts`
- **상세:** 실제 스트리밍 환경에서는 SSE delta 단위로 문자열이 점진적으로 누적된다. 예를 들어 "좋은 아침입니다`<|channel`" 처럼 토큰 시작(`<|`)만 있고 닫힘(`|>`)이 없는 상태로 렌더가 발생할 수 있다. `CHANNEL_BLOCK_RE`는 `<|message|>`가 없으면 매칭하지 않고, `STRAY_TOKEN_RE`(`/<\|[^|>]*\|>/g`)도 닫히지 않은 `<|channel`은 매칭하지 않는다. 결과적으로 부분 토큰이 사용자에게 그대로 노출된다.
- **제안:** 테스트 케이스 추가:
  ```ts
  it("strips incomplete harmony token at end of streaming chunk", () => {
    expect(sanitizeAssistantText("안녕하세요<|channel")).toBe("안녕하세요");
    expect(sanitizeAssistantText("정상 텍스트<|")).toBe("정상 텍스트");
  });
  ```
  그리고 함수 내에 `/<\|[^>]*$/` 패턴으로 말미의 불완전 토큰을 추가 제거.

---

### [WARNING] 채널 이름 대소문자 변형 테스트 누락
- **위치:** `harmony-filter.ts:33`, `harmony-filter.test.ts`
- **상세:** 코드는 `(m[1] ?? "").toLowerCase() === "final"`로 대소문자를 무시하지만, 테스트 케이스는 모두 소문자 `final`만 다룬다. `<|channel|>Final<|message|>body`나 `<|channel|>FINAL<|message|>body` 같은 입력이 테스트되지 않는다.
- **제안:**
  ```ts
  it("treats Final/FINAL channel same as final", () => {
    expect(sanitizeAssistantText("<|channel|>Final<|message|>정답<|end|>")).toBe("정답");
    expect(sanitizeAssistantText("<|channel|>FINAL<|message|>정답")).toBe("정답");
  });
  ```

---

### [INFO] `<|end|>` 이후 trailing 문자 처리 미테스트
- **위치:** `harmony-filter.ts`, `harmony-filter.test.ts`
- **상세:** 테스트 케이스 4(`framed`)는 `<|end|>`로 끝나는 패턴을 다루지만, `<|end|>` 뒤에 일반 텍스트가 이어지는 경우(`<|channel|>final<|message|>정답<|end|>뒤에 텍스트`)는 테스트하지 않는다. 현재 구현의 final-path는 `m[2]`(body)만 반환하므로 `<|end|>` 이후 텍스트는 버려지는데, 이것이 의도인지 불명확하다.
- **제안:** 스펙상 의도를 확인 후 테스트 추가.

---

### [INFO] `assistant-panel.tsx` `lastSignature` 로직 단위 테스트 없음
- **위치:** `assistant-panel.tsx:67-76`
- **상세:** tool_call 배지·plan 카드·step 체크 진행을 auto-scroll 트리거에 포함하기 위해 `lastSignature` 계산 로직이 추가됐다. 이 로직은 컴포넌트 내 인라인으로 존재해 단독 단위 테스트가 불가능하다. 순수 함수로 추출하면 테스트 가능성이 높아진다.
- **제안:**
  ```ts
  // 예시
  export function buildLastSignature(msg: AssistantDisplayMessage | undefined) {
    if (!msg) return "";
    return [msg.content.length, msg.toolCalls.length, ...].join("|");
  }
  ```

---

### [INFO] `AssistantMessageView` 렌더 조건 컴포넌트 테스트 없음
- **위치:** `assistant-message.tsx:43-45`
- **상세:** harmony 토큰만 있는 메시지 → `displayText = ""` → `showBubble = false`로 bubble이 숨겨지는 핵심 UX 로직이 컴포넌트 테스트로 검증되지 않는다. `harmony-filter.test.ts`는 `sanitizeAssistantText` 함수만 테스트하며, 컴포넌트 수준의 렌더링 조건(bubble 표시 여부)은 커버되지 않는다.
- **제안:** React Testing Library를 사용한 컴포넌트 테스트 추가:
  ```ts
  it("hides bubble when content sanitizes to empty", () => {
    render(<AssistantMessageView message={{ content: "<|channel|>commentary<|message|>{}", ... }} />);
    expect(screen.queryByRole("region")).toBeNull();
  });
  ```

---

### [INFO] `sanitizeAssistantText`의 반환값 trim 동작 경계 케이스
- **위치:** `harmony-filter.ts:46`, 테스트 케이스 `keeps prose that precedes a trailing commentary leak`
- **상세:** 해당 테스트에서 예상값이 `"사용자에게 보여줄 답변입니다."` (trailing `\n\n` 없음)인데, 이는 `stripHarmonyTokens`의 최종 `.trim()`에 의존한다. 원본 prose에 의도적인 trailing newline이 있었을 경우도 제거되는데, 이 동작이 명시적으로 문서화되거나 테스트되지 않았다.

---

## 요약

`harmony-filter.ts`의 핵심 로직과 `harmony-filter.test.ts` 테스트는 전반적으로 잘 작성되어 있다. 문서화된 8가지 케이스(full commentary block, analysis channel, mixed prose, final channel extraction, final preference, stray tokens, normal text, empty input)가 모두 커버된다. 그러나 실제 스트리밍 환경에서 발생하는 **불완전(partial) 토큰** 시나리오가 테스트되지 않아 스트리밍 중 누락 없는 필터링을 보장할 수 없고, `MarkdownRenderer`의 **이중 sanitization**은 책임 소재를 불명확하게 만든다. 컴포넌트 수준(bubble 표시 여부, auto-scroll 트리거)의 통합 테스트가 전무한 점도 회귀 방지 관점에서 취약점으로 남는다.

## 위험도

**MEDIUM** — 핵심 순수 함수(sanitizeAssistantText) 자체는 안전하나, 스트리밍 부분 토큰 노출 가능성과 컴포넌트 수준 테스트 부재가 실사용 환경에서 UX 결함으로 이어질 수 있다.