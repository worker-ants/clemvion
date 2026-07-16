# 요구사항(Requirement) 리뷰

리뷰 대상: 커밋 `aee4f75e9` (`fix(run-results): AI 대화 노드 오류 종결 시 대화 이력 도달성 복구 (Inv-8)`) — 4겹 결함(R1 `node.failed` payload.output 폐기 / R2 렌더 게이트 `status==='completed'` 요구 / R3 `isConversationOutput` endReason 화이트리스트 drift / R4 `ConversationInspector` 인라인 재파싱이 호출자 items 폐기) 수정.

방법: 각 diff hunk 를 실제 파일(`Read`)로 대조, 관련 spec 4개 문서(`conversation-thread.md` §1.2.1·§8.5·§9.3·§9.9·§9.10, `3-execution.md` §10.6.1·§10.8, `14-execution-history.md` §3.4, `_product-overview.md` ED-EX-13) 본문과 line-level 대조, backend 실제 코드(`ai-turn-executor.ts`, `information-extractor.handler.ts`, `rag-search.service.ts`)로 인용 사실관계 검증, 실제 테스트 스위트 실행(`result-detail.test.tsx` + `use-execution-events.test.ts` + `conversation-utils.test.ts` + `conversation-inspector.test.tsx` = 215 passed) 및 `eslint` 클린 확인.

## 발견사항

- **[WARNING]** 신설 spec 인용 `[실행 엔진 §7.9](../5-system/4-execution-engine.md)` 가 실제로 §7.9 를 정의하지 않는 문서를 가리킴 — 코드가 spec 인용을 잘못한 케이스(§7.9 는 `spec/4-nodes/3-ai/1-ai-agent.md` 소유)
  - 위치: `spec/conventions/conversation-thread.md:364`(§8.5 신설 Rationale), `spec/conventions/conversation-thread.md:601`(CT-S15 표 행), `spec/3-workflow-editor/3-execution.md:517`(§10.6.1 신설 blockquote), `spec/3-workflow-editor/3-execution.md:611`(§10.8 라이프사이클 표), `spec/2-navigation/14-execution-history.md:236`(§3.4), 코드 주석 3곳(`conversation-scenarios.ts:264`, `use-execution-events.ts:838`, `use-execution-events.test.ts:1996`)
  - 상세: `spec/5-system/4-execution-engine.md` 의 `## 7. 장애 복구` 섹션은 §7.1~§7.5.2 까지만 존재하고 §7.9 는 없음(`grep '^### 7\.'` 로 실측 확인). 실제 §7.9("Multi Turn 모드 — 오류 (`error` 포트)")는 `spec/4-nodes/3-ai/1-ai-agent.md:913` 에 정의돼 있고, `output.result.*` 부분 병존 + `output.error` shape 도 그 문서가 SoT. 흥미롭게도 같은 diff 안 `conversation-thread.md` §9.3 표의 새 행(line 445)은 `[AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-...)` 로 **정확히** 인용하고 있어, 같은 PR 내에서 올바른 인용과 잘못된 인용이 공존 — 의도적 컨벤션이 아니라 authoring 실수로 보임. 참고: 과거 리뷰(`review/code/2026/07/02/15_38_59/requirement.md`)에서 "코드 주석이 §7.9 를 execution-engine.md 와 함께 느슨하게 인용하는 습관"을 INFO 로 낮춘 전례가 있으나, 이번엔 앵커 없는 직접 링크 형태로 **spec 본문 자체(5곳)** 에 박혀 반복 등장해 실제 broken link 에 더 가까움.
  - 제안: 6곳의 "실행 엔진 §7.9" 표기를 "[Spec AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트)" 로 통일. **참고**: 리뷰 시점에 워킹트리에 이미 이 수정을 반영한 미커밋 변경(`git diff HEAD`)이 관찰됨 — 6곳 모두 올바른 경로로 교체돼 있었음. 커밋에 반영만 하면 해소.

- **[WARNING]** `ConversationInspector` 신규 가드가 "호출자가 이미 정규 변환을 거친 items 를 넘겼으면 그대로 신뢰한다"고 주장하지만 실제로는 동등하지 않음 — 인라인 재파싱 전용 기능(system-role RAG 컨텍스트 → `type:"rag"` 칩 합성)이 손실
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:862-928`(`SummaryView` 의 `items` useMemo, 특히 869행 신규 guard `if (conversationMessages.length > 0) return conversationMessages;`)
  - 상세: 기존(diff 이전) 코드는 `isLive===false` 일 때 `output.result.messages` 를 항상 자체 인라인 재파싱했고, 그 안에 `m.role === "system" && isRagContextContent(m.content)` → `type:"rag"` 아이템 합성 분기가 있었다(918-925행). `parseHistoryMessages`/`messagesToConversationItems`(`src/lib/conversation/conversation-utils.ts:559` — "system messages and unknown roles are skipped")는 이 합성을 하지 않는다. 신규 guard 는 `conversationMessages.length > 0`(실사용 시 거의 항상 true)이면 즉시 caller-supplied `historyMessages` 를 반환해 인라인 재파싱(과 그 안의 rag 합성)에 도달하지 않게 만든다 — R4 의 의도(오류 종결 노드의 `system_error` 인라인 마커 보존)는 달성하지만, **부작용으로 기존 완료 대화 히스토리 뷰의 RAG 칩도 동시에 통과 못 하게 됨**. 단, backend 실측 결과 `RagSearchService.buildContext`(`"### Relevant Knowledge"` 마커 생성원, `rag-search.service.ts:716`)는 현재 **프로덕션 호출부가 전무**(`grep '\.buildContext\('` 결과 테스트 파일만 매칭) — RAG 는 현재 `kb_search` tool-call 경로(role:"tool")로만 전달되므로 이 특정 인라인-rag 경로는 이미 프로덕션 도달 불가능한 dead code 위에 dead code 가 겹친 상태라 **현재 실질 영향은 없음**. 다만 guard 의 주석/전제("그대로 신뢰")는 두 경로가 진짜 동등하다는 잘못된 근거를 남기므로, 그 delivery 방식이 부활하면 조용히(테스트 무경고) 깨질 리스크가 있다.
  - 제안: 주석을 "caller 결과가 완전한 상위집합은 아니며, system-role RAG 인라인 합성은 의도적으로 배제(현재 dead path)"로 정정하거나, `messagesToConversationItems`/`parseHistoryMessages` 에도 동일 rag 합성을 이식해 진짜 동등하게 맞출 것. **참고**: 리뷰 시점 워킹트리의 미커밋 변경이 이 인라인 재파싱 분기 전체를 삭제하고 `const items = conversationMessages;` 로 단순화한 상태였음(`§9.11 다중 정의 금지` 근거) — dead RAG 합성 코드가 통째로 제거돼 이 우려가 근본 해소된 것으로 보이나, 아직 커밋되지 않음.

- **[INFO]** `spec/conventions/conversation-thread.md` §9.10 CT-S17 행의 "1차 테스트 파일" 열이 `result-detail.test.tsx` + `conversation-utils.test.ts` 두 파일을 명시하지만, 이번 diff 는 `conversation-utils.test.ts` 를 건드리지 않아 CT-S17 라는 ID 로 라벨링된 테스트가 그 파일엔 없음
  - 위치: `spec/conventions/conversation-thread.md:2540`(diff 내 CT-S17 표 행), `codebase/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts`
  - 상세: 다만 CT-S17 검증 항목 (b) "`parseHistoryMessages` 가 `output.error` 에서 `system_error` 합성" 은 `conversation-utils.test.ts:1312-1359` 의 기존 CT-S9 라벨 테스트("parseHistoryMessages synthesizes system_error at the end when output.error is set" / "...with retryable=false...")가 이미 실질적으로 커버 — 기능적 공백은 아니고 CT-ID 추적성(traceability) 만 어긋남.
  - 제안: `conversation-utils.test.ts` 의 해당 두 테스트 주석에 `CT-S9 / CT-S17 공용` 형태로 CT-S17 참조를 추가하면 표와 실제 테스트 라벨이 일치.

- **[INFO]** §9.9 Inv 표의 행 순서가 Inv-6 → Inv-8 → Inv-7 로 삽입돼 숫자 오름차순이 깨짐(내용은 8개 모두 정확 — "다음 8가지" 문구도 실제 8행과 일치)
  - 위치: `spec/conventions/conversation-thread.md:574-580`
  - 상세: 기능적 문제는 아니고 가독성 nit. 리뷰 시점 워킹트리 미커밋 변경에서 이미 Inv-7/Inv-8 순서가 정상화된 것으로 관찰됨(아직 미커밋).
  - 제안: 커밋 시 Inv-7 → Inv-8 순서로 정렬.

- **[INFO]** `output-shape.ts` 의 `endReason` 화이트리스트가 IE(Information Extractor) `EndReason` 타입의 `'timeout'` 값을 포함하지 않음
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:153-160`, `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:56-62`
  - 상세: backend `EndReason` 타입 유니온에 `'timeout'` 이 선언돼 있으나 실제로 `endReason: 'timeout'` 을 assign 하는 코드가 전무(grep 0건) — 현재는 도달 불가능한 enum 멤버라 화이트리스트 누락이 실질 회귀를 만들지 않음.
  - 제안: 조치 불필요(현행 유지). `'timeout'` 이 실제로 emit 되기 시작하면 함께 추가.

## 검증된 정합 사항 (참고용, 결함 아님)

- R1(`use-execution-events.ts` `outputData: payload.output ?? null`)·R2(`result-detail.tsx` `isConversationHistory = isConversationOutput(result.outputData)`, status 게이트 제거)·R3(`output-shape.ts` endReason 화이트리스트에 `condition`/`error` 추가, backend `ai-turn-executor.ts:3147/3198/3420` 의 `'user_ended'|'max_turns'|'condition'|'error'` 유니온과 정확히 일치)·R4(호출자 items 우선) 모두 실제 코드와 diff 서술이 line-level 로 부합.
- `SystemErrorRow.showRetry = se.retryable && !!onRetry && !!se.nodeExecutionId`(`conversation-inspector.tsx:744-745`)와 `parseHistoryMessages` 가 합성하는 `system_error` 에 `nodeExecutionId` 를 아예 넣지 않는 것(`conversation-utils.ts:724-739`)이 서로 맞물려 CT-S16/CT-S17 의 "재시도 자동 suppress" 요구를 정확히 구현.
- `hasLiveSystemError`(`result-detail.tsx:1070-1072`)가 `systemError.nodeId === result.nodeId` 로 스코프돼 cross-node 오염 없이 "이 노드가 live system_error 를 보유하는가"만 판정 — plan 이 명시한 "cross-node thread 미필터링은 §3/§9.3/§2.2 의 의도된 설계이나, live/history 소스 선택 판정 자체는 node-scoped"라는 이중 정책을 코드가 정확히 재현.
- `isConversationOutput` 의 신규 `condition`/`error` 값이 Text Classifier(endReason 미사용) 등 비대화형 노드를 오탐하지 않음(`hasResultMessages` guard 로 messages 배열 보유 노드에만 적용).
- `result-detail.tsx` 의 탭 디폴트 판정(`isConversationResult`, 997-1006행)과 실제 preview 렌더 게이트(`isConversationNode`, 1053행)가 동일한 boolean 식(`isWaitingConversation || isConversationOutput(result.outputData)`)을 공유해 두 게이트가 divergence 없이 항상 일치.
- 신규 4개 fixture(CT-S15/16/17 + 비대화형 회귀)와 신규 테스트 7건을 포함해 관련 4개 테스트 파일(`result-detail.test.tsx`, `use-execution-events.test.ts`, `conversation-utils.test.ts`, `conversation-inspector.test.tsx`) 전체 215개 테스트 실제 실행 결과 전부 PASS. `eslint` 클린.
- TODO/FIXME/HACK/XXX 신규 도입 없음.

## 요약

R1~R4 4겹 결함 수정은 기능적으로 완전하고, spec 개정(§8.5 Rationale 신설, Inv-8 추가, §9.3/§9.10 표 갱신, §10.6.1/§10.8/ED-EX-13 예외 확장)과 코드 구현이 대부분 line-level 로 정확히 부합하며, 실측 백엔드 코드(엔진 FAILED 귀결, endReason enum, `_retryState` 부재 시 suppress)와도 모순이 없다. 회귀 테스트(CT-S15~17)를 포함해 전체 관련 테스트 스위트가 실제로 통과함을 직접 실행으로 확인했다. 다만 두 가지 품질 이슈가 있다: (1) 신설된 spec 인용이 6곳에서 존재하지 않는 섹션(`execution-engine.md §7.9`)을 가리키는 broken cross-reference이고, (2) `ConversationInspector` 의 인라인 재파싱 제거 가드가 "완전 동등"을 주장하는 주석과 달리 RAG 인라인 칩 합성 기능을 실제로 우회시킨다(현재는 그 RAG delivery 자체가 backend 에서 dead code 라 실질 영향 없음). 두 이슈 모두 리뷰 시점 워킹트리에 이미 수정하는 미커밋 변경이 관찰돼, 문제 인지 및 해소가 진행 중인 것으로 보인다 — 다만 이 리뷰가 대상으로 삼은 커밋(`aee4f75e9`) 자체에는 아직 반영되지 않았으므로 결함으로 기록한다.

## 위험도

LOW
