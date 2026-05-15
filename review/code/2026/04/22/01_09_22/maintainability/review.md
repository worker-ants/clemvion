## 유지보수성 코드 리뷰

---

### 발견사항

- **[WARNING]** `sanitizeAssistantText` 이중 호출 — 책임 소재 불명확
  - 위치: `assistant-message.tsx:44`, `markdown-renderer.tsx:25`
  - 상세: `AssistantMessageView`에서 `displayText = sanitizeAssistantText(message.content)`로 한 번 필터링하고, 그 결과를 `<MarkdownRenderer content={displayText} />`에 넘기면 `MarkdownRenderer` 내부에서 **동일 함수를 한 번 더 호출**한다. `sanitizeAssistantText`는 멱등(idempotent)이므로 결과는 바뀌지 않지만, "sanitize는 누가 담당하는가?"라는 소유권이 불분명해진다. 나중에 필터 로직을 변경할 때 두 곳을 모두 바꿔야 함을 기억해야 하고, `MarkdownRenderer`가 단독 사용될 경우 중복 비용이 더 명확해진다.
  - 제안: `MarkdownRenderer`에서 sanitize를 제거하고, "이 컴포넌트는 이미 정제된 텍스트를 받는다"는 사실을 인터페이스 레벨(JSDoc 한 줄)로만 명시. 혹은 반대로 `AssistantMessageView`에서는 가시성 여부(`showBubble`) 판단을 위한 길이 체크만 하고 실제 sanitize는 `MarkdownRenderer` 내부에 위임.

- **[WARNING]** `out.replace(m[0], "")` — 첫 번째 일치만 제거
  - 위치: `harmony-filter.ts:44`
  - 상세: `String.prototype.replace(string, "")` 은 첫 번째 출현만 교체한다. `matches` 배열의 동일 채널 블록 텍스트가 두 번 등장하면 두 번째는 그대로 남는다. 현실적으로 드물지만 방어 레이어의 목적에는 모든 패턴을 제거해야 한다.
  - 제안: `out = out.replaceAll(m[0], "")` 또는 `out = out.replace(new RegExp(escapeRegExp(m[0]), "g"), "")` 형태로 전체 교체.

- **[INFO]** `lastSignature` 계산에 `useMemo` 미적용 — 스타일 불일치
  - 위치: `assistant-panel.tsx:67-77`
  - 상세: 같은 컴포넌트에서 `snapshot`은 `useMemo`로 감싸 재계산을 억제하는 반면, `lastSignature`는 인라인 계산이다. `last.plan?.steps.filter(s => s.status === "done")` 이 매 렌더마다 새 배열을 생성한다. 채팅 패널은 스트리밍 중 빈번히 리렌더되므로 일관성 차원에서 `useMemo`가 적절하다.
  - 제안: `const lastSignature = useMemo(() => { ... }, [last, isStreaming]);` 으로 통일.

- **[INFO]** 테스트 주석과 기댓값 불일치
  - 위치: `harmony-filter.test.ts:37-38`
  - 상세: 주석이 "공백 정규화"라고 하지만 기댓값은 `"hello  world".trim()` — 내부 이중 공백이 그대로 유지된다. `trim()`은 앞뒤 공백만 제거하므로 중간 공백은 정규화되지 않는다. 주석이 실제 동작을 잘못 설명하고 있어, 향후 공백 처리 로직을 건드릴 때 혼선을 유발한다.
  - 제안: 주석에서 "공백 정규화" 표현을 제거하거나, 의도가 공백 보존이라면 기댓값을 `"hello  world"`로 직접 쓰고 주석을 삭제.

- **[INFO]** 시스템 프롬프트 내 유사 지침 중복
  - 위치: `system-prompt.ts:51-53`
  - 상세: 추가된 bullet이 "JSON·코드를 텍스트로 출력하지 말 것"을 금지하는 직전 두 bullet과 의도가 겹친다. 유일한 차별점은 "harmony 토큰"이라는 구체적 대상이지만, 세 항목의 경계가 모호해 프롬프트가 반복적으로 느껴진다. 프롬프트가 길어질수록 LLM이 중요 지침을 희석해서 받아들일 위험도 있다.
  - 제안: 기존 두 bullet과 통합하거나, "특히 harmony 제어 토큰도 해당된다"는 식으로 부연 형태로 축약.

- **[INFO]** 모듈 레벨 `/g` 플래그 정규식
  - 위치: `harmony-filter.ts:28`
  - 상세: `CHANNEL_BLOCK_RE`는 `g` 플래그를 갖는 모듈 레벨 상수다. `matchAll`과 함께 사용하면 매 호출마다 새 이터레이터를 생성하므로 `lastIndex` 문제는 발생하지 않는다. 하지만 `g` 플래그 + 모듈 상수 조합은 JS 개발자가 자주 실수하는 패턴이라, 미래 유지보수자가 `exec()` 루프로 교체할 경우 버그를 만들 수 있다.
  - 제안: 짧은 주석 `// always used with matchAll — lastIndex-safe` 추가 또는 함수 내부에서 정규식을 생성하는 형태로 전환.

---

### 요약

전체적으로 변경 범위와 목적이 명확하고, `harmony-filter.ts`는 단일 책임 원칙을 잘 따르며 테스트 커버리지도 충분하다. 가장 유의미한 유지보수성 우려는 **이중 sanitize 호출로 인한 책임 소재 불명확**이다 — `AssistantMessageView`와 `MarkdownRenderer` 모두 같은 함수를 호출하므로, 향후 필터 로직이 변경될 때 두 파일을 동시에 고려해야 한다는 암묵적 의존이 생긴다. 나머지 지적 사항은 모두 낮은 위험도의 스타일·일관성 문제다.

### 위험도

**LOW**