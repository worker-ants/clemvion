# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 동작은 올바르며 핵심 시나리오 커버리지도 충분하나, 주석·스펙·JSDoc 불일치와 일부 엣지 케이스 미검증이 유지보수 부담을 높일 수 있음

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서/유지보수/사이드이펙트/아키텍처/테스트/요구사항 (6개 에이전트 공통) | `done` 이벤트 핸들러의 힌트 우선순위 **주석(`error > stalled > planApprove > completed`)과 코드 실행 순서(`stalled → completed → planApprove`)가 불일치**. 현재는 두 조건이 상호 배타적이라 기능 버그는 없으나, 향후 조건이 변경되면 `completed`가 `planApprove`보다 먼저 발동하는 회귀가 발생할 수 있음. 스펙 §3.2 표도 동일한 불일치를 반복함 | `assistant-store.ts` done 분기 주석 / `spec/3-workflow-editor/4-ai-assistant.md` §3.2 | 코드 `else-if` 순서를 `stalled → planApprove → completed`로 재배치하거나, 주석·스펙을 실제 코드 순서(`error > stalled > completed > planApprove`)로 일치시킴 |
| 2 | 문서/사이드이펙트/요구사항 (3개 에이전트 공통) | `WorkflowAssistantStreamService` 클래스 JSDoc이 **구 guard 동작("두 번째 finish는 정상 탈출로 허용한다")을 그대로 기술**하고 있어 실제 progress-aware 로직과 불일치 | `workflow-assistant-stream.service.ts` 클래스 및 `streamMessage` JSDoc | "block 후 LLM이 edit/plan 성공 시 가드 재발동, 진척 없이 retry하면 stuck으로 간주해 탈출"로 갱신 |
| 3 | 요구사항 | **스펙 §2.3가 미갱신** — "LLM이 plan 생성 후 짧은 한국어 메시지로 approve 요청"이라고 기술하나, 실제 구현은 plan-only 턴에서 prose를 **금지**하고 클라이언트가 hint를 자동 주입함 | `spec/3-workflow-editor/4-ai-assistant.md` §2.3 | "propose_plan 직후 prose 없이 finish 호출, 클라이언트가 `systemHint: planApproveConfirm`을 자동 주입"으로 수정 |
| 4 | 요구사항/사이드이펙트 | **`openQuestions`가 있는 plan에서 `planApprove` hint가 함께 노출**되어 상충하는 UX 메시지가 동시 표시됨 — plan 카드 내 "답변을 입력창에 적어 보내 주세요" 안내와 "계획대로 진행해 주세요" hint가 충돌 | `assistant-store.ts` planApprove 분기 | 조건에 `!(updated.plan.openQuestions?.length)` 추가 |
| 5 | 유지보수/아키텍처 (2개 에이전트 공통) | **`evaluateFinishGuard` 파라미터가 7개**로 증가 — `finishBlockCount`, `editsSinceLastFinishBlock`, `planClearedThisTurn`이 같은 guard 상태를 표현하며, 향후 조건 추가 시 계속 늘어날 구조 | `workflow-assistant-stream.service.ts:716` 선언부 및 호출 지점 | `interface FinishGuardState { finishBlockCount; editsSinceLastFinishBlock; planClearedThisTurn }` 으로 묶어 단일 객체로 전달 |
| 6 | 문서/API 계약 (2개 에이전트 공통) | **`evaluateFinishGuard` JSDoc에 새 파라미터 `editsSinceLastFinishBlock` 설명 누락** — 두 카운터의 상호작용이 비자명하여 유지보수 시 혼란 유발 가능 | `workflow-assistant-stream.service.ts` `evaluateFinishGuard` 선언 | `@param finishBlockCount` / `@param editsSinceLastFinishBlock` 설명 2줄 추가 |
| 7 | 문서 | **스펙 "Turn completion hint" 행의 우선순위 표기가 구버전** — `(우선순위: error > stalled > completed)` 에 `planApprove` 누락 | `spec/3-workflow-editor/4-ai-assistant.md` §3.2 표 | `(우선순위: error > stalled > planApprove > completed)` 로 수정 |
| 8 | 성능 | **Progress-aware guard로 인해 LLM API 라운드트립이 선형 증가**, N step plan에서 step-by-step 실행 시 총 input token이 O(N²)에 근접 — `toolCallsBudget`(hard-cap 200)이 유일한 안전망 | `workflow-assistant-stream.service.ts` while 루프 + `evaluateFinishGuard` | 라운드 횟수 상한(`maxRoundsPerTurn`)을 budget과 별개로 추가하여 비용 예측 가능성 확보 |
| 9 | 테스트 | **실패한 edit(`ok: false`)가 `editsSinceLastFinishBlock`에 산입되지 않음을 검증하는 테스트 부재** — 미래 리팩터링에서 실패도 카운트하면 stuck LLM 무한루프 위험 | `workflow-assistant-stream.service.spec.ts` | `ok:false` edit 연속 후 finish → 즉시 탈출(stuck) 시나리오 테스트 추가 |
| 10 | 테스트 | **`propose_plan` 성공이 `editsSinceLastFinishBlock`을 증가시키는 경로 미검증** — 구현은 `kind === 'plan' && ok === true`도 카운트하나 테스트는 `add_node`(edit)만 다룸 | `workflow-assistant-stream.service.spec.ts` | block 후 propose_plan + finish → guard 재발동 시나리오 테스트 추가 |
| 11 | 테스트 | **`summarizePlanState`에서 `openQuestions` 잔존 시 'completed' 방지 미검증** — 모든 step이 done이지만 openQuestions가 있을 때 'pending'을 반환해야 하는 경계값 테스트 없음 | `assistant-store.test.ts` `summarizePlanState` describe 블록 | openQuestions가 있는 경우 'completed'가 아닌 'pending' 반환 케이스 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성/보안/사이드이펙트/API 계약 (4개 에이전트 공통) | `handleSseEvent`·`summarizePlanState`가 테스트 목적으로 `export` 승격 — 모듈 API surface 확대, `handleSseEvent`는 순수함수가 아니라 Zustand store를 직접 변경하여 외부 직접 호출 시 스트리밍 생애주기 상태와 불일치 가능 | `assistant-store.ts:383, 569` | `@internal` TSDoc 태그 추가 또는 `__test_utils__` 별도 파일로 분리 검토 |
| 2 | 보안/사이드이펙트/성능/요구사항 (4개 에이전트 공통) | `propose_plan` 성공이 진척 카운터에 포함됨 — LLM이 step 실행 없이 plan을 반복 수정하면 round가 예상보다 늘어날 수 있으나, `toolCallsBudget` 절대 상한으로 무한루프 방어됨 | `workflow-assistant-stream.service.ts:451-458` | 현재 허용 가능; 반복 패턴 관찰 시 `clear_plan + propose_plan` 쌍만 진척 인정 방향 검토 |
| 3 | 유지보수/성능/테스트 (3개 에이전트 공통) | `system-prompt.spec.ts` 정규식 `(b)` 패턴이 양방향 alternation으로 복잡하여 프롬프트 문구 변경 시 취약 | `system-prompt.spec.ts` `(b)` assertion | 두 방향 패턴을 별도 `expect` 두 개로 분리 |
| 4 | 동시성 | `sendMessage`에서 `isStreaming: true` 설정 후 `abortController` 설정 사이 짧은 창에 `stop()` 호출 시 중단 신호 무시 | `assistant-store.ts` `sendMessage` 함수 | `AbortController`를 `isStreaming: true`와 함께 즉시 설정하거나 `stop()`에서 pending 세션 생성도 방해 가능하도록 개선 |
| 5 | 동시성 | `approveActivePlan`에서 plan을 `approved: true`로 변경 후 `sendMessage`가 `isStreaming`으로 즉시 반환되면 UI는 승인됨으로 표시되나 실제 실행 없음 | `assistant-store.ts` `approveActivePlan` | `isStreaming` 중이면 plan 상태 변경 전 얼리 리턴 또는 "현재 처리 중" 토스트 제공 |
| 6 | 아키텍처 | `assistant.planApproveConfirm` i18n 키가 서버 전송 메시지(승인 신호)와 클라이언트 UI hint에 이중 사용 — 세 곳(프롬프트·서버 전송·hint)이 묵시적으로 연결 | `assistant-store.ts` | `assistant.planApproveHint`(UI)·`assistant.planApproveMessage`(서버 전송)로 분리 |
| 7 | 아키텍처 | 백엔드-프론트 간 "plan-only 턴" 계약이 타입이 아닌 관례와 프롬프트로만 유지 — 클라이언트가 4중 조건(`plan 존재 && !approved && !hasEdit && !content`)으로 역추론 | `assistant-store.ts` done 분기 / `system-prompt.ts` | `done` 이벤트 페이로드에 `turnKind: 'plan-only' | 'execution' | 'clarify'` 서버 명시 추가 검토 |
| 8 | 아키텍처 | `finishBlockCount`·`editsSinceLastFinishBlock` 카운터 불변식이 루프 내 두 곳에 분산 — 새 block 경로 추가 시 리셋 누락 위험 | `workflow-assistant-stream.service.ts:287-296, 451-459` | `class FinishBlockTracker { block(); recordProgress(); canEscape() }` 캡슐화 검토 |
| 9 | 의존성 | 테스트에서 `useLocaleStore.setState` 직접 조작으로 `locale-store` 내부 구조에 강결합 | `assistant-store.test.ts:8` | 현재 규모에서 합리적; `locale-store` 리팩터링 시 이 파일도 함께 점검 필요 |
| 10 | 테스트 | `openQuestions` 있는 미승인 plan에서 `planApprove` hint 발동 여부 미검증 | `assistant-store.test.ts` done event 시나리오 | openQuestions가 있는 미승인 plan에서 hint 발동/미발동 명시 테스트 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | `propose_plan` 반복으로 인한 budget 소진 가능성 (toolCallsBudget이 안전망) |
| Performance | LOW | Progress-aware guard로 인한 O(N²) token 소비 패턴, 라운드 수 상한 부재 |
| Architecture | LOW | evaluateFinishGuard 파라미터 과잉, plan-only 계약이 타입 없이 관례로만 유지 |
| Requirement | LOW | 스펙 §2.3 미갱신, openQuestions+planApprove hint 충돌 |
| Documentation | LOW | 클래스 JSDoc 구식, 스펙 hint 우선순위 표기 미갱신 |
| Maintainability | LOW | 힌트 우선순위 주석-코드 불일치, evaluateFinishGuard 파라미터 누적 |
| Side Effect | LOW | done 이벤트 힌트 우선순위 주석-코드 불일치 |
| Testing | LOW | 실패 edit 미산입 검증 부재, propose_plan 진척 경로 미검증, openQuestions 경계값 미검증 |
| Scope | LOW | 힌트 우선순위 주석-코드-스펙 사소한 불일치 |
| API Contract | LOW | evaluateFinishGuard JSDoc 신규 파라미터 설명 누락 |
| Concurrency | LOW | AbortController 설정 지연으로 짧은 stop-불능 창 존재 |
| Dependency | NONE | 외부 패키지 추가 없음, 테스트 전용 export의 locale-store 결합 |
| Database | NONE | DB 관련 변경사항 없음 |

---

## 발견 없는 에이전트

- **Database** — 변경된 파일 전체가 DB와 무관한 순수 로직·프롬프트·프론트엔드 스토어

---

## 권장 조치사항

1. **[즉시] 힌트 우선순위 주석·코드·스펙 일치** — `assistant-store.ts` `else-if` 순서를 `stalled → planApprove → completed`로 재배치하거나 주석과 스펙 §3.2를 실제 순서로 통일 (6개 에이전트 지적, 엣지 케이스 버그 잠재)

2. **[즉시] `openQuestions` 있는 plan에서 planApprove hint 억제** — `!(updated.plan.openQuestions?.length)` 조건 추가로 상충 UX 메시지 제거

3. **[즉시] 스펙 §2.3 갱신** — "prose 금지 + 클라이언트 hint 자동 주입" 방식으로 최신 구현과 동기화

4. **[단기] 클래스 JSDoc 갱신** — `streamMessage`/`WorkflowAssistantStreamService` JSDoc에서 "두 번째 finish 정상 탈출" 구절을 progress-aware 동작 설명으로 교체

5. **[단기] `evaluateFinishGuard` JSDoc 및 파라미터 정리** — 신규 파라미터 설명 추가 후, 중기적으로 `FinishGuardState` 인터페이스로 묶어 파라미터 수 감소

6. **[단기] 누락 테스트 3종 추가** — ① `ok:false` edit 후 stuck 탈출, ② `propose_plan` 후 guard 재발동, ③ `openQuestions` 잔존 시 `summarizePlanState` 'pending' 반환

7. **[중기] 라운드 수 상한(`maxRoundsPerTurn`) 추가** — `toolCallsBudget`과 별개로 단일 턴당 LLM 라운드 수를 명시적으로 제한하여 O(N²) token 비용 예측 가능성 확보

8. **[중기] `done` 이벤트 페이로드에 `turnKind` 추가 검토** — 클라이언트의 4중 역추론 조건을 서버 명시 필드로 대체하여 plan-only 계약을 타입 수준으로 격상