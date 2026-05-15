### 발견사항

- **[WARNING]** `assistant-panel.tsx` 자동 스크롤 로직이 harmony filter 와 무관하게 교체됨
  - 위치: `assistant-panel.tsx` diff, `lastMessageLength` → `lastSignature` 교체 부분
  - 상세: 원래 `lastMessageLength`(content 길이만 추적)가 `lastSignature`(content + toolCalls 수 + plan steps 수 + 완료 steps 수 + streaming 상태를 파이프로 이어붙인 복합 키)로 교체됐다. 이 변경은 harmony 토큰 필터링과 무관하며 "툴 배지 추가·plan 카드 추가·step 체크 진행 시 스크롤이 내려가지 않던 기존 버그"를 함께 수정한 것이다. useEffect 내부도 `listRef.current` null 체크 패턴이 `const el = listRef.current; if (!el) return;` 형태로 소폭 리팩터링됐다.
  - 제안: 무관한 버그 수정이 하나의 PR/커밋에 혼합되면 리뷰 범위가 넓어지고, harmony filter 단독 롤백 시 스크롤 개선도 함께 되돌아간다. 자동 스크롤 개선은 별도 커밋으로 분리하거나 PR 설명에 "의도된 동반 수정"으로 명시하는 것이 바람직하다.

- **[INFO]** `spec/4-ai-assistant.md` 메시지 리스트 행이 harmony filter 설명 외에 auto-scroll 개선도 함께 추가됨
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md`, `| 메시지 리스트 |` 행
  - 상세: "새 이벤트(text delta, tool_call 배지, plan 카드, plan step 체크 진행) 가 들어올 때마다 리스트가 자동으로 하단으로 스크롤된다" 구절은 harmony filter 기능이 아니라 위 `assistant-panel.tsx`의 스크롤 개선 내용이다. 두 변경이 같은 spec 행에 묶여 있어, 기능 추적이나 이력 파악에 모호함이 생긴다.
  - 제안: 분리된 두 개선을 spec에서도 별도 항목 또는 별도 업데이트 커밋으로 구분하는 편이 낫다.

- **[INFO]** `markdown-renderer.tsx`에 sanitize가 이중으로 적용되는 방어 코드 존재
  - 위치: `markdown-renderer.tsx` + `assistant-message.tsx`
  - 상세: `assistant-message.tsx`에서 이미 `sanitizeAssistantText(message.content)` 한 결과만 `<MarkdownRenderer content={displayText} />`에 전달하는데, `MarkdownRenderer` 내부에서도 다시 `sanitizeAssistantText(content)`를 호출한다. 중복 sanitize 자체가 버그를 일으키지는 않지만 순수함수이므로 호출 비용이 미미하게 두 배가 된다.
  - 제안: 상위에서 sanitize 후 전달한다면 `MarkdownRenderer` 내부의 sanitize는 제거하거나, 반대로 `assistant-message.tsx`에서 sanitize를 제거하고 `MarkdownRenderer` 한 곳에만 두는 방식 중 하나로 정리하면 더 단순해진다.

---

### 요약

변경의 핵심 목적인 harmony 제어 토큰 필터링(신규 `harmony-filter.ts`·`harmony-filter.test.ts`, `markdown-renderer.tsx` 적용, `system-prompt.ts` 지침 추가, `assistant-message.tsx` 버블 숨김 로직)은 모두 의도된 범위 내에 있다. 그러나 `assistant-panel.tsx`의 자동 스크롤 시그니처 확장은 harmony filter와 무관한 별도 버그 수정으로, 같은 PR에 조용히 포함된 범위 이탈이다. 기능적 충돌은 없지만 단일 책임 원칙 면에서 분리하는 것이 권장된다. `markdown-renderer.tsx` 이중 sanitize는 기능 문제는 아니나 불필요한 중복이다.

### 위험도

**LOW**