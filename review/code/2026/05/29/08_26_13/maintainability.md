# 유지보수성(Maintainability) 리뷰

## 발견사항

### 1. 가독성

- **[INFO]** `useCopyToClipboard` 훅 — 의도가 명확하고 JSDoc이 충실함
  - 위치: `codebase/frontend/src/lib/hooks/use-copy-to-clipboard.ts`
  - 상세: 함수 시그니처, 반환 타입, 동작 설명이 JSDoc으로 정확히 문서화되어 있다. 훅이 단일 책임을 갖고, 코드 자체도 12줄 이내로 간결하다.
  - 제안: 없음. 현재 수준이 적절하다.

- **[INFO]** `trigger-detail-drawer.tsx` — `ChatChannelCard.handleSave` 는 `useMutation`으로 전환되지 않고 기존 `saving` state / try-catch 패턴을 유지
  - 위치: `trigger-detail-drawer.tsx` 내 `ChatChannelCard` (전체 파일 컨텍스트 기준 라인 ~1786–1848)
  - 상세: 이번 PR 에서 `ExternalInteractionCard.handleSave` 는 `useMutation`으로 통일되었으나 바로 인접한 `ChatChannelCard.handleSave` 는 같은 구조(`setSaving(true)` / try-catch / `finally setSaving(false)`)를 그대로 보유한다. 카드 간 구현 방식이 상이해 미래 수정 시 어느 쪽을 참조해야 하는지 혼란을 준다.
  - 제안: 후속 PR 에서 `ChatChannelCard.handleSave` 도 `useMutation`으로 교체하여 카드 간 패턴을 통일한다.

### 2. 네이밍

- **[INFO]** `mockApi` 함수명 — 충분히 직관적이나 반환값 없음이 명시되지 않음
  - 위치: `codebase/frontend/src/components/triggers/__tests__/trigger-detail-drawer.test.tsx` 라인 103
  - 상세: 이름과 역할이 잘 매치된다. 내부 테스트 헬퍼이므로 문서화 부재가 허용 가능한 수준이다.
  - 제안: 없음.

- **[INFO]** `renderDrawer` 함수 — `props`를 반환하나 대부분의 케이스에서 반환값을 무시함
  - 위치: `trigger-detail-drawer.test.tsx` 라인 115–134
  - 상세: 현재 모든 테스트가 반환값을 사용하지 않아 의도가 불명확하지만, `onClose` 스파이 검증 등 확장성을 고려한 설계로 해석할 수 있다.
  - 제안: 없음. 현재 수준이 허용 범위 내이다.

### 3. 함수 길이 / 단일 책임

- **[WARNING]** `ChatChannelCard` 컴포넌트 — 약 200줄 이상, 복수의 책임 혼재
  - 위치: `trigger-detail-drawer.tsx` 내 `ChatChannelCard` (전체 파일 컨텍스트 라인 ~1722 이후)
  - 상세: 이번 PR의 변경 범위에 포함되지는 않지만, `ChatChannelCard`는 read 표시 / edit 폼 / rotate modal / handleSave / handleRotate 를 모두 담고 있어 단일 컴포넌트로서 책임이 과도하다.
  - 제안: 현재 PR 범위 밖이므로 즉각 수정 요구 대상은 아니다. 중장기적으로 edit 폼 및 rotate modal 을 별도 컴포넌트로 분리하는 것을 권장한다.

- **[INFO]** `ExternalInteractionCard.saveMutation.mutationFn` — 15줄 내외로 적절한 길이
  - 위치: `trigger-detail-drawer.tsx` `ExternalInteractionCard` 내 `saveMutation`
  - 상세: `useMutation` 전환 후 `mutationFn`, `onSuccess`, `onError` 로 관심사가 명확히 분리되어 있다.
  - 제안: 없음.

### 4. 중첩 깊이

- **[INFO]** `ChatChannelCard.handleSave` 내 try-catch 이중 중첩
  - 위치: `trigger-detail-drawer.tsx` 내 `ChatChannelCard.handleSave`
  - 상세: `languageHints` JSON 파싱을 위한 내부 try-catch 가 외부 try-catch 안에 중첩되어 있다. 이번 PR 변경 대상이 아니나 동일 패턴이 개선 없이 유지된다.
  - 제안: `parseLanguageHints` 와 같은 별도 함수로 JSON 파싱 로직을 분리해 중첩을 제거한다.

### 5. 매직 넘버

- **[WARNING]** `rateLimitPerMinute` 기본값 `60` 이 두 곳에 하드코딩
  - 위치: `trigger-detail-drawer.tsx` 전체 파일 컨텍스트 (`useState` 초기화 및 read-mode 표시)
  - 상세: `useState(String(chatChannel?.rateLimitPerMinute ?? 60))` 와 표시 시 `chatChannel?.rateLimitPerMinute ?? 60` 두 위치에서 동일한 기본값 `60`이 반복된다. 이 값의 의미(분당 최대 호출 횟수 기본값)가 코드에서 드러나지 않는다.
  - 제안: `const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;` 상수를 파일 상단에 정의하고 두 곳에서 참조한다.

### 6. 중복 코드

- **[INFO]** `useCopyToClipboard` 훅 추출로 중복 제거 완료 (W4 달성)
  - 위치: `trigger-detail-drawer.tsx` `WebhookConfigCard.copyText` / `ExternalInteractionCard.copyText`
  - 상세: 이번 PR에서 `.then`/`try-catch` 스타일 차이로 갈라졌던 두 `copyText` 구현이 하나의 훅으로 통일되었다. 중복 제거 목적이 충실히 달성되었다.
  - 제안: 없음.

- **[WARNING]** `ExternalInteractionCard` cancel 버튼이 상태를 초기화하지 않음
  - 위치: `trigger-detail-drawer.tsx` `ExternalInteractionCard` 편집 cancel 버튼 onClick
  - 상세: `WebhookConfigCard.cancelEdit()` 은 `endpointPathValue`, `authConfigIdValue`를 원래 값으로 리셋하는데, `ExternalInteractionCard`의 cancel 버튼은 `setEditing(false)` 만 호출한다. 편집 도중 취소 후 다시 편집 모드로 진입하면 이전에 입력한 미저장 값이 남아있을 수 있다.
  - 제안: 취소 시 `urlValue`, `eventsValue`, `interactionEnabled`, `strategy` 를 현재 트리거 값으로 리셋하는 `cancelEdit` 함수를 추가한다.

### 7. 코드 복잡도

- **[INFO]** `WebhookConfigCard.getCurlExample` — `if` 분기 4개, 복잡도 낮음
  - 위치: `trigger-detail-drawer.tsx` `WebhookConfigCard` 내 `getCurlExample`
  - 상세: 인증 타입별 cURL 예시를 생성하는 함수로 분기가 명확하고 각 분기가 독립적이다.
  - 제안: 없음.

- **[INFO]** `TriggerDetailDrawer` — `trigger.type === "webhook"` 조건이 3회 반복
  - 위치: `trigger-detail-drawer.tsx` `TriggerDetailDrawer` 반환 JSX
  - 상세: `{trigger.type === "webhook" && ...}` 블록이 WebhookConfigCard, ExternalInteractionCard, ChatChannelCard 각각에 독립적으로 존재한다. 현재는 기능상 문제 없지만 조건 하나를 바꿀 때 세 곳을 모두 수정해야 한다.
  - 제안: `{trigger.type === "webhook" && (<> <WebhookConfigCard .../> <ExternalInteractionCard .../> <ChatChannelCard .../> </>)}` 형태로 묶어 조건 중복을 제거한다.

### 8. 일관성

- **[WARNING]** `ExternalInteractionCard` edit 폼의 raw `<input>`/`<label>`/`<select>` — 나머지 카드는 UI 컴포넌트 사용
  - 위치: `trigger-detail-drawer.tsx` `ExternalInteractionCard` 편집 폼 섹션
  - 상세: `WebhookConfigCard`, `OverviewCard`, `ChatChannelCard` 는 `@/components/ui/input`(Input), `@/components/ui/label`(Label) 디자인시스템 컴포넌트를 사용하나, `ExternalInteractionCard`의 편집 폼은 native `<input>`, `<label>`, `<select>` 요소를 직접 사용하고 인라인 Tailwind 클래스로 스타일을 정의한다. 이 불일치는 테마 변경이나 디자인 시스템 업데이트 시 `ExternalInteractionCard`만 반영되지 않는 위험을 만든다.
  - 제안: 편집 폼의 native HTML 입력 요소를 `Input`, `Label` UI 컴포넌트로 교체한다.

- **[INFO]** `trigger-detail-drawer.test.tsx` — `beforeEach` 에서 `cleanup()` 수동 호출
  - 위치: `trigger-detail-drawer.test.tsx` 라인 148–149
  - 상세: `@testing-library/react`는 vitest 환경에서 각 테스트 후 자동 cleanup을 수행한다. 명시적 `cleanup()` 호출은 이중 실행되지만 실질적 부작용은 없다.
  - 제안: 코드베이스 내 다른 테스트 파일 패턴을 확인하고, 불필요한 경우 제거하여 일관성을 유지한다.

---

## 요약

이번 PR은 `useCopyToClipboard` 훅 추출과 `ExternalInteractionCard.handleSave` → `useMutation` 전환이라는 두 가지 구체적인 목표를 달성했으며, 코드 중복 제거와 상태 관리 일관성 개선 측면에서 유지보수성이 향상되었다. 다만 `ChatChannelCard`는 동일한 `useMutation` 패턴 전환이 적용되지 않아 인접 카드 간 일관성이 여전히 부족하고, `ExternalInteractionCard` 편집 폼이 디자인시스템 컴포넌트 대신 native HTML 요소를 사용하는 불일치가 잠재적 유지보수 비용을 높인다. `rateLimitPerMinute` 기본값 `60`의 매직 넘버, `ExternalInteractionCard` cancel 시 상태 미초기화, `trigger.type === "webhook"` 조건 3중 중복도 후속 정리가 권장되는 지점이다. 전반적으로 변경 방향은 올바르나 동일 파일 내 미전환 패턴이 남아 있어 완전한 일관성에는 아직 미치지 못한다.

## 위험도

LOW
