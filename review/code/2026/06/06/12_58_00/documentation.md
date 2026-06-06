# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] spec `1-widget-app.md` 상태기계 다이어그램 — `awaiting_user_input` vs `awaiting_user_message` 불일치
- 위치: `spec/7-channel-web-chat/1-widget-app.md` §3 상태기계 다이어그램
- 상세: 다이어그램에서 `[awaiting_user_input]` 으로 표기되어 있으나 실제 코드(`widget-state.ts` WidgetPhase union 및 테스트)에서는 `awaiting_user_message` 를 사용한다. 오래된 주석에 해당하며, spec 을 읽는 사람이 코드와 다른 이름으로 상태를 검색·참조하게 된다. 이 불일치는 이전 리뷰(12_14_27 SUMMARY I2)에서 이미 SPEC-DRIFT 로 식별되어 draft 위임된 상태이나, 본 리뷰 시점에서도 아직 미반영이다.
- 제안: `spec/7-channel-web-chat/1-widget-app.md` 다이어그램의 `awaiting_user_input` 을 `awaiting_user_message` 로 수정한다(project-planner 위임 경로로 처리 중임 확인).

### [INFO] `widget-state.ts` 파일 레벨 주석 — eager 시작 맥락 적절히 반영됨(긍정)
- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` 1–2행
- 상세: 파일 최상단 phase 전이 주석이 `panel(transient) → booting(eager 시작)` 으로 갱신되고, "패널 open 시 시작(§R6) — 첫 사용자 입력을 기다리지 않으며 firstMessage 미사용" 설명이 추가되었다. 이전 lazy 모델 설명(`→ (첫 입력) booting`)이 eager 기준으로 정확히 수정되었다.
- 제안: 추가 조치 불필요.

### [INFO] `WidgetAction.START` JSDoc 추가 — 이번 변경에서 처리됨(긍정)
- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` `WidgetAction` union 내 START 변형
- 상세: `/** I11: eager 시작(§R6) — open 시 발행. userText 없음. phase → booting. */` JSDoc 이 추가되어 타입 소비자가 `START` 액션의 의미와 triger 시점을 인지할 수 있다. `userText` 필드 제거(breaking change)에 대한 맥락도 JSDoc 에 포함되어 있다.
- 제안: 추가 조치 불필요.

### [INFO] `use-widget.ts` `start()` JSDoc — 충실하게 추가됨(긍정)
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `start` 함수 JSDoc (라인 676–683)
- 상세: 함수 JSDoc 에 (a) eager 시작 목적, (b) 1회 실행 가드(startedRef), (c) W10 구조 주의(첫 await 이전 플래그 위치 유지 요건)가 명시되어 있어 향후 수정자가 경쟁 조건 위험을 사전에 인지할 수 있다.
- 제안: 추가 조치 불필요.

### [INFO] `open()` JSDoc — 네트워크 부작용 경고 명시됨(긍정)
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `open` 함수 바로 위 JSDoc
- 상세: `/** 패널 open. 네트워크 부작용 주의(W3): eager 시작(§R6)이라 open 시 start() 가 webhook POST 를 발행해 execution 을 시작한다(중복/세션복원은 start 가드). */` 가 추가되어 있다. 사용자가 `open()` 을 호출할 때의 부작용이 문서화됨.
- 제안: 추가 조치 불필요.

### [INFO] `newChat()` JSDoc — 순서 의존성 6단계 명시됨(긍정)
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `newChat` 함수 바로 위 JSDoc
- 상세: `/** 새 대화 — 기존 세션/스트림 정리 후 새 execution 을 eager 시작(§R6). 순서 의존: closeStream → 타이머 정리(W9) → clearSession → ref 초기화 → dispatch → start. ... */` 가 추가되어 있다. 각 단계 순서 의존 이유가 주석에 설명되어 유지보수 시 순서 변경 위험을 최소화한다.
- 제안: 추가 조치 불필요.

### [INFO] `actions.start` 외부 노출 — 주석 명시됨, 잠재적 API 혼란 존재
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 반환 `actions` 객체 (라인 824–826)
- 상세: `// I3: start 는 open() 이 자동 호출 — 외부 직접 호출 불필요. 하위 호환 목적으로 노출 유지.` 주석이 추가되어 있다. 그러나 `start` 가 `actions` 객체의 공개 인터페이스로 남아 있어 외부 소비자가 `open()` 없이 `start()` 를 직접 호출할 수 있다. JSDoc `@deprecated` 태그나 TypeScript `@internal` 주석으로 의도를 더 명확히 전달할 수 있다.
- 제안: 하위 호환을 위해 유지하되, `/** @deprecated open() 이 자동 호출 — 직접 호출 불필요 */` 형식으로 강화하는 것을 선택적으로 검토할 수 있다. 필수 수정 아님.

### [INFO] `updateProfile` 인라인 주석 — "첫 메시지" → "패널 open" 수정됨(긍정)
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `updateProfile` 주석 (라인 807)
- 상세: 이번 변경에서 "다음 시작(첫 메시지/새 대화)" → "다음 시작(패널 open/새 대화)"으로 수정되어 lazy 모델 잔존 표현이 제거되었다.
- 제안: 추가 조치 불필요.

### [INFO] `eia-client.ts` `startConversation` — payload 변경 인라인 주석은 있으나 JSDoc `@param` 미사용
- 위치: `codebase/channel-web-chat/src/lib/eia-client.ts` `startConversation` 파라미터 (라인 71)
- 상세: payload 타입 변경(firstMessage 제거)에 대한 설명이 파라미터 앞 인라인 주석(`// eager 시작(§R6) — webhook payload 는 profile 만. firstMessage 폐기...`)으로 기술되어 있다. 기존 JSDoc 블록(`/** 대화 시작 — POST /api/hooks/:endpointPath ... */`)에는 `@param payload` 문서가 없어 IDE 호버 시 payload 구조를 파악하기 어렵다. 실용적으로는 타입 정의 자체가 명확하므로 큰 문제는 없다.
- 제안: 선택 사항으로 `@param payload - profile 만 포함. firstMessage 폐기(§R6)` 수준 추가 가능. 필수 아님.

### [INFO] `panel.tsx` C1/W1 관련 suggestions 버튼 인라인 주석 — 추가됨(긍정)
- 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` suggestions 버튼 블록 (라인 313–314)
- 상세: `// W1: booting/streaming 중 탭 시 race 로 메시지 유실 방지 — 큐(C1)가 흡수하므로 버튼은 항상 클릭 가능.` 및 `// Composer 와 달리 여기서는 비활성 처리가 아니라 큐에 위임(submitMessage 내부가 큐로 분기).` 설명이 추가되어 두 컴포넌트 간 방어 전략 차이(비활성 vs 큐 위임)가 문서화됨.
- 제안: 추가 조치 불필요.

### [INFO] `panel.tsx` Composer `disabled` 인라인 주석 — 적절히 추가됨(긍정)
- 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` Composer 블록 (라인 323–324)
- 상세: `// eager 시작(§R6): execution 이 첫 입력 대기(awaiting_user_message)에 들어왔을 때만 자유 텍스트 입력 활성.` 및 `// booting/streaming(AI 처리 중) 또는 buttons/form 표면일 때는 비활성 — 사용자는 선택/제출로 응답.` 두 줄이 disabled 조건의 의도를 충분히 설명한다.
- 제안: 추가 조치 불필요.

### [INFO] `use-widget-eager-start.test.ts` — 파일 레벨 주석과 테스트명에 §R6 참조 포함(긍정)
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 1–2행, 각 `it` 블록 이름
- 상세: 파일 상단 `// eager 시작(§R6) — 패널 open 시 워크플로우 시작, firstMessage 미동봉, 중복 open 단일 시작.` 주석과 `describe` 이름에 spec 참조가 포함되어 테스트 목적이 명확하다. `ControllableEventSource` 에 `/** SSE 이벤트를 직접 주입 */` JSDoc 도 추가되어 있다.
- 제안: 추가 조치 불필요.

### [INFO] `plan/in-progress/webchat-eager-start.md` — 체크리스트 갱신 필요
- 위치: `plan/in-progress/webchat-eager-start.md` 체크리스트
- 상세: 이번 리뷰 대상 변경(commit 6a4af359)이 구현 완료된 항목들을 체크 표시로 반영했으나, `consistency-check --impl-done` 과 `plan complete 이동` 항목이 미완료(`[ ]`)로 남아 있다. 이는 아직 진행 중인 작업 단계를 올바르게 반영하고 있다.
- 제안: 현 상태(미완료 항목 표시)가 실제 진행 단계와 일치하므로 추가 조치 불필요. impl-done 완료 후 plan complete 이동 시 자연스럽게 해소된다.

### [INFO] CHANGELOG 미존재 — spec/plan 문서가 변경 이력 역할 대체
- 위치: 프로젝트 루트 (CHANGELOG 파일 없음)
- 상세: 이 프로젝트는 별도 CHANGELOG 파일이 없으며, `spec/` 의 Rationale 섹션과 `plan/` 문서가 변경 이력·의사결정 배경 역할을 수행한다. `plan/in-progress/webchat-eager-start.md` 에 결정 배경·체크리스트·backlog 가 기록되어 있고, `spec/7-channel-web-chat/1-widget-app.md §R6` 에 lazy→eager 전환 근거가 남아 있다. 이는 프로젝트 규약(단일 진실 원칙)에 부합하는 구조다.
- 제안: 추가 조치 불필요.

### [INFO] README 업데이트 필요성 — 해당 없음
- 위치: 해당 없음
- 상세: `channel-web-chat` 패키지는 임베드형 위젯 SPA 로, 이번 변경(eager 시작 전환)이 위젯 사용자(임베드 스크립트 사용자)에게 직접적인 API 변경을 초래하지 않는다. 임베드 방식(`wc:boot` 메시지 포맷, `triggerEndpointPath` 설정 등)은 변경되지 않았다.
- 제안: 추가 조치 불필요.

## 요약

이번 lazy → eager 시작 모델 전환(§R6)은 문서화 관점에서 전반적으로 충실하게 처리되었다. 핵심 변경 파일(`widget-state.ts`, `use-widget.ts`, `panel.tsx`, `eia-client.ts`)의 인라인 주석과 JSDoc 이 eager 시작의 의미, spec 참조(§R6), 부작용, 순서 의존성을 적절히 기술하고 있으며, spec/plan 문서가 결정 배경·Rationale 역할을 충실히 수행한다. 주요 미해결 사항은 `spec/7-channel-web-chat/1-widget-app.md` 상태기계 다이어그램의 `awaiting_user_input` → `awaiting_user_message` 오타(이미 SPEC-DRIFT W2/I2 로 식별·draft 위임 중)이며, `actions.start` 공개 노출에 `@deprecated` 표시를 추가하는 것을 선택적으로 고려할 수 있다. CHANGELOG·README 업데이트는 프로젝트 규약상 필요하지 않으며, 기존 리뷰 산출물(12_14_27)에서 식별된 I11·I12·I3 문서화 항목은 이번 변경(6a4af359)에서 모두 처리 완료되었다.

## 위험도

LOW

STATUS: SUCCESS
