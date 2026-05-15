## 성능 코드 리뷰

### 발견사항

---

**[WARNING] MarkdownRenderer에서 이중 sanitize 실행**
- 위치: `markdown-renderer.tsx:25`, `assistant-message.tsx:39`
- 상세: `AssistantMessageView`가 `sanitizeAssistantText(message.content)`로 `displayText`를 만들고, 이미 sanitize된 `displayText`를 `<MarkdownRenderer content={displayText} />`에 넘긴다. `MarkdownRenderer`는 내부에서 받은 `content`를 다시 `sanitizeAssistantText(content)`로 처리한다. 스트리밍 중 매 text delta마다 regex 연산이 두 번 실행된다.
- 제안: `MarkdownRenderer` 내부의 `sanitizeAssistantText` 호출을 제거하거나, 반대로 상위 컴포넌트에서의 호출을 제거하고 `MarkdownRenderer`에만 위치시킨다.

---

**[WARNING] `lastSignature` 계산이 매 렌더마다 실행됨**
- 위치: `assistant-panel.tsx:67–78`
- 상세: `last.plan?.steps.filter((s) => s.status === "done").length`가 `useMemo` 없이 컴포넌트 body에서 직접 계산된다. 스트리밍 중 `AssistantPanel`이 빈번하게 리렌더될 때마다 steps 배열 전체를 순회하는 `filter()` 연산과 배열 join이 매번 발생한다.
- 제안:
  ```typescript
  const lastSignature = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last) return "";
    return [
      last.content.length,
      last.toolCalls.length,
      last.plan?.steps.length ?? 0,
      last.plan?.steps.filter((s) => s.status === "done").length ?? 0,
      last.streaming ? 1 : 0,
    ].join("|");
  }, [messages]);
  ```

---

**[WARNING] `sanitizeAssistantText` 비메모이즈 호출 (assistant-message.tsx)**
- 위치: `assistant-message.tsx:39`
- 상세: 스트리밍 중 부모 컴포넌트(`AssistantPanel`)가 리렌더되면 `AssistantMessageView`도 리렌더된다. `message.content`가 바뀌지 않아도 regex 처리가 매번 실행된다. 스트리밍 완료 후 plan step 체크 등으로 인한 리렌더 시에도 동일하게 재실행된다.
- 제안:
  ```typescript
  const displayText = useMemo(
    () => (message.content ? sanitizeAssistantText(message.content) : ""),
    [message.content]
  );
  ```

---

**[INFO] 루프 내 반복 문자열 교체로 인한 중간 문자열 생성**
- 위치: `harmony-filter.ts:42–44`
- 상세: `for (const m of matches) { out = out.replace(m[0], ""); }` 패턴은 매 iteration마다 새 문자열을 할당한다. matches 수가 k개면 k개의 중간 문자열이 생성된다. 일반적인 chat 메시지 크기에서는 무해하나, 채널 블록이 많을 때 비효율적이다.
- 제안: 매치 위치를 기반으로 한 번에 문자열을 재조립하거나, 정규식 기반 단일 `replace`로 대체한다.

---

**[INFO] 모듈 레벨 global 정규식의 `lastIndex` 공유 위험**
- 위치: `harmony-filter.ts:28–30` (`CHANNEL_BLOCK_RE`, `ROLE_HEADER_RE`, `STRAY_TOKEN_RE`)
- 상세: `/g` 플래그가 붙은 모듈 레벨 정규식은 `lastIndex` 상태를 공유한다. `matchAll()`과 `replace()`는 현재 스펙상 `lastIndex`를 올바르게 리셋하므로 현재 코드에서는 문제가 없다. 그러나 향후 `.exec()` 루프 방식으로 변경 시 silent bug가 될 수 있다.
- 제안: 함수 내부에서 `new RegExp(...)` 로 생성하거나, 현재 사용 패턴을 유지한다면 주석으로 의도를 명시한다.

---

### 요약

변경사항의 핵심 로직인 `harmony-filter.ts` 자체의 알고리즘 구조는 양호하다. 실질적인 성능 문제는 두 컴포넌트 레이어(`AssistantMessageView` → `MarkdownRenderer`)에서 동일한 regex 연산이 이중으로 실행되는 것이며, 스트리밍 중 고빈도 리렌더와 맞물려 불필요한 연산이 누적된다. `lastSignature`의 `filter()` 연산도 `useMemo` 없이 매 렌더마다 실행되어 스트리밍 중 추가 오버헤드를 만든다. 두 이슈 모두 `useMemo` 적용과 sanitize 레이어 중복 제거로 해결 가능하며, 수정 난이도는 낮다.

### 위험도

**LOW** — 현재 chat 메시지 규모에서는 체감 성능 저하가 발생하기 어렵지만, 구조적 이중 연산은 불필요한 비용이므로 정리를 권장한다.