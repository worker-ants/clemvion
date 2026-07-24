# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — requirement reviewer 가 정적 분석으로, 신규 e2e 의 핵심 단언("하류 노드는 dispatch 되지 않는다")이 실제 엔진 구현(선형 디스패치 경로에서 `context.abortSignal` 이 항상 `undefined`, `stop()` 은 DB 상태만 갱신)으로 보장되지 않을 가능성이 높다고 지적함. 병합 전 이 테스트 파일을 격리 실행해 실제 통과 여부를 재확인해야 한다. (forced reviewer 7명 전원 결과 확보됨 — 강제 화이트리스트 미이행 사례는 없음.)

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | e2e 핵심 단언("하류 노드는 절대 실행되지 않는다")이 실제 엔진 구현으로 보장되지 않는다. 선형(비-parallel) 디스패치 경로에서 `ExecutionContext.abortSignal` 은 `execution-context.service.ts` 의 `createContext` 가 만든 최초 컨텍스트에 존재하지 않고, 값을 할당하는 유일한 지점은 `parallel-executor.ts:245`(parallel 분기 전용)뿐이라 선형 그래프에서는 `execution-engine.service.ts:6058` 의 `context.abortSignal?.throwIfAborted()` 가 항상 no-op. `stop()`(`executions.service.ts:732-793`)은 조건부 UPDATE 로 DB 행만 바꿀 뿐 진행 중인 `runExecution` 코루틴에 신호를 보내는 `AbortController`/registry 가 없고, 디스패치 루프(`execution-engine.service.ts:4252-4454`)는 노드 간 Execution 최신 상태를 재조회하지 않으며, 노드 완료 기록(`:5645-5651`)은 부모 Execution 상태와 무관하게 무조건 저장됨. 결과적으로 A 완료 직후 같은 콜스택이 그대로 B 를 dispatch → B 가 `completed` 로 끝날 가능성이 높아, 테스트 항목 `expect(downstream).not.toBe('completed')` 가 실패할 것으로 예상됨. plan 문서는 "e2e 259 green" 이라 기술하나 이 정적 분석과 상충. | `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:274-276`; `execution-context.service.ts:21-128`; `parallel-executor.ts:245`; `execution-engine.service.ts:6058`, `:4252-4454`, `:5645-5651`; `executions.service.ts:732-793` | 병합 전 이 파일만 격리 실행(`-t 'node-cancellation-propagation'`)해 실제 통과/실패 재확인. 실패 시 (a) 선형 실행에도 in-flight 전파 체크(다음 노드 dispatch 직전 Execution 최신 상태 재조회 또는 `abortSignal` 배선)를 엔진에 추가하거나, (b) 이 e2e 단언과 spec §5.1 서술을 "Execution 레벨 최종 상태만 보장" 으로 정정 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | plan 이동(in-progress→complete)이 `node-cancellation-infrastructure.md` 안의 상대경로 링크 3곳을 dangling 으로 만듦(`../in-progress/node-cancellation-inflight-followups.md` 가 더 이상 존재하지 않는 경로를 가리킴). `spec-link-integrity.test.ts` 는 `spec/**`→`plan/**` 링크만 검사해 이 깨짐을 잡지 못함 | `plan/complete/node-cancellation-infrastructure.md:70,83,90` (diff 밖, 이번 이동이 유발) | 같은 diff 에서 `../complete/node-cancellation-inflight-followups.md` 로 3곳 갱신 |
| 2 | Requirement / Consistency | `spec/conventions/node-cancellation.md` frontmatter 의 `status: partial → implemented` 승격이 규약(spec-impl-evidence.md §3.1, "마지막 pending_plans 가 complete/ 로 이동한 commit 안에서 승격")은 정확히 따랐으나, 본문 §6 구현 현황 표에는 chat-channel/MakeShop/Cafe24 노드 signal 전파, workflow-timeout 노드 abort 등 4개 항목이 여전히 "미구현(Planned)"으로 남아 있고, `pending_plans` 제거로 이 잔여 항목들을 추적하는 활성 plan 이 현재 전무함. "implemented"(모든 약속 구현 완료) 라는 라벨과 문서 본문이 어긋남 (scope/side_effect/documentation 3개 reviewer 가 동일 이슈를 중복 지적) | `spec/conventions/node-cancellation.md:3` (frontmatter), §6 표(135-139행 부근) | project-planner 위임: 잔여 4개 항목을 추적할 새 `pending_plans` 를 만들어 `status: partial` 유지하거나, out-of-scope 근거를 명시하고 승격을 정당화 |
| 3 | Maintainability | "진행 중 노드 대기" 폴링 블록(`waitUntil(... 'running', 30_000, ...)`)이 파일 내 두 테스트에 인자까지 완전히 동일하게 중복 — 같은 파일 안 신규 중복이라 기존 관행 답습으로 보기 어려움 | `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:246-251`, `:300-305` | `waitForNodeRunning(nodeId)` 헬퍼로 추출 |
| 4 | Testing | 하류 노드 상태 단언이 배제(exclusion) 방식(`not.toBe('completed')`, `not.toBe('running')`)이라, 취소 전파와 무관한 별개 버그로 `'failed'` 등 다른 상태에 도달해도 두 단언 모두 통과해 "하류가 도달하지 않았다"는 핵심 주장이 거짓 양성으로 통과할 수 있음. 이 파일이 이미 "대조군이 vacuous 통과를 잡았다"는 사례를 보유한 만큼 동일 축의 잔여 지점 | `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:275-276` | 허용 집합 양성 비교로 전환: `expect([null, 'cancelled'].includes(downstream)).toBe(true)` |
| 5 | Documentation | 인라인 주석("창(8s)")이 실제 `INFLIGHT_WINDOW_MS = 5_000`(5초) 및 파일 상단 JSDoc 의 5초 근거 설명과 불일치 — 초안에서 값을 8000→5000 으로 바꾸며 사용처 주석 갱신이 누락된 것으로 보임. 기능 영향은 없으나 향후 타임아웃 예산 조정 시 잘못된 여유값 판단 위험 | `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:262` | "창(8s)"→"창(5s)" 정정, 또는 `INFLIGHT_WINDOW_MS` 를 문자열 보간해 주석에 직접 참조시켜 향후 값 변경에 자동 追従 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | code 노드 busy-wait 스크립트·DB 쿼리 파라미터 바인딩·인증 토큰 동적 발급 모두 안전한 패턴. `waitUntil` 타임아웃 메시지에 프로브 결과값 노출되나 현재는 상태 문자열뿐이라 민감정보 없음 | `node-cancellation-propagation.e2e-spec.ts:136`, `:216`, `:75`, `:232` | 프로브 반환 타입 확장 시 민감 필드 혼입 여부 재검토 권고 |
| 2 | Scope | 3번째 테스트("취소된 실행은 재-stop 을 거부한다")가 plan §3 acceptance criteria(다단계 cancel 전파) 를 다소 벗어나며 `workflow-execution.e2e-spec.ts` D 항목과 부분 중복 | `node-cancellation-propagation.e2e-spec.ts:297` | 문제 아니나 plan 완료 서술에 범위 밖임을 한 줄 명시 권장 |
| 3 | Side Effect | e2e 가 최대 15초의 CPU-바운드 busy-wait 을 발생시키나 `maxWorkers: 1` + 파일 상단에 트레이드오프 문서화됨. `afterAll` 이 생성된 DB 행을 정리하지 않으나 같은 파일군의 확립된 관행과 일치 | `node-cancellation-propagation.e2e-spec.ts:57`, `:91-93`, `:136-141` | 조치 불요 |
| 4 | Maintainability | "terminal 상태 대기" 폴링 3회 반복, "stop 호출 후 200 확인" 스타일 불일치(변수 추출 vs 인라인), `downstream.timeout: 5` 매직 넘버, `slow` 변수명이 label(`'InFlight'`) 과 어긋남, `CanvasNode` 인터페이스가 인접 e2e 파일과 동일하게 재정의(기존 관행) | `:263-268,:287-292,:316-321`; `:254-259,:306-314,:324-329`; `:153`; `:122`; `:60-68` | 각각 헬퍼 통합/스타일 통일/상수화/변수명 정정 — 우선순위 낮음 |
| 5 | Testing | WS 이벤트(`execution.node.cancelled`) 발행은 이 e2e 로 검증되지 않음(REST/DB 관측만). 5초 창이 CI 고부하 시 이론상 여전히 미세한 flaky 여지(이미 완화됨). 3번째 `it` 이 첫 번째와 설정 로직 중복 | 전체 파일; `:57`, `:246-259` | WS 이벤트 커버 여부 별도 확인, 그 외 조치 불요 |
| 6 | Documentation | `execute()`/`getStatus()` 헬퍼에 `nodeStatus()` 와 달리 설명 주석 없음(자명하여 크리티컬 아님) | `node-cancellation-propagation.e2e-spec.ts:190`, `:200` | 일관성 원하면 한 줄씩 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | CRITICAL | 핵심 단언이 엔진 구현으로 보장되지 않을 가능성(정적 분석) — 격리 실행 재검증 필요 |
| security | NONE | 프로덕션 코드 변경 없음, e2e 는 파라미터 바인딩·동적 토큰 등 안전한 패턴만 사용 |
| scope | LOW | plan 이동이 남긴 dangling 링크, 3번째 테스트의 경미한 범위 확장 |
| side_effect | NONE | 프로덕션 부작용 없음, e2e 리소스 비용은 문서화된 트레이드오프 |
| maintainability | LOW | 폴링 블록 중복, 스타일 불일치, 매직 넘버 등 소소한 개선 여지 |
| testing | LOW | 하류 단언의 배제 방식(거짓 양성 가능), 그 외 테스트 설계는 견고(대조군 vacuous 방지 이력 보유) |
| documentation | LOW | 인라인 주석 수치(8s vs 5s) 오류, 그 외 문서화 품질 높음 |

## 발견 없는 에이전트

없음 (7개 reviewer 전원 최소 1건 이상의 INFO 이상 발견사항 보고).

## 권장 조치사항

1. **(최우선)** `node-cancellation-propagation.e2e-spec.ts` 를 병합 전 격리 실행해 실제 통과 여부를 재확인한다. requirement reviewer 의 정적 분석이 맞다면 하류 노드가 `completed` 로 관측되어 테스트가 RED 여야 하며, 이 경우 엔진에 선형 실행 경로용 in-flight 취소 전파를 추가하거나 테스트/spec 단언을 "Execution 레벨 최종 상태만 보장" 으로 정정한다.
2. plan 이동으로 dangling 이 된 `plan/complete/node-cancellation-infrastructure.md` 의 상대경로 링크 3곳(`:70,83,90`)을 `../complete/...` 로 갱신한다.
3. `spec/conventions/node-cancellation.md` §6 표의 잔여 미구현 4개 항목(chat-channel/MakeShop/Cafe24 signal 전파, workflow-timeout abort)에 대한 추적 plan 부재를 project-planner 에 위임해 해소하거나 `status: partial` 유지로 되돌린다.
4. 하류 노드 상태 단언을 배제 방식에서 허용 집합 양성 비교로 전환한다(`:275-276`).
5. 인라인 주석 "창(8s)" 을 실제 값(5s)에 맞게 정정한다(`:262`).
6. (선택) 중복된 폴링 블록·stop 호출 스타일을 공용 헬퍼로 통합한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 실행된 전원이 강제 포함 대상이었으며, 전원 결과 확보됨. 강제 화이트리스트 미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 (세부 사유 미전달) |
  | architecture | router 판단 (세부 사유 미전달) |
  | dependency | router 판단 (세부 사유 미전달) |
  | database | router 판단 (세부 사유 미전달) |
  | concurrency | router 판단 (세부 사유 미전달) |
  | api_contract | router 판단 (세부 사유 미전달) |
  | user_guide_sync | router 판단 (세부 사유 미전달) |