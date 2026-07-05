# Cross-Spec 일관성 검토 — result-detail-props-hook (WaitingInteractionType 파생 hook 추출)

대상: `use-result-detail-waiting.ts` 신설 + `run-results-drawer.tsx`/`executions/[executionId]/page.tsx` 리팩터 + `spec/conventions/interaction-type-registry.md` §1.2 매트릭스·rule 3 + `interaction-type-exhaustiveness.test.ts` REGISTRY_SITES 동시 갱신.

## 검토 절차

1. `spec/5-system/4-execution-engine.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/3-workflow-editor/3-execution.md`, `spec/5-system/6-websocket-protocol.md` 전체에 대해 `run-results-drawer.tsx` / `executions/[executionId]/page.tsx` / `use-result-detail-waiting.ts` / `isWaitingForm|isWaitingButtons|isWaitingConversation` 리터럴을 grep.
2. 코드(diff 반영 후) 의 실제 리터럴(hook `deriveFlags`, drawer, page.tsx)을 grep 하여 매트릭스 (d) 열의 새 서술과 대조.
3. drawer 잔여 `isLiveConversation` 의 실제 구현(순수 if/else, TS `assertNever` 미사용)과 rule 3 신설 문구("TS 로만 커버") 대조.

## 발견사항

- **[INFO]** AI Agent §12.5 버그 내러티브가 옛 파생 위치("execution detail page 의 `isWaitingConversation` 분기")를 서술 — 리팩터 후에도 문자 그대로는 오해 소지
  - target 위치: `spec/conventions/interaction-type-registry.md` §1.2 매트릭스 (d) 행, rule 3 (해당 PR 에서 갱신됨)
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §12.5 "문제" 섹션 (라인 ~1185-1195), 특히 1190번째 줄 "execution detail page 의 `isWaitingConversation` 분기가 `ConversationInspector` 만 그리고..."
  - 상세: 이 문장은 **과거 회귀(버그) 내러티브** — `render_form` 활성 단계 UX 3가지 회귀 중 2번째를 서술하며, 그 당시(수정 전) `isWaitingConversation` 이 `page.tsx` 안에서 직접 파생되던 시절의 버그 상황 설명이다. 리팩터 후 실제 파생 위치는 `use-result-detail-waiting.ts` 의 `deriveFlags` 로 이동했고, 렌더링 소비 위치(`result-detail.tsx` 의 `ConversationInspector` 분기)는 그대로다. 따라서 **사실관계 자체는 모순되지 않는다** — "isWaitingConversation 분기가 ConversationInspector 를 그린다"는 서술은 지금도 참이다(단지 파생이 hook 위임으로 바뀌었을 뿐, 소비 컴포넌트 위치는 안 바뀜). 다만 문장이 "execution detail page 의 ... 분기"라는 표현을 쓰고 있어, 파생 위치가 옮겨진 지금 시점 독자가 "page.tsx 안에 그 분기가 있다"고 오독할 여지가 약간 있다.
  - 제안: CRITICAL/WARNING 은 아님 — 이 문장은 히스토리(bug postmortem) 서술이라 소급 정정 대상이 아니다. 원한다면 향후 §12.5 를 건드릴 일이 생겼을 때 "당시 page.tsx 인라인 분기" 정도로 시제 명확화 고려. 이번 PR 범위에서 필수 조치 아님.

- **[INFO]** rule 3 "TS 로만 커버" 표현이 `isLiveConversation` 의 실제 구현(순수 if/else, `assertNever` 미사용)과 정확히 일치하지 않음
  - target 위치: `spec/conventions/interaction-type-registry.md` §1.2 규칙 3, 마지막 문장 "drawer 의 잔여 `isLiveConversation`(ai_conversation·ai_form_render 2값만 구분) 은 **exhaustive 분기가 아닌 subset 소비처**라 grep 대상이 아니며 TS 로만 커버된다."
  - 충돌 대상: `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx` 라인 312-315 실제 구현 — `isLiveConversation = status === "waiting_for_input" && (waitingInteractionType === "ai_conversation" || waitingInteractionType === "ai_form_render")` (순수 boolean 식, `switch`/`assertNever` 패턴 아님).
  - 상세: rule 2 는 "exhaustive switch + `assertNever`" 를 TS 커버리지 메커니즘으로 정의한다. `isLiveConversation` 은 switch 문이 아닌 단순 `||` 식이라, 두 리터럴을 하드코딩한 채로 신규 enum 값이 추가돼도 컴파일 타임에 fail 하지 않는다(즉 진짜 "TS 컴파일러가 누락을 잡아준다"는 rule 2 의 보장을 받지 않음). "TS 로만 커버된다"는 표현이 정확히는 "타입 시스템이 아니라, subset 이라 grep 가드 대상에서 제외됐을 뿐" 이라는 게 더 정확하다. 이 자체 부정합이 다른 spec 과의 충돌은 아니지만(문서 내부의 자기 서술 정밀도 문제), rule 3 신설 문구가 이 PR 에서 새로 추가된 것이므로 언급.
  - 제안: 문서 정밀도 개선(선택). "TS 로만 커버" → "명시적 리터럴 비교(non-switch)이며 rule 2 의 컴파일러 가드 대상이 아니다. enum 신규 값 추가 시 이 사이트를 수동 점검 필요" 정도로 재문구화하면 향후 신규 enum 값 추가 시 이 사이트가 누락될 리스크를 명시적으로 알릴 수 있음. 이번 PR 을 막을 사유는 아님.

## 코드-매트릭스 정합성 확인 (문제 없음)

- `use-result-detail-waiting.ts` 의 `deriveFlags` 리터럴(`"form"`, `"buttons"`, `"ai_conversation"`, `"ai_form_render"`) 은 매트릭스 (d) 열 서술과 정확히 일치.
- `run-results-drawer.tsx`, `page.tsx` 둘 다 로컬 `isWaitingForm/Buttons/Conversation` 인라인 계산을 제거하고 hook 의 `deriveFlags(isSelectedWaiting)` 위임으로 대체 — 매트릭스가 주장하는 "두 소비처가 hook 에 위임" 은 코드와 일치.
- `interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES` 가 `run-results-drawer.tsx`/`page.tsx` 제거하고 `use-result-detail-waiting.ts` 추가한 것도 실제 grep 대상 파일에 4개 리터럴이 모두 등장하는 것과 합치(hook 파일 자체에 4개 문자열 리터럴 존재 확인).
- `spec/5-system/4-execution-engine.md`, `spec/4-nodes/3-ai/1-ai-agent.md`(§12.5 제외), `spec/3-workflow-editor/3-execution.md`, `spec/5-system/6-websocket-protocol.md` 어디에도 `run-results-drawer.tsx` 또는 `executions/[executionId]/page.tsx` 를 "frontend 파생 site" 로 명명한 현재형(non-historical) 서술 없음 — 즉 다른 spec 문서가 이 리팩터로 stale 해지는 직접 참조는 없음.
- WebSocket §4.4 는 wire-payload shape(`interactionType`, `formConfig`, `buttonConfig`, `conversationConfig`) 만 서술하고 frontend 소비 파일을 지칭하지 않아 영향 없음.

## 요약

리팩터가 동반 갱신한 `interaction-type-registry.md` §1.2 매트릭스·rule 3 는 실제 코드(hook `deriveFlags`, drawer/page 위임, `REGISTRY_SITES` 3파일)와 정확히 합치하며, 다른 spec 문서(execution-engine, ai-agent, 3-execution, websocket-protocol) 어디에도 `run-results-drawer.tsx`/`page.tsx` 를 현재형 파생 site 로 지칭하는 stale 참조가 남아있지 않다. 유일하게 발견된 관련 텍스트는 AI Agent §12.5 의 과거 버그 내러티브인데, 이는 소급 정정이 필요한 "현재 아키텍처 주장"이 아니라 히스토리 서술이라 실질적 모순은 아니다. rule 3 의 "TS 로만 커버" 표현이 `isLiveConversation` 의 실제 non-switch 구현과 다소 어긋나는 정밀도 이슈가 있으나 이 역시 cross-spec 모순이 아니라 문서 내부 정확도 문제. 전반적으로 cross-spec 일관성 관점에서 이 리팩터는 안전하다.

## 위험도

LOW
