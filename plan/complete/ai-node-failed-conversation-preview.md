---
worktree: ai-node-conversation-history-ff487b
started: 2026-07-17
completed: 2026-07-17
owner: developer
spec_impact:
  - spec/conventions/conversation-thread.md
  - spec/3-workflow-editor/3-execution.md
  - spec/3-workflow-editor/_product-overview.md
  - spec/2-navigation/14-execution-history.md
---

> **완료 (2026-07-17)** — PR [#959](https://github.com/worker-ants/clemvion/pull/959) 머지 (`12ceee587`). R1~R4 4겹 결함 수정 + spec 4문서 개정 완료.
> 리뷰: `/consistency-check` 2라운드 + `/ai-review` 4라운드 — [`review/code/2026/07/17/07_12_33/RESOLUTION.md`](../../review/code/2026/07/17/07_12_33/RESOLUTION.md) · [`08_05_31/RESOLUTION.md`](../../review/code/2026/07/17/08_05_31/RESOLUTION.md) · [`08_22_45/SUMMARY.md`](../../review/code/2026/07/17/08_22_45/SUMMARY.md).
> 후속: RAG 행 신설은 [`rag-tool-row-distinct-ui.md`](../in-progress/rag-tool-row-distinct-ui.md) 로 이관 (본 작업이 제거한 `rag` 행을 데이터 출처를 바꿔 신설).

# AI 노드 실패 시 대화 이력 도달 불가 (렌더 층 Inv-6 누수)

> 작성일: 2026-07-17
> 트리거: 사용자 제보 — 멀티턴 AI 대화 중 오류 발생 시 대화내역이 사라지고 단일 오류 화면으로 축약
> 관련 spec (SoT 책임 경계별):
> - **탭 가시성·기본 탭 우선순위 SoT**: `spec/3-workflow-editor/3-execution.md` (§10.6.1·§10.8) — `spec/2-navigation/14-execution-history.md:211` 이 SoT 로 명문화
> - **요구사항**: `spec/3-workflow-editor/_product-overview.md` ED-EX-13 (필수)
> - **데이터 소스·UI 불변량·회귀 시나리오**: `spec/conventions/conversation-thread.md` (§9.1·§9.3·§9.7·§9.9 Inv-6·§9.10)
> - **이력 화면 참조 정합**: `spec/2-navigation/14-execution-history.md` (§3.4·L213)

## 배경 (근본 원인)

멀티턴 AI Agent 노드가 `Request timed out.` 등으로 실패하면 run-results 패널에서 **미리보기 탭 자체가 사라지고** 오류 탭만 남는다. 사용자에게는 대화 흐름 전체가 소실된 것으로 보인다.

**데이터는 소실되지 않는다.** 세 계층 모두 정상이다:

- `failExecution` ([execution-store.ts:726](../../codebase/frontend/src/lib/stores/execution-store.ts)) 은 입력 affordance 만 리셋하고 `conversationMessages` 를 보존한다 — spec §9.7.1 표 준수, Inv-6 충족.
- `node.failed` 핸들러 ([use-execution-events.ts:864-896](../../codebase/frontend/src/lib/websocket/use-execution-events.ts)) 는 `system_error` item 을 `nodeExecutionId` 포함해 정확히 APPEND 한다 — spec §9.7 `node.failed` 행 준수.
- `SystemErrorRow` / `SystemErrorDetail` 렌더러와 `[다시 시도]` 버튼도 이미 구현돼 있다 (§9.1 매핑표 준수).

**갭은 단 한 곳** — [result-detail.tsx:1039-1042](../../codebase/frontend/src/components/editor/run-results/result-detail.tsx) 의 렌더 게이트:

```ts
const isCompletedConversation =
  result.status === "completed" && isConversationOutput(result.outputData);
const isConversationNode = isWaitingConversation || isCompletedConversation;
```

`node.failed` 경로는 `outputData: null` (use-execution-events.ts:866) + `status: 'failed'` 로 노드 결과를 쓴다. 따라서:

| 조건 | 값 | 사유 |
|---|---|---|
| `isWaitingConversation` | false | `failExecution` 이 `waitingNodeId` 클리어 (§9.7.1 정상 동작) |
| `isCompletedConversation` | false | `status !== 'completed'` **AND** `outputData === null` |
| → `conversationPreview` | `null` | 두 분기 모두 탈락 |
| → `hasPreview` | false | 미리보기 탭 소멸 |

즉 **store 에 보존된 대화에 UI 가 도달할 경로가 없다**. Inv-6 이 store 층만 규정하고 렌더 층을 규정하지 않은 것이 구조적 원인이다.

### 오류 경로는 실질적으로 하나다 (2026-07-17 실측 — 초안 진단 정정)

초안은 "`node.completed`+`port:'error'` 는 미리보기가 살아있고 `node.failed` 만 소멸해 UI 가 갈린다" 고 서술했으나, **실측 결과 틀렸다** (plan_coherence checker 지적):

- **backend**: `handleAiTurnError` ([ai-turn-orchestrator.service.ts:986·1035](../../codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts)) 는 멀티턴 turn 에러에 대해 **예외 없이** `finalStatus: 'FAILED'` 를 반환하고, `finalizeAiNode` (:1218-1226) 가 `isFailed = true` 로 NodeExecution 을 FAILED 저장 → **`execution.node.failed` 만 발사**된다. 핸들러의 output shape 자체는 `port:'error'` / `status:'ended'` 이지만 엔진이 이를 FAILED 로 최종 귀결시키므로, `node.completed` + `output.error` 는 **production 도달 경로가 발견되지 않는다** (frontend 의 해당 분기 [use-execution-events.ts:789-809](../../codebase/frontend/src/lib/websocket/use-execution-events.ts) 는 방어적 처리).
- **테스트**: CT-S9/CT-S10 ([use-execution-events.test.ts:1909-1992](../../codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts)) 은 **둘 다 `execution.node.failed` 핸들러**를 호출한다 (`failed?.({...})`). 초안이 이를 "`node.completed` 커버" 로 적은 것은 오기술. `node.completed`+`output.error` 는 CT-ID 미부여 별도 테스트(:1994)가 덮는다.

**정정된 진단** — `isCompletedConversation` 게이트(`status === 'completed'`)는 대화형 노드의 **성공 종결만** 덮는다. 따라서:

| 경로 | `result.status` | `outputData` | 미리보기 탭 |
|---|---|---|---|
| 정상 종결 (`completed`) | `completed` | conversation shape | ✅ 노출 |
| **모든 오류 종결** (`node.failed`) | `failed` | `null` | ❌ **소멸 — 본 작업 대상** |
| `node.completed`+`port:'error'` (방어 경로, 미도달) | `completed` | conversation shape | ✅ (이론상) |

즉 `result-detail.tsx:1080-1084` 의 "failed 상태의 multi-turn 종결 노드도 conversation preview 노출" 주석은 **어떤 오류 경로에서도 성립한 적이 없는 사문(死文)** 이다 — `port:'error'` 종결조차 엔진이 FAILED 로 바꾸므로. 주석 삭제·정정도 Phase 2 범위에 포함한다.

### 테스트가 못 잡은 이유

CT-S9/CT-S10 은 `node.failed` 를 덮지만 **store 레벨(`conversationMessages` APPEND)만** 검증한다 — 렌더 게이트(탭 가시성)는 검증 대상이 아니다. `result-detail.test.tsx` 의 failed 커버리지는 L166-180 `http_request` 노드 1건뿐이라 대화형 노드의 failed 렌더 케이스가 아예 없다. **store 층 불변량(Inv-6)만 테스트되고 렌더 층 도달성은 무테스트** — 이것이 Inv-8 신설이 필요한 구조적 이유다.

## ⚠️ 근본 원인 재확정 (2026-07-17, cross_spec 2회차 WARNING → 실측) — 초안 전면 정정

초안은 "`node.failed` 는 `outputData: null` 이라 store 가 유일한 복원 매체" 라고 전제했다. **실측 결과 이 전제가 틀렸다.**

**백엔드는 FAILED 에도 대화를 영속하고 WS 로 보낸다**:

- [`ai-turn-orchestrator.service.ts:1249`](../../codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts) — `nodeExec.outputData = finalOutput` 를 `isFailed` 분기 **이전**에 무조건 실행 → DB 영속.
- 같은 파일 `:1296-1314` — `NODE_FAILED` emit payload 에 **`output: nodeExec.outputData`** 동봉.
- spec §7.9 상 error 종결 output 은 `output.error` + **부분 `output.result.*` 병존** — 즉 `messages` 가 함께 실린다.

**프론트가 그것을 버린다**:

- [`use-execution-events.ts:823-840`](../../codebase/frontend/src/lib/websocket/use-execution-events.ts) — `handleNodeFailed` 의 payload 타입에 **`output` 필드가 선언조차 되어 있지 않다** → 조용히 drop.
- 같은 파일 `:866` — `outputData: null` **하드코딩**. 바로 옆 `node.completed` (`:778`) 는 `payload.output ?? null` 을 쓴다 — **비대칭**.

**이력 화면도 이미 데이터를 갖고 있다**:

- [`apply-execution-snapshot.ts:102`](../../codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts) — `outputData: ne.outputData` 를 **상태 무관** 반영. `/executions/:id` 의 failed AI 노드는 이미 conversation shape 의 `outputData` 를 보유한다.

→ **진짜 근본 원인은 두 개의 독립 결함**이다:

| # | 결함 | 위치 |
|---|---|---|
| **R1** | `node.failed` 가 backend 가 보낸 `output` 을 버리고 `outputData: null` 하드코딩 | `use-execution-events.ts:823-840·866` |
| **R2** | 렌더 게이트가 `status === 'completed'` 를 요구 — 이력 화면은 `outputData` 가 있는데도 막힘 | `result-detail.tsx:1039-1040` |

R1 은 live 를, R2 는 live·이력 **양쪽**을 막는다. 두 결함이 겹쳐 "대화가 통째로 사라진" 증상이 났다.

**초안 설계 폐기**: store 귀속 술어(`isErroredConversation` — `systemError.nodeId` 매칭)는 **대부분 불필요**하다. 노드 자신의 `outputData` 가 이미 **정확히 노드 스코프된 권위 소스**이므로 cross-node 질문 자체가 소멸한다 (plan_coherence WARNING 1 도 함께 해소 — 필터링 논쟁 불필요). store 는 **live 재시도 메타데이터 확보 목적으로만** 우선한다 (아래 §데이터 소스 선택).

## 스코프

**포함**: R1 + R2 수정 → live 세션(에디터 drawer)·이력 화면(`/executions/:id`) **양쪽**의 대화형 노드 오류 종결 미리보기 도달성 복구 + 기본 탭 정책 + 재시도 affordance.

**제외**: 없음 (초안의 "이력 view 는 EH-DETAIL-12 v2 영역" 제외는 **철회** — `outputData` 가 영속되므로 v2 재구성 과제가 아니다).

### 데이터 소스 선택 (R1 수정 후)

| 상황 | 1차 소스 | 근거 |
|---|---|---|
| waiting | store `conversationMessages` | 기존 §9.3 1행 |
| **오류 종결 · live** | store `conversationMessages` (해당 노드의 `system_error` 를 소유할 때) | store 의 `system_error` 만 `nodeExecutionId` 를 보유 → `[다시 시도]` 활성 (§1.2.1) |
| **오류 종결 · 이력/새로고침** | `parseHistoryMessages(result.outputData)` | 기존 §9.3 3행 그대로. `output.error` 로부터 `system_error` 합성, `nodeExecutionId` 부재 → 재시도 자동 suppress (§1.2.1 이 이미 규정한 설계) |
| 정상 종결 | `parseHistoryMessages(result.outputData)` | 기존 |

즉 §9.3 에 **신규 행 추가가 불필요**하다 — 기존 3행이 이미 이 경로를 규정하고 있고, R1/R2 가 그 규정을 구현이 못 따라간 것이다. Naming Collision INFO(신규 행 종속 서술)·Rationale Continuity INFO(D4 계보)도 함께 소멸.

## Phase 1 — spec 개정

`/consistency-check --spec` 1회차 결과 **BLOCK: YES** (Cross-Spec CRITICAL) → 아래와 같이 개정 대상·구조 정정 후 재검토. 산출물: `review/consistency/2026/07/17/00_32_29/`.

### 1회차 BLOCK 사유와 정정

**CRITICAL**: 탭 가시성·기본 탭 우선순위의 **선언된 SoT 는 `spec/3-workflow-editor/3-execution.md §10.6.1`** 이다 (`spec/2-navigation/14-execution-history.md:211` 이 이를 SoT 로 명문화 — "서브 탭 전체 구성·조건·기본탭·auto-fallback 은 §10.6.1 이 단일 진실"). 초안이 `conversation-thread.md` 에 §9.13 을 신설해 탭 정책을 정의하려 한 것은 **두 번째 SoT 를 만드는 것**으로, §10.6.1 의 "1. Error — 에러가 있으면 최우선" 규칙과 같은 컴포넌트(`ResultDetail`)·같은 시나리오에 대해 정면 모순을 낳는다.

**실측 확인 (2026-07-17)**: §10.6.1 에는 이미 다음 예외가 존재한다 —

> **AI multi-turn retryable error 종결 시 예외**: AI Agent multi-turn 이 `port: 'error'` + `details.retryable === true` 로 종결된 경우에는 **Preview 우선**

즉 정책의 절반은 이미 spec 에 있고, 적용 범위가 `port: 'error'` + `retryable === true` 로 좁아 **`node.failed` 경로와 non-retryable 종결을 못 덮는 것**이 실제 갭이다. 따라서 §9.13 신설을 폐기하고 **§10.6.1 의 기존 예외를 확장**한다.

### 개정 대상 (정정 후)

**A. `spec/3-workflow-editor/3-execution.md`** — 탭 정책 SoT

1. **§10.6.1 Preview 탭 표시 조건 행** — "AI 대화형(ConversationInspector)" 의 범위를 명시: conversation 이력을 보유하면 `result.status`(`failed` 포함)·`outputData` null 여부와 무관하게 노출.
2. **§10.6.1 디폴트 탭 예외 재작성** (L510 blockquote) — 단순 "확장" 이 아니라 **조건문 자체를 실측 기준으로 재작성**한다 (Rationale Continuity 2회차 INFO 1 반영):
   - 기존 조건 `port: 'error'` + `details.retryable === true` 중 **`port:'error'` 는 이미 사문** — 위 "오류 경로는 실질적으로 하나다" 실측대로 엔진이 항상 `node.failed` 로 귀결시키므로 `node.completed`+`port:'error'` 는 도달하지 않는다. Phase 2 항목 4 (`result-detail.tsx:1080` 사문 주석 정정) 와 **같은 정신을 spec 문구에도 적용** — 사문 조건을 남긴 채 확장하면 §8.5 가 정당화하는 대상과 조건문 표현이 어긋난 채 spec 에 남는다.
   - 재작성 기준: **`node.failed` 종결 (대화형 노드, retryable 무관)**. `port:'error'` 는 삭제하거나 "이론상 방어 경로" 로 격하.
   - 인라인 근거 문장 끝에 **`conversation-thread.md §8.5` 로의 명시적 역참조 링크** 추가 (INFO 2 반영) — §8.1 이 "Rationale 은 §8.1" 로 스스로 cross-ref 하는 기존 관행 계승. `3-execution.md` 만 읽는 독자가 확장 근거를 찾을 수 있어야 한다.
3. **§10.8 라이프사이클 표** — "실행 실패" 행이 conversation 보존과 정합하는지 확인·정정.

**B. `spec/conventions/conversation-thread.md`** — 데이터 소스·불변량 (탭 규칙은 §10.6.1 **참조만**)

4. **§9.3 데이터 소스 선택 표 — 신규 행 추가 안 함** (R1/R2 재확정으로 초안 폐기). 기존 3행("실행 이력 복원 view — `output.result.messages` + `output.interaction`")이 오류 종결 경로를 **이미 규정**하고 있고, 구현(R1·R2)이 그 규정을 못 따라간 것이다. 대신 3행 비고에 **"오류 종결(`output.error` set) 노드도 본 행을 따른다 — `output.error` + 부분 `output.result.*` 병존(§7.9)이므로 재구성 가능"** 을 명시해 `status` 무관함을 못박는다. live 의 store 우선은 §9.7.1 이 이미 규정하는 권위 사본 개념 그대로라 신규 정의 불필요.
5. **Inv-8 신설** (§9.9) — 렌더 층 도달성 불변량. 탭 가시성·기본 선택 규칙 자체는 §10.6.1 을 cross-ref (dangling 위임 재발 방지). 서두 "다음 6가지 불변량" → 실제 행 수 정합화 (현재 Inv-1~Inv-7 로 7행인데 6가지로 적힌 기존 오류 동반 수정).

   **Inv-8 의 정확한 스코프 — 오류 종결 한정** (plan_coherence 2회차 INFO 실측 반영): 초안은 "`result.status` 와 무관하게" 로 일반화했으나, 실측 결과 `handleNodeCancelled` ([use-execution-events.ts:936-974](../../codebase/frontend/src/lib/websocket/use-execution-events.ts)) 는 `conversationMessages` 를 **건드리지 않는다** — `cancelled` 종결 노드는 `system_error` 를 얻지 못하므로 귀속 술어가 발화할 수 없다. 따라서 Inv-8 은 **"`system_error` 를 소유한 대화형 노드"** 로 스코프하고, 그 안에서 `result.status`(`failed`)·`outputData` null 여부를 게이트로 쓰지 않음을 규정한다. `cancelled` 대화 노드의 도달성은 **별도 표면**(귀속 신호 자체가 부재)으로 §8.5 에 known follow-up 으로 명시 — Inv-8 의 예외가 아니라 미착수 범위다.
6. **CT-S15 / CT-S16 / CT-S17 시나리오 추가** (§9.10) + 충족 테스트 매핑 표 갱신 + fixture 추가. **§9.10 적용 대상 파일 목록에 `result-detail.tsx` 추가** — 현재 목록(`conversation-inspector.tsx`, `conversation-utils.ts`, `use-execution-events.ts`, `result-timeline.tsx`, `conversation-timeline-item.tsx`)에 누락돼 있어, 본 작업처럼 `result-detail.tsx` 만 고치는 PR 이 §9.10 테스트 의무를 트리거하지 않는다 — **이번 회귀가 무테스트로 통과한 구조적 이유** (plan_coherence 2회차 WARNING).

   시나리오 정의 (convention_compliance 2회차 WARNING 반영 — **확장의 실제 델타는 non-retryable** 이므로 이를 직접 겨냥):

   | ID | 시나리오 | 검증 |
   |---|---|---|
   | CT-S15 | 멀티턴 AI Agent 가 `node.failed` + **`retryable: true`** 로 종결 (`outputData: null`) | (a) Inv-6 store 보존 (b) **미리보기 탭 노출** (Inv-8) — 대화 전체 + 마지막 `system_error` (c) `[다시 시도]` 노출 |
   | CT-S16 | 멀티턴 AI Agent 가 `node.failed` + **`retryable: false`** 로 종결 (CT-S10 과 동일 조건) | (a) Inv-8 탭 노출 (b) **기본 활성 탭 = 미리보기** ← **본 plan 이 §10.6.1 예외를 확장해 새로 얻는 동작. retryable=true 의 Preview 기본선택은 기존 예외가 이미 규정하므로 델타가 아니다** (c) `[다시 시도]` 미노출 (d) 비대화형 `http_request` 는 기존대로 오류 탭 기본 (ED-EX-13 일반 원칙 보존 회귀) |
   | CT-S17 | 오류 종결 대화 노드를 **새로고침 후 이력 화면**(`/executions/:id`, store 비어있음)에서 조회 | (a) `outputData` (REST 스냅샷, `output.error` + 부분 `output.result.*`) 로부터 미리보기 재구성 (b) `parseHistoryMessages` 가 `system_error` 합성 (c) `nodeExecutionId` 부재로 `[다시 시도]` **자동 suppress** (§1.2.1). **R2 가 이력 화면도 고친다는 증명** — 초안이 v2 로 잘못 이월했던 범위 |

   > CT-S17 은 초안의 "cross-node 비필터링 pin" 에서 **용도 변경**됐다 — R1/R2 재확정으로 cross-node 시나리오의 전제가 소멸했고(미리보기 소스가 노드 자신의 `outputData`), 대신 **이력 화면 도달성**이 새로 범위에 들어와 pin 이 필요해졌다.
7. **§8.5 Rationale 신설** — 서술 범위 (checker 지적 반영해 명시적으로 확정):
   - Inv-8 근거 (store 보존 Inv-6 과 렌더 도달성은 별개 불변량, §10.6.1 예외 확장의 신설 근거)
   - 기각 대안 (backend 가 failed 노드에도 conversation output 을 싣기)
   - **cross-node 비필터링이 §3/§9.3/§2.2 의 execution-scope 공유 설계에 따른 의도된 동작이며 Inv-8 의 예외가 아님** — 한 문장 이상 명시 (plan_coherence 2회차 INFO: 현 spec 어디에도 "§9.3 의 노드 필터 부재가 의도인지 누락인지" 가 안 쓰여 있어 동일 질문이 반복될 수 있음. plan 은 완료 후 이동하므로 근거를 spec 에 남겨야 함)
   - **`cancelled` known follow-up** (귀속 신호 부재 — 별도 표면)
   - 이력 view 범위 분리 (EH-DETAIL-12)

**C. `spec/2-navigation/14-execution-history.md`** — SoT 참조 정합

8. **§3.4 Preview 탭 (L236)** — "완료된 대화를 채팅 스레드 형태로 표시한다" 의 "완료된" 한정 갱신 + failed 종결 노드의 새로고침 후 복원은 EH-DETAIL-12(v2) 로드맵이라는 상호 참조 추가 (Cross-Spec WARNING 해소 — 현재 근거가 `conversation-thread.md` 측에만 있어 비대칭).
9. **L213 기본 선택 탭 문구** — §10.6.1 예외 확장과 정합화.

**D. `spec/3-workflow-editor/_product-overview.md`** — 요구사항 레벨 (Rationale Continuity CRITICAL 대응)

10. **ED-EX-13 (L121)** — 현재 "서브 탭 기본 선택 우선순위: Error(에러 발생 시) > Preview ... | 필수" 로 **예외 없이** 규정. §10.6.1 의 기존 retryable 예외조차 이 요구사항 문구에 반영돼 있지 않아 **이미 잠재 긴장 상태**다. 예외를 §10.6.1 참조로 명시해 정합화한다.

> **Rationale Continuity CRITICAL 의 핵심**: §10.6.1 기존 예외의 근거는 *"conversation thread 안에 `system_error` item 이 인라인 표시되어 사용자가 대화 흐름 안에서 에러와 `[다시 시도]` 버튼을 직접 다룰 수 있기 때문"* — 즉 **`[다시 시도]` affordance 에 묶인 근거**라 non-retryable 로 자동 확장되지 않는다. 확장하려면 **별도 근거를 신설**해야 하며, 근거 없는 확장은 기존 결정의 무근거 번복이다. 신설 근거 (§8.5 에 기록): 대화 시간축 보존 가치는 재시도 가능성과 독립적이다 — non-retryable 종결(예: 인증 실패)에서도 사용자는 "어느 턴에서 무슨 대화 끝에 끊겼는지" 를 먼저 봐야 하며, `system_error` 는 retryable 여부와 무관하게 §9.1 상 thread 인라인 표시된다 (non-retryable 은 액션 영역만 비어있음). Error 탭은 여전히 명시적 선택으로 접근 가능하므로 오류 정보 도달성은 훼손되지 않는다.

## Phase 2 — 구현 (`codebase/frontend`)

착수 전 `/consistency-check --impl-prep` 의무. TDD — 테스트 선작성.

**R1 — `use-execution-events.ts` (backend 가 보낸 output 을 버리지 않는다)**

1. `handleNodeFailed` payload 타입에 `output?: unknown` **선언 추가** (L823-840).
2. `outputData: null` → **`outputData: payload.output ?? null`** (L866) — `node.completed`(L778) 와 동일 패턴으로 **비대칭 해소**.

**R2 — `result-detail.tsx` (렌더 게이트에서 status 제거)**

3. `isCompletedConversation` (L1039-1040) → **`status === 'completed'` 조건 제거**하고 `isConversationOutput(result.outputData)` 만으로 판정. 식별자도 의미에 맞게 개명 (`isCompletedConversation` → `isConversationHistory` 등) — "completed" 라는 이름이 status 게이트를 되살리려는 유혹의 원인.
4. **live 재시도 메타데이터 보존** — 오류 종결 노드가 store 에 자기 `system_error`(= `nodeExecutionId` 보유)를 가지면 store `conversationMessages` 를 우선 사용, 아니면 `parseHistoryMessages(result.outputData)`. 이력/새로고침에서는 후자로 자연 폴백하며 재시도는 §1.2.1 대로 자동 suppress.
5. 기본 탭 선택 로직 (L997-1001) — 대화형 노드 분기 (§10.6.1 예외 재작성 반영).
6. `result-detail.tsx:1080-1084` **사문 주석 정정** — 위 진단 참조.

> **초안 대비 축소**: store 귀속 술어(`isErroredConversation`)는 **미리보기 노출 판정에서 제거**된다 — `outputData` 가 정확히 노드 스코프된 권위 소스이므로. 술어는 항목 4 의 **live 소스 선택**에만 좁게 남는다. 이로써 plan_coherence WARNING 1(cross-node)·CT-S17(비필터링 pin)의 전제가 소멸 — 아래 Phase 3 참조.

> **스코프에서 제외 — `showTabs` 의 `cancelled` 누락**: §10.6.1 L471 은 "completed / failed / cancelled / waiting_for_input 상태의 노드는 서브 탭 바를 표시한다" 로 규정하는데 `showTabs` ([result-detail.tsx:1048-1052](../../codebase/frontend/src/components/editor/run-results/result-detail.tsx)) 는 `'cancelled'` 를 누락한다 (실측 확인된 기존 drift). 초안은 이를 함께 고치려 했으나 **제외한다** — (a) `handleNodeCancelled` 가 `system_error` 를 APPEND 하지 않아 탭을 열어도 대화 미리보기는 나오지 않는 반쪽 수정이고, (b) 본 작업(오류 종결 도달성)과 무관한 별개 drift 라 scope-reviewer 관점에서 "의도 이상 변경" 이다. **별도 후속으로 분리**.

### plan_coherence WARNING 1 — R1/R2 재확정으로 **전제 소멸** (아래는 기록 보존용)

**2026-07-17 갱신**: 미리보기 소스가 store 전체 배열이 아니라 **노드 자신의 `outputData`** 로 바뀌면서 cross-node 노출 시나리오 자체가 사라졌다 (`outputData` 는 해당 노드의 output 이므로 정확히 스코프됨). 따라서 "필터링 할 것인가" 논쟁은 **본 작업에서 불필요**해졌고, CT-S17(비필터링 pin)도 **불필요**하다. 단 항목 4 의 live store 우선 경로는 여전히 store 전체를 그리므로 **waiting 분기와 동일한 기존 동작**이며, 그 정합성 근거로 아래 논증은 유효하다 (`node-output-redesign/ai-agent.md` 교차 참조도 유지 — single-turn P0 파급은 여전히 실재).

<details>
<summary>기존 논증 (store 전체 표시가 설계 의도라는 근거) — live 경로에 여전히 적용</summary>

checker 는 execution-scope 단일 `conversationMessages` 배열 + `isMultiTurnAiContext(nodeType)` 가 `nodeType === 'ai_agent' && conversationMessages.length > 0` 로만 게이트([use-execution-events.ts:143-146](../../codebase/frontend/src/lib/websocket/use-execution-events.ts)) 하는 구조 때문에, single_turn AI Agent 가 실패하면 **무관한 다른 노드의 대화**가 그 노드 미리보기에 표시될 수 있다고 지적했다 (실측 정확).

**그러나 이는 신규 오염이 아니라 ConversationThread 의 기존 설계다** — 필터링을 도입하면 오히려 spec 을 위반한다:

- **spec 근거**: §3 스코프 규칙 상 thread 는 execution 스코프로 컨테이너·노드 간 **상속·공유**된다. §9.3 이 conversation Preview 의 1차 소스를 `conversationThread.turns` 전체 snapshot 으로 규정한다. §2.2 상 single-turn AI Agent 도 `ai_user`/`ai_assistant` turn 을 push 하는 **thread 참여자**다.
- **기존 구현 근거**: `isWaitingConversation` 분기([result-detail.tsx:1061-1064](../../codebase/frontend/src/components/editor/run-results/result-detail.tsx))가 이미 store **전체 배열**을 노드 필터 없이 그린다.
- **사용자 제보 스크린샷 근거**: 제보된 정상 화면의 첫 항목이 `캐러셀 · 버튼 클릭` — **다른 노드(캐러셀)가 남긴 `presentation_user` turn 이 AI 노드 미리보기에 이미 표시되고 있다.** cross-node 표시는 관찰된 현행 정상 동작이다.

→ **결정**: 필터링 도입하지 않음. live store 우선 경로는 waiting 분기와 **동일하게** store 전체를 그린다 (일관성 유지).

</details>

**checker 가 짚은 근본 원인은 여전히 유효하다** — `isMultiTurnAiContext` 가 turn mode 를 모른 채 nodeType 만으로 게이트하는 것은 [`plan/in-progress/node-output-redesign/ai-agent.md`](node-output-redesign/ai-agent.md) 의 **미해소 P0 CRITICAL (single-turn error 라우팅 — `executeSingleTurn` 의 `llmService.chat` 이 try/catch 미적용이라 throw 가 엔진 FAILED 로 직행)** 과 같은 뿌리다. 본 plan 은 그 P0 를 해소하지 않으며, 해소되면 `node.failed` 표면이 multi-turn 으로 축소돼 본 이슈도 자연 축소된다. **양방향 교차 참조 의무** — 그쪽 plan 에도 본 plan 역참조 추가.

### `cancelled` 종결 — 실측 결과 별도 표면 (본 작업 범위 외)

**실측 (2026-07-17)**: `handleNodeCancelled` ([use-execution-events.ts:936-974](../../codebase/frontend/src/lib/websocket/use-execution-events.ts)) 는 `conversationMessages` 를 조작하지 않는다. `execution.node.cancelled` 는 `node.failed` 와 별도 WS 이벤트다 ([node-cancellation §5.1](../../spec/conventions/node-cancellation.md#51-nodeexecution-상태--cancelled)). → `cancelled` 대화 노드는 `system_error` 를 얻지 못하므로 **귀속 신호 자체가 없다**.

취소는 오류가 아니므로 `system_error` 부재는 정상 동작이다. 다만 "진행 중 멀티턴 대화를 Stop 으로 취소하면 대화가 안 보인다" 는 동일 계열 증상은 남을 수 있다 — **Inv-8 의 예외가 아니라 미착수 표면**(다른 귀속 메커니즘이 필요)으로 §8.5 에 known follow-up 명시. 초안이 걸었던 [`node-cancellation-inflight-followups.md`](node-cancellation-inflight-followups.md) 교차 참조는 **제거** — 그 plan 은 DB/Email 노드의 driver-level in-flight cancel 만 다뤄 본 질문(AI 노드 cancelled 시 thread 표시)과 무관하다 (plan_coherence 2회차 INFO).

## Phase 3 — 테스트

- `use-execution-events.test.ts` — **R1 회귀**: `node.failed` payload 의 `output` 이 `NodeResult.outputData` 로 전달되는지 (현재 null 하드코딩이라 **이 테스트가 먼저 실패해야 정상** — TDD red)
- `result-detail.test.tsx` — CT-S15 / CT-S16 / CT-S17 (Phase 1 항목 6 표대로). **CT-S16 의 `retryable: false` 픽스처가 §10.6.1 확장의 핵심 검증**, **CT-S17 이 R2 의 이력 화면 효과 검증**
- 기존 테스트 L166-180 (`http_request` failed → 오류 탭 기본) 회귀 없음 확인 — ED-EX-13 일반 원칙 보존
- `conversation-scenarios.ts` fixture 추가
- frontend unit 전체 (plan frontmatter 가드가 frontend vitest 라 필수)

> `cancelled` 는 §Phase 2 의 별도 절대로 범위 외 — `handleNodeCancelled` 가 `conversationMessages` 를 안 건드리는 것은 실측 확인 완료라 Phase 3 실측 항목에서 제거.

## Phase 4 — 리뷰

`/ai-review` + Critical/Warning fix (프로젝트 상시 승인 강제 단계).

## 결정 기록

- **store 를 1차 소스로 (vs `outputData` 복원)**: `node.failed` 는 `outputData: null` 이라 복원 매체가 store 뿐이다. backend 가 failed 노드에도 conversation output 을 싣게 하는 안은 백엔드 계약 변경이라 범위가 크고, §9.3 이 이미 live 1차 소스를 store/thread snapshot 으로 규정하고 있어 정합적이다.
- **`systemError.nodeId` 로 귀속 판정 (vs `AI_NODE_TYPES` 만)**: `conversationMessages` 는 execution-scope 단일 배열이라 노드 타입만으로 분기하면 실패와 무관한 다른 AI 노드를 선택했을 때도 대화가 뜬다. `system_error` item 의 `nodeId` 가 정확한 귀속 신호다 (spec §1.2.1 이 이미 nodeId snapshot 을 규정).
- **탭 정책 SoT 를 §10.6.1 에 유지 (vs `conversation-thread.md §9.13` 신설)**: consistency-check 1회차 CRITICAL 로 정정된 결정. `14-execution-history.md:211` 이 §10.6.1 을 탭 구성·기본탭의 단일 진실로 명문화하고 있어, `conversation-thread.md` 에 탭 정책을 신설하면 같은 컴포넌트에 대해 두 SoT 가 생긴다. `conversation-thread.md` 는 **데이터 소스(§9.3)·불변량(Inv-8)·회귀 시나리오(CT-S15/16)** 만 소유하고 탭 규칙은 §10.6.1 을 참조한다.
- **§10.6.1 예외를 non-retryable 까지 확장 (vs retryable 한정 유지)**: 기존 예외는 `retryable === true` 한정이나, `system_error` 는 §9.1 상 retryable 여부와 무관하게 thread 인라인 표시되고 (non-retryable 은 액션 영역만 비어있음), 대화 시간축을 보존할 가치는 재시도 가능성과 독립적이다. 인증 실패로 종결된 대화도 흐름을 보는 것이 오류 JSON 을 먼저 보는 것보다 유용하다.
- **cross-node thread 미필터링**: Phase 2 §WARNING 1 대응 절 참조. 근거는 §3 스코프 규칙·§9.3·§2.2·기존 `isWaitingConversation` 분기·사용자 제보 스크린샷. **본 결정도 spec Rationale (§8.5) 에 기록** — plan 은 완료 후 이동하므로 결정 근거가 plan 에만 남으면 소실된다 (plan_coherence 2회차 INFO).
