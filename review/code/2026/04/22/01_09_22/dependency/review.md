### 발견사항

- **[INFO]** `sanitizeAssistantText` 이중 호출 (redundant double-sanitization)
  - 위치: `assistant-message.tsx:44` → `markdown-renderer.tsx:27`
  - 상세: `AssistantMessageView`가 `sanitizeAssistantText(message.content)`로 `displayText`를 만든 뒤 그것을 `<MarkdownRenderer content={displayText} />`에 전달하고, `MarkdownRenderer` 내부에서 다시 `sanitizeAssistantText(content)`를 호출한다. 함수가 idempotent하므로 결과는 동일하지만, `matchAll`로 regex를 두 번 순회하는 낭비가 발생한다.
  - 제안: `MarkdownRenderer`의 내부 sanitize를 제거하거나(`assistant-message.tsx`가 이미 정제된 값을 넘기므로), 반대로 `assistant-message.tsx`의 sanitize를 제거하고 `MarkdownRenderer`에만 위임하는 방식으로 단일화한다. 전자가 더 명확하다 — `MarkdownRenderer`를 순수 렌더러로 유지하고 sanitize 책임을 호출 측에만 둔다.

- **[INFO]** 모듈 수준 전역 regex 재사용 (`g` 플래그)
  - 위치: `harmony-filter.ts:18-20` (`CHANNEL_BLOCK_RE`, `ROLE_HEADER_RE`, `STRAY_TOKEN_RE`)
  - 상세: 세 regex 모두 `g` 플래그를 갖는다. `ROLE_HEADER_RE`와 `STRAY_TOKEN_RE`는 `String.prototype.replace`에서 사용되므로 `lastIndex` 상태 문제가 없다. `CHANNEL_BLOCK_RE`는 `matchAll`로 사용되는데, `matchAll`은 전달받은 regex를 내부적으로 복사하므로 역시 안전하다. 현재 코드는 문제없으나, 향후 `exec()` 루프 방식으로 변경 시 `lastIndex` 부패(stale state) 버그가 생길 수 있다는 점을 인지해 두면 좋다.
  - 제안: 현 상태 유지. 단 주석에 "do not use with exec() loop" 메모를 남기는 것을 고려.

- **[INFO]** `vitest` 사용 확인 필요
  - 위치: `harmony-filter.test.ts:1`
  - 상세: `import { describe, it, expect } from "vitest"`는 `vitest`가 이미 dev dependency로 등록되어 있다는 전제다. 이번 변경에서 새로 추가된 외부 패키지는 없으므로, 기존 환경이 그대로라면 문제없다.
  - 제안: 해당 없음 — 단순 확인 항목.

---

### 요약

이번 변경은 **외부 패키지를 전혀 추가하지 않는다.** `harmony-filter.ts`는 표준 JavaScript RegExp만 사용하는 순수 유틸리티이고, `harmony-filter.test.ts`는 기존 dev dependency인 `vitest`만 참조한다. 내부 의존 관계도 동일 디렉토리의 단방향 import로 정리되어 있어 순환 의존 위험이 없다. 유일한 실질적 지적 사항은 `assistant-message.tsx`와 `markdown-renderer.tsx`에서 `sanitizeAssistantText`가 동일 문자열에 대해 중복 호출된다는 점이며, 정확성에는 문제가 없고 성능 영향도 미미하지만 책임 소재를 단일화하는 것이 코드 명확성 면에서 바람직하다.

### 위험도

**LOW**