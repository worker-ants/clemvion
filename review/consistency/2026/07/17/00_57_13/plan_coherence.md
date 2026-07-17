# Plan 정합성 검토 (2회차)

대상: `plan/in-progress/ai-node-failed-conversation-preview.md`
1회차 산출물: `review/consistency/2026/07/17/00_32_29/plan_coherence.md` (WARNING 2건 + INFO 1건)

본 2회차는 1회차 발견사항의 처분(disposition)이 타당한지 실측 재검증하고, 처분 과정에서 새로 발생한 정합성 갭을 점검한다.

## 1회차 발견사항 처분 재검토

### WARNING 1 (cross-node 대화 오염) → "필터링 안 함" 결정 — **타당함, 근거 실측 확인됨**

target 의 결정은 "single_turn AI Agent 노드가 실패해도 무관한 다른 노드의 turn 이 같은 미리보기에 섞여 보이는 것은 신규 버그가 아니라 기존 설계"라는 것이다. 아래를 코드·spec 원문으로 직접 대조했다.

- `spec/conventions/conversation-thread.md` §9.3 "데이터 소스 선택" 표 (L420-426): "conversation Preview 탭 (`meta.interactionType: "ai_conversation"`)" 의 1차 소스가 `conversationThread.turns` **snapshot 전체**로 명시돼 있고, 표에 노드별 필터 조건이 없다. target 인용과 일치.
- §2.2 AI Agent 표 (L140-149): "single-turn `userPrompt` (resolved) → `ai_user` (1회)" · "single-turn 최종 `output.result.response` → `ai_assistant` (1회)" — single-turn AI Agent 도 thread 참여자라는 target 의 인용과 일치.
- `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1057-1064` — `isWaitingConversation` 분기가 `conversationMessages` prop 을 그대로 `ConversationInspector` 에 전달, 노드 필터 없음. 이 prop 은 `use-result-detail-waiting.ts:31` → `useExecutionStore((s) => s.conversationMessages)` 로 **execution-scope 단일 배열**을 그대로 셀렉트한다 — "기존 구현이 이미 필터 없이 store 전체를 그린다"는 target 인용과 일치.
- `codebase/frontend/src/lib/websocket/use-execution-events.ts:143-146` `isMultiTurnAiContext` — `nodeType !== 'ai_agent'` 면 false. 즉 `text_classifier`/`information_extractor` 실패는 애초에 `system_error` 를 append 하지 않으므로, target 의 Phase 2 수정 범위(AI Agent 한정)와 정합 — 다른 두 AI 노드 타입에 새 drift 를 만들지 않는다.

결론: WARNING 1 의 "필터링 도입하지 않음" 결정은 spec 원문·기존 구현 양쪽에서 실측 근거가 확인되며, 다른 in-progress plan 의 미해결 결정과 충돌하지 않는다 (`node-output-redesign/ai-agent.md` 에 filtering/scope 관련 미결 항목 없음 확인). 다만 이 결정의 spec 앵커링에 갭이 있다 — 아래 발견사항 참조.

### WARNING 2 (CT-S9/CT-S10 오기술) → 진단표 재작성 — **타당함, 실측 확인됨**

`codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 의 `handleAiTurnError`/`finalizeAiNode` 가 multi-turn turn 에러를 예외 없이 FAILED 로 귀결시킨다는 target 서술과, `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1909-1992` 의 CT-S9/CT-S10 테스트가 실제로 `execution.node.failed` 핸들러(`failed?.({...})`)만 호출한다는 서술을 코드로 직접 확인했다. 재작성된 진단표("모든 오류 종결(`node.failed`) → 소멸")는 정확하다.

부수 확인: `spec/3-workflow-editor/3-execution.md` §10.8 부근(L607) 라이프사이클 표가 이미 "Multi Turn retryable error 종결 (`port:'error'` + `retryable===true`) | **노드 status `failed`**" 로 적혀 있어, target 의 "port:'error' 종결조차 엔진이 FAILED 로 바꾼다"는 실측과 spec 자체가 이미 부분적으로 정합했다는 점도 확인. target Phase 1 항목 3("§10.8 확인·정정")의 필요성이 뒷받침된다.

### INFO (`cancelled`) → 소유권 술어 + showTabs 보강 — **타당함, 실측 확인됨**

`spec/3-workflow-editor/3-execution.md:471` "completed / failed / cancelled / waiting_for_input 상태의 노드는 헤더 아래에 서브 탭 바를 표시한다"를 원문으로 확인했고, `result-detail.tsx:1048-1052` 의 `showTabs` 조건에는 실제로 `'cancelled'` 가 빠져 있다 (`isConversationNode || completed || failed || waiting_for_input`). target 의 코드 drift 진단이 정확하다. `cancelled` 종결 시 `system_error` APPEND 여부를 Phase 3 로 미룬 것도 타당 — `node-cancellation-inflight-followups.md`, `spec/conventions/node-cancellation.md` 어디에도 AI Agent/conversation/system_error 관련 서술이 없어(grep 0건) 실측 없이는 답할 수 없는 질문이 맞다.

## 교차 참조 검증 (node-output-redesign/ai-agent.md)

`plan/in-progress/node-output-redesign/ai-agent.md:213` 에 아래 문단이 실제로 존재함을 확인했다:

> **(2026-07-17 frontend 파급 — 교차 참조)** 본 잔여 CRITICAL 은 frontend 대화 미리보기에 파급된다: ... 관련 plan: [`ai-node-failed-conversation-preview.md`](../ai-node-failed-conversation-preview.md) (실패 대화 미리보기 도달성 — Inv-8).

target 의 "양방향 교차 참조 의무" 이행이 확인된다. 역방향(target → 그쪽 plan) 참조도 target L136 에 존재. 양방향 정합.

## 신규 발견사항 (2회차 처분 과정에서 발생)

- **[WARNING]** cross-node 비필터링 결정이 §9.10 회귀 시나리오 표에 미등록
  - target 위치: `plan/in-progress/ai-node-failed-conversation-preview.md` Phase 1 항목 6, Phase 3 "cross-node 시나리오 테스트" 항목
  - 관련 spec: `spec/conventions/conversation-thread.md` §9.10 (L564) — "새 시나리오 발견 시 본 표 추가 + fixture 추가 + 해당 테스트 작성을 PR review 의 의무로 한다"
  - 상세: target 이 직접 인용하는 §9.10 자체가 신규 회귀 시나리오는 CT-S ID 를 부여해 표에 등재해야 한다고 강제한다. 그런데 target Phase 1 항목 6 은 CT-S15(실패 대화 미리보기)·CT-S16(기본 탭) 만 추가하고, Phase 3 에서 별도로 언급된 "cross-node 시나리오 테스트 — single_turn AI Agent 실패 시 store 전체 thread 표시가 의도된 동작임을 pin" 은 CT-S ID 가 없는 채로 남아 있다. 이 시나리오는 1회차 checker 가 지적했던 실제 회귀 위험(cross-node 오염을 "버그"로 오인해 누군가 필터링을 넣는 회귀)을 막는 pin 이므로, §9.10 표에 정식 등재되지 않으면 스스로 인용한 컨벤션을 어기는 셈이고, 3회차 검토에서 다시 지적될 위험이 있다.
  - 제안: Phase 1 항목 6 을 "CT-S15 / CT-S16 **/ CT-S17(cross-node non-filtering pin)** 추가"로 확장하고, §9.10 표에 CT-S17 행 + 충족 테스트 매핑을 추가한다.

- **[WARNING]** §9.10 적용 대상 파일 목록에 `result-detail.tsx` 누락
  - target 위치: `plan/in-progress/ai-node-failed-conversation-preview.md` Phase 2 (구현 대상 = `result-detail.tsx`), Phase 3 (`result-detail.test.tsx`)
  - 관련 spec: `spec/conventions/conversation-thread.md` §9.10 (L564) — "§9 본 절을 변경하거나 conversation timeline 관련 코드 (`conversation-inspector.tsx`, `conversation-utils.ts`, `use-execution-events.ts`, `result-timeline.tsx`, `conversation-timeline-item.tsx`) 를 수정하는 PR 은 다음 시나리오의 단위 테스트 통과를 의무로 한다"
  - 상세: 이번 버그의 실제 진원지이자 target 의 구현 대상인 `result-detail.tsx` 가 이 강제 적용 파일 목록에 없다. CT-S15/CT-S16(및 위 CT-S17)을 표에 추가해도, 이 파일 목록이 갱신되지 않으면 향후 `result-detail.tsx` 를 건드리는 PR 에 대해 spec 이 스스로 "CT-S* 테스트 통과 의무"를 강제하지 못한다 — 이번과 동일한 렌더 게이트 회귀가 재발해도 spec 문면상 의무 목록에 안 걸린다.
  - 제안: Phase 1 항목 6 실행 시 §9.10 파일 목록에 `result-detail.tsx` 추가.

- **[INFO]** "필터링 안 함" 결정의 spec Rationale 미문서화
  - target 위치: Phase 1 항목 7 (§8.5 Rationale 신설)
  - 관련 spec: `spec/conventions/conversation-thread.md` §8 Rationale, §9.3
  - 상세: target 의 "WARNING 1 대응" 절은 §3/§9.3/§2.2 를 근거로 cross-node 비필터링이 기존 설계임을 논증하지만, 이 추론 자체(§9.3 이 노드 필터를 규정하지 않는 것이 의도인지, 단순 누락인지)는 spec 본문 어디에도 명시적으로 쓰여 있지 않다 — 이번 논증으로 재구성한 것이다. target Phase 1 항목 7 "§8.5 Rationale 신설"의 범위 서술("Inv-8 근거, 기각 대안, 이력 view 범위 분리")에 이 cross-node 비필터링 결정의 근거가 포함되는지 불명확하다. 명시적으로 포함되지 않으면, 다음 정합성 감사나 개발자가 §9.3 을 읽고 "왜 노드 필터가 없지?"라는 동일한 질문을 반복할 수 있다.
  - 제안: §8.5 Rationale 서술 범위에 "cross-node 비필터링은 §3/§9.3/§2.2 의 execution-scope 공유 설계에 따른 의도된 동작이며 Inv-8 의 예외가 아니다" 한 문장을 명시적으로 포함.

- **[INFO]** target 문서 파일 말미에 tool-call XML 잔재 (`</content>` / `</invoke>`)
  - target 위치: `plan/in-progress/ai-node-failed-conversation-preview.md:160-161` (파일 EOF)
  - 상세: 파일이 정상 마크다운 본문(L159, "결정 기록" 마지막 항목) 다음에 `</content>\n</invoke>\n` 두 줄로 끝난다. 실제 파일 바이트로 확인(161 lines, 마지막 2줄이 해당 태그). 내용에는 영향 없으나 이전 tool-call 출력을 복사하다 남은 잔재로 보이며, 정식 plan 문서로는 부적절한 잔여물이다.
  - 제안: Phase 4 리뷰/PR 이전에 해당 두 줄 제거.

- **[INFO]** `node-cancellation-inflight-followups.md` 교차 참조가 실질적으로 무관
  - target 위치: Phase 2 "plan_coherence INFO 대응 — `cancelled`" 절의 "관련: [`node-cancellation-inflight-followups.md`]" 링크
  - 상세: 해당 plan 은 DB/Email 노드의 driver-level in-flight cancel 만 다루며 (`ai_agent`/`conversation`/`system_error` grep 0건), AI Agent 노드가 `cancelled` 로 종결될 때 `system_error` 를 append 하는지 여부와는 무관하다. target Phase 3 의 "cancelled 종결 대화 노드의 system_error APPEND 여부 실측" 질문에 이 링크는 답을 제공하지 않는다 — 오해를 유발할 수 있는 느슨한 연결이다.
  - 제안: 링크를 제거하거나 "일반 취소 인프라 배경 참고용(본 질문의 답은 아님)"으로 성격을 명확히 표기.

## 요약

1회차 WARNING 2건·INFO 1건의 처분은 모두 spec 원문·실제 코드 대조로 타당성이 확인됐다 — 특히 핵심 쟁점이었던 "cross-node 필터링 안 함" 결정은 `conversation-thread.md` §9.3/§2.2 와 `result-detail.tsx`/`use-execution-events.ts` 의 기존 구현으로 실측 뒷받침되며, 다른 in-progress plan 의 미해결 결정과 충돌하지 않는다. `node-output-redesign/ai-agent.md:213` 의 양방향 교차 참조도 실제로 존재함을 확인했다. 다만 처분 과정에서 target 이 스스로 인용한 `conversation-thread.md §9.10` 의 강제 규약(신규 시나리오 CT-S 등재 의무, 적용 파일 목록)을 완전히 따르지 않아 Phase 1 spec 개정 항목에 두 개의 구체적 누락(CT-S17 미등재, `result-detail.tsx` 파일목록 누락)이 생겼다 — 이는 3회차에서 재지적될 수 있는 후속 항목 누락이므로 Phase 1 착수 전 plan 에 반영을 권한다. 문서 자체의 잔재 텍스트(EOF tool-call 태그)와 느슨한 cross-link 하나는 경미한 정리 항목이다.

## 위험도

LOW
