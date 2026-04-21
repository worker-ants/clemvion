## 발견사항

### [WARNING] `sanitizeAssistantText` 이중 호출 — 동일 컨텐츠에 regex 두 번 실행
- **위치**: `assistant-message.tsx:42` + `markdown-renderer.tsx:25`
- **상세**: `AssistantMessageView`에서 `sanitizeAssistantText(message.content)`를 먼저 실행해 `displayText`를 만들고, 그 결과를 `<MarkdownRenderer content={displayText} />`로 전달한다. `MarkdownRenderer` 내부에서도 다시 `sanitizeAssistantText(content)`를 실행하므로 동일 문자열에 regex가 두 번 적용된다. 함수는 멱등(idempotent)이라 결과는 동일하지만, 스트리밍 중 text delta마다 컴포넌트가 재렌더될 때 불필요한 regex 연산이 2배로 발생한다.
- **제안**: `MarkdownRenderer`는 범용 컴포넌트로 외부 진입점을 위한 방어 sanitize를 유지하되, `AssistantMessageView`에서 `MarkdownRenderer`로 이미 sanitized 결과를 내려보내는 경우 한 쪽에서만 호출하도록 분리하거나, `displayText` 계산을 `useMemo`로 감싸 렌더 횟수를 줄이는 것이 우선이다.

---

### [WARNING] `displayText` memoization 부재 — 스트리밍 중 고빈도 regex 실행
- **위치**: `assistant-message.tsx:42`
- **상세**: `displayText = sanitizeAssistantText(message.content)`가 `useMemo` 없이 인라인으로 계산된다. 스트리밍 중에는 text delta마다 부모(assistant-panel)가 재렌더되어 `AssistantMessageView`도 함께 재렌더된다. `CHANNEL_BLOCK_RE`는 `[\s\S]*?` lazy quantifier를 포함한 복합 regex로, 텍스트 길이에 비례한 비용이 발생한다.
- **제안**:
  ```tsx
  const displayText = useMemo(
    () => (message.content ? sanitizeAssistantText(message.content) : ""),
    [message.content]
  );
  ```

---

### [WARNING] `lastSignature` 인라인 `.filter()` — 렌더마다 배열 순회
- **위치**: `assistant-panel.tsx:70-80`
- **상세**: `last.plan?.steps.filter((s) => s.status === "done").length`가 `useMemo` 없이 매 렌더마다 실행된다. plan steps 수가 많아질수록(현재 상한 32회) 렌더마다 배열을 순회한다. isStreaming 중에는 렌더 빈도가 높다.
- **제안**: `lastSignature`를 `useMemo`로 감싸거나, `filter` 대신 `reduce`로 done count를 단일 패스로 계산한다.

---

### [INFO] `String.replace` without `/g` — 동일 매치 문자열 중복 시 첫 번째만 제거
- **위치**: `harmony-filter.ts:44-46`
- **상세**:
  ```ts
  for (const m of matches) {
    out = out.replace(m[0], "");  // /g 없음
  }
  ```
  `m[0]`(전체 매치 문자열)이 원본 문자열에 두 번 이상 등장하면 첫 번째만 제거된다. 실제 LLM 출력에서 동일한 channel block이 리터럴로 반복될 가능성은 낮지만, 이론적 허점이다.
- **제안**: `out = out.split(m[0]).join("")` 또는 `m[0]`을 regex로 escape해 `/g`로 대체.

---

### [INFO] 시스템 프롬프트 길이 증가 → 토큰 비용 소폭 증가
- **위치**: `system-prompt.ts:54`
- **상세**: 추가된 지침 라인은 약 60 토큰이다. 매 API 호출마다 시스템 프롬프트가 전송되므로 누적 비용이 소폭 증가한다. 기능적으로는 문제 없다.

---

### [INFO] `CHANNEL_BLOCK_RE` 모듈 수준 regex `/g` 플래그 — 안전 확인
- **위치**: `harmony-filter.ts:29`
- **상세**: `/g` 플래그를 가진 regex를 모듈 상수로 선언하고 `matchAll`에 전달한다. `String.prototype.matchAll`은 내부적으로 regex를 복제(clone)하므로 원본 regex의 `lastIndex`가 변경되지 않는다. 안전하다.

---

## 요약

이번 변경은 LLM harmony 제어 토큰 leak을 UI 레이어에서 방어하는 목적에 충실하며, 전역 상태 변경·API 시그니처 파괴·의도치 않은 네트워크 호출 등 심각한 부작용은 없다. 주요 리스크는 스트리밍 중 memoization 없이 동일 내용에 regex가 이중 실행(parent+child)되는 성능 낭비이며, `displayText`와 `lastSignature`를 `useMemo`로 감싸는 것으로 대부분 해소된다. `String.replace` without `/g` 케이스는 실제 입력 패턴상 발현 가능성이 낮다.

## 위험도

**LOW**