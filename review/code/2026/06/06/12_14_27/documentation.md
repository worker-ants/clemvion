# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `WidgetAction` union 타입 변경 — JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/widget-state.ts` — `WidgetAction` union
- 상세: `START` 액션에서 `userText: string` 필드가 제거되어 시그니처가 변경되었다. `WidgetAction` 타입 자체에 JSDoc 이 없어 각 액션 변형의 의미와 사용 시점을 코드 외부에서 파악하기 어렵다. 다른 복잡한 액션(`WAITING`, `RESTORED`, `BLOCKED` 등)도 동일하게 설명 없음.
- 제안: `WidgetAction` union 또는 최소한 `START` 변형에 `/** eager 시작(§R6) — open 시 발행. userText 없음. */` 수준의 JSDoc 추가 권장. (필수는 아니나 타입 소비자를 위해 유용)

### [INFO] `useWidget()` 반환값 `start` 공개 노출 — JSDoc 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — 반환 객체 `actions.start`
- 상세: `start` 함수가 `actions` 객체에 공개 노출되어 있다(line `actions: { open, close, start, submitMessage, ... }`). `start` 는 내부 eager 시작 가드가 있어 외부 직접 호출이 불필요하지만, 외부 소비자가 보기에 `open()` 이 이미 `start()` 를 호출함을 알 수 없다. `start` 자체의 JSDoc 은 있으나, 반환 `actions` 타입에 `start` 가 포함된 이유(또는 제거 검토 필요 여부) 설명이 없다.
- 제안: `actions` 반환 객체에 인라인 주석 또는 JSDoc 으로 "start 는 open 이 자동 호출 — 외부에서 직접 호출 불필요" 명시, 또는 향후 `start` 를 반환 객체에서 제거(노출 최소화).

### [INFO] `panel.tsx` Composer `disabled` 로직 — 인라인 주석 적절, JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.tsx` — `<Composer disabled={...}>` 블록
- 상세: JSX 인라인에 eager 시작 맥락 주석이 두 줄로 추가되어 있어 로직 이해에 충분하다. 다만 `Composer` 컴포넌트의 `disabled` prop 자체에 JSDoc 이 없고(이 파일 범위 밖), 이 변경이 왜 `phase !== "awaiting_user_message"` 조건을 추가했는지는 주석으로 설명되어 있어 적절하다.
- 제안: 현재 수준으로 충분. 추가 불필요.

### [INFO] `use-widget-eager-start.test.ts` — 파일 레벨 주석만 있고 `installFetch` JSDoc 있음, 전반적으로 양호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
- 상세: 파일 상단에 `// eager 시작(§R6) — ...` 한 줄이 있고, `installFetch` 에 JSDoc 이 있어 테스트 목적이 명확하다. 테스트 케이스 이름도 `(§R6)` spec 참조를 포함해 추적 가능하다. `startedRef 가드` 동작은 테스트 이름으로만 설명되고 가드 구현 파일을 직접 참조하는 주석은 없다.
- 제안: 현재 수준으로 적절. 필수 수정 없음.

### [INFO] spec `1-widget-app.md` 상태기계 다이어그램 — `[awaiting_user_input]` vs `[awaiting_user_message]` 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/spec/7-channel-web-chat/1-widget-app.md` — §3 상태기계 다이어그램
- 상세: 다이어그램에서 `[awaiting_user_input]` 으로 표기되어 있으나, 실제 구현 코드(`widget-state.ts`)와 widget-state.test.ts 에서는 `awaiting_user_message` 로 정의되어 있다. spec 문서의 상태명이 구현 상태명과 다르다.
  - spec 다이어그램: `──waiting_for_input──▶ [awaiting_user_input]`
  - 구현 타입: `"awaiting_user_message"` (WidgetPhase union)
- 제안: spec 다이어그램의 `[awaiting_user_input]` 을 `[awaiting_user_message]` 로 수정해야 한다. 오래된 주석/표기 오류.

### [INFO] plan 문서 체크리스트 미완료 상태로 리뷰 진행 중
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/plan/in-progress/webchat-eager-start.md`
- 상세: plan 체크리스트에서 `(code, developer)`, `테스트`, `TEST WORKFLOW`, `/ai-review + SUMMARY` 등이 미완료(`[ ]`)로 표시되어 있다. 리뷰 대상 파일에 이미 코드 변경이 포함되어 있으므로 plan 과 실제 구현 진행 상태가 미동기화된 것으로 보인다. plan 문서의 역할 상 큰 문제는 아니나, 이 시점의 체크리스트가 현재 구현 상태를 반영하지 않는다.
- 제안: 코드 구현이 완료된 항목은 체크 표시로 업데이트 권장.

### [INFO] `_product-overview.md` nav 링크 추가 — `0-architecture.md` 누락 수정
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/spec/7-channel-web-chat/_product-overview.md` — `**구성요소 spec**` 라인
- 상세: `0-architecture.md` 링크가 nav 에 추가된 것은 문서 접근성 개선. 이전에 누락되어 있던 것을 이번 변경에서 함께 수정했으며 적절하다.
- 제안: 추가 조치 불필요.

### [INFO] `EiaClient.startConversation` JSDoc — payload 설명이 인라인 주석으로 이동
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.ts` — `startConversation` 메서드
- 상세: 기존 JSDoc 블록(`/** 대화 시작 — POST /api/hooks/:endpointPath. auth 없음(공개). 202 + per_execution 토큰. */`)은 유지되고, payload 타입 변경(firstMessage 제거)에 대한 설명은 파라미터 앞 인라인 주석으로 추가되었다. JSDoc `@param` 으로 payload 필드를 문서화하지 않아 payload 구조를 JSDoc 만으로 파악할 수 없다. 그러나 타입 정의 자체가 명확하고, 인라인 주석이 §R6 참조를 포함해 추적 가능하므로 실용적으로는 충분하다.
- 제안: 선택 사항으로, JSDoc 에 `@param payload - profile 만 포함. firstMessage 폐기(§R6)` 수준 추가 가능. 필수는 아님.

### [INFO] `updateProfile` 주석 — eager 시작 맥락에서 일부 오래된 표현 존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `updateProfile` 인라인 주석 (line 1474)
- 상세: `updateProfile` 주석에서 "다음 시작(첫 메시지/새 대화)"이라고 되어 있으나, eager 시작 모델에서는 "첫 메시지"가 아닌 "패널 open"이 시작 트리거다. "첫 메시지" 표현이 이전 lazy 모델의 언어를 그대로 유지하고 있어 맥락상 혼동을 줄 수 있다.
- 제안: `// 다음 시작(패널 open/새 대화)` 으로 수정 권장.

## 요약

이번 변경은 lazy → eager 시작 모델 전환을 다루며, 핵심 spec 문서(1-widget-app, 3-auth-session, 0-architecture)와 코드 주석이 일관되게 §R6 를 참조해 추적 가능하게 문서화되었다. spec 문서의 배경·결정·Rationale 섹션은 충실하고, 인라인 주석도 변경 로직의 의도를 적절히 설명한다. 주요 지적 사항은 spec `1-widget-app.md` 의 상태기계 다이어그램에서 `[awaiting_user_input]` 이 실제 코드 상태명 `awaiting_user_message` 와 불일치하는 점(주석 정확성 문제)이다. 그 외에는 `updateProfile` 주석의 "첫 메시지" 표현이 새 모델 언어와 미세하게 맞지 않는 INFO 수준 개선 사항들이다. CHANGELOG 나 README 는 이 프로젝트 구조상 spec/plan 문서가 그 역할을 대체하고 있으며, 이번 변경은 plan 및 spec 모두에서 적절히 반영되어 있다.

## 위험도

LOW
