# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 보안 취약점(인가 검증 누락)과 폴링 경로의 상태 전환 누락이 핵심 위험이며, dead code 제거와 트랜잭션 처리 보강이 필요함

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **보안** | `continueExecution` 메서드에 인가(Authorization) 검증 없음. `executionId`만 알면 누구든 타인의 폼 실행을 재개하거나 임의 데이터를 주입 가능 | `execution-engine.service.ts` — `continueExecution()` | 컨트롤러/게이트웨이 레이어에서 `execution.executedBy === currentUserId` 검증 강제화 |
| 2 | **보안** | `formData` 입력값 검증 없이 DB에 그대로 저장. 크기 제한이나 스키마 검증 없어 Payload Flooding 가능 | `execution-engine.service.ts` — `continueExecution()` → `waitForFormSubmission()` | 폼 노드 `node.config` 스키마에 맞춰 검증 + 최대 크기(예: 1MB) 제한 추가 |
| 3 | **보안** | `node.config?.timeout` 값 범위 미검증. 매우 큰 값 설정 시 `pendingContinuations` 영구 유지, 0/음수 설정 시 폼 기능 무력화 가능 | `execution-engine.service.ts` — `waitForFormSubmission()` | `Math.max(60, Math.min(timeout, 86400))` 등 범위 제한 적용 |
| 4 | **보안 / 신뢰성** | WebSocket 이벤트 페이로드를 타입 단언(`data as {...}`)만으로 처리, 런타임 검증 없음. 변조된 페이로드 수신 시 프론트엔드 상태 오염 가능 | `use-execution-events.ts` — 모든 WebSocket 핸들러 | zod 등으로 런타임 스키마 검증 추가 |
| 5 | **Dead Code / 유지보수** | `handleExecutionStarted` 내부의 `waiting_for_input` guard가 dead code로 전락. 백엔드가 이제 `execution.resumed`를 emit하므로 `execution.started`로 이 분기에 도달 불가. `resumeFromForm()`이 두 핸들러에서 중복 호출될 수 있는 구조 | `use-execution-events.ts:88-97` — `handleExecutionStarted` | guard 블록과 `resumeFromForm` 의존성을 `handleExecutionStarted`에서 제거. resume 로직은 `handleExecutionResumed`에만 집중 |
| 6 | **신뢰성** | 폴링(REST) 경로에서 `waiting_for_input → running` 전환 감지 시 `resumeFromForm()` 미호출. WebSocket 이벤트가 유실되면 UI가 폼 대기 상태에 영구 고착 가능 | `use-execution-events.ts` — `pollExecutionStatus` 함수 | 이전 상태가 `waiting_for_input`이고 현재 상태가 `running`인 경우 `resumeFromForm()` 호출 추가 |
| 7 | **데이터 무결성** | Form 재개 시 `nodeExec.status = COMPLETED` 저장과 `updateExecutionStatus(RUNNING)` 이 두 쓰기가 트랜잭션 없이 순차 실행. 서버 재시작 시 `node_execution`은 COMPLETED, `execution`은 WAITING_FOR_INPUT으로 상태 불일치 발생 가능 | `execution-engine.service.ts` — `waitForFormSubmission()` | `EntityManager.transaction()` 또는 QueryRunner로 두 업데이트를 단일 트랜잭션으로 묶을 것 |
| 8 | **신뢰성** | `resumeFromForm` store 구현의 멱등성 미보장 확인. REST 폴링과 WebSocket 이중 경로에서 `resumeFromForm()`이 중복 호출될 수 있으며, 이미 `running` 상태에서 재호출 시 부작용 여부 불명확 | `execution-engine.service.ts` + `use-execution-events.ts` — 폴링/이벤트 이중 경로 | `resumeFromForm` 스토어 액션의 멱등성 명시적 보장 및 단위 테스트 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **성능 / 메모리** | `setTimeout` 반환 핸들이 저장되지 않아 `continueExecution`/`cancelWaitingExecution` 호출 후에도 타이머 콜백이 대기열에 잔존 (30분 타이머가 대규모 병렬 실행 시 누적) | `execution-engine.service.ts` — `waitForFormSubmission()` | `pendingContinuations` Map에 `timeoutHandle` 필드 추가 후 명시적 `clearTimeout` 처리 |
| 2 | **아키텍처** | `EXECUTION_RESUMED` 이벤트 페이로드(`{ status: RUNNING }`)를 프론트엔드 핸들러가 완전히 무시. 현재는 무해하나 페이로드 계약이 문서화되지 않음 | `use-execution-events.ts` — `handleExecutionResumed` | `(_data: unknown) =>` 시그니처 명시 또는 JSDoc으로 페이로드 구조 문서화 |
| 3 | **아키텍처** | `handleExecutionResumed`가 의존성 배열에 포함되었으나 `resumeFromForm` 자체는 누락. Zustand 액션 참조는 안정적이라 실제 문제는 없으나 exhaustive-deps lint 경고 가능 | `use-execution-events.ts` — `useEffect` 의존성 배열 | `resumeFromForm`을 deps 배열에 추가하거나 eslint-disable 주석으로 의도 명시 |
| 4 | **보안** | 에러 핸들링에서 스택 트레이스가 DB에 저장됨. 클라이언트에 노출 시 내부 구조 정보 누출 가능 | `execution-engine.service.ts` — `runExecution()` catch 블록 | 스택 트레이스는 서버 로그에만 기록, DB 저장 및 API 응답에서 제외 |
| 5 | **테스트** | cleanup 테스트에서 `execution.resumed` 이벤트 핸들러가 `client.off`로 정상 해제되는지 명시적으로 assert되지 않음 | `use-execution-events.test.ts` — cleanup 테스트 | cleanup 시 `execution.resumed`가 `off` 처리됨을 명시적으로 assert 추가 |
| 6 | **테스트** | `handleExecutionResumed`가 `waiting_for_input` 이외의 상태(예: `idle`, `completed`)에서 수신될 때의 방어 로직과 테스트 없음 | `use-execution-events.ts` — `handleExecutionResumed` | 상태 가드 추가 또는 엣지 케이스 테스트 추가 |
| 7 | **테스트** | `handleExecutionStarted`의 `executionId` 누락 페이로드 early return 경로(`if (!payload.executionId) return`) 검증 테스트 없음 | `use-execution-events.test.ts` | `handler({})` 호출 시 스토어 불변 확인하는 테스트 케이스 추가 |
| 8 | **문서화** | `EXECUTION_RESUMED` enum 값에 JSDoc 없음. `EXECUTION_STARTED`와 혼동 가능 | `websocket.service.ts` — `ExecutionEventType` enum | `/** Emitted when execution resumes after a Form node receives user input (not a fresh start) */` 추가 |
| 9 | **문서화** | `waitForFormSubmission` JSDoc이 새로 추가된 `EXECUTION_RESUMED` 이벤트 발행을 언급하지 않음 | `execution-engine.service.ts:377` — 메서드 JSDoc | `* and emits {@link ExecutionEventType.EXECUTION_RESUMED} via WebSocket.` 추가 |
| 10 | **타입 일관성** | 백엔드 `ExecutionEventType` enum과 프론트엔드 문자열 리터럴(`"execution.resumed"`)이 분리되어 이벤트명 변경 시 동기화 누락 위험 | `websocket.service.ts` + `use-execution-events.ts` | 프론트엔드에 이벤트 타입 상수 정의 또는 타입 생성 도구로 백엔드 enum 공유 검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | `continueExecution` 인가 검증 누락, `formData` 미검증, 타임아웃 범위 미제한 |
| requirement | MEDIUM | 폴링 경로의 `resumeFromForm` 미호출, dead code 분기, `resumeFromForm` 구현 검증 필요 |
| database | LOW | Form 재개 시 트랜잭션 없는 이중 쓰기로 상태 불일치 가능성 |
| concurrency | LOW | `handleExecutionStarted` dead code, 폴링/WebSocket 이중 경로 멱등성 의존 |
| api_contract | LOW | `execution.started` 핸들러의 `waiting_for_input` 분기 dead code 가능성 |
| maintainability | LOW | `handleExecutionStarted` 내 dead code, 페이로드 타입 계약 문서화 부재 |
| architecture | LOW | `handleExecutionStarted` dead code, `useEffect` deps 누락 |
| side_effect | LOW | `handleExecutionStarted` guard가 dead code로 전락 |
| performance | LOW | `handleExecutionStarted` dead code, `setTimeout` 명시적 정리 미흡 |
| scope | LOW | `handleExecutionStarted` `waiting_for_input` guard 중복 가능성 |
| testing | LOW | cleanup 테스트, 엣지 케이스 테스트 커버리지 공백 |
| documentation | LOW | JSDoc 미갱신, `handleExecutionStarted` guard 주석 부재 |
| dependency | LOW | `handleExecutionStarted` 내 상태 분기 중복 경로 |

---

## 발견 없는 에이전트

없음 (모든 에이전트가 최소 1건 이상 발견)

---

## 권장 조치사항

1. **[보안 - 즉시]** `continueExecution` 호출 레이어(WebSocket 게이트웨이 또는 REST 컨트롤러)에 소유자 인가 검증 추가
2. **[보안 - 즉시]** `formData` 입력값을 폼 노드 스키마 기준으로 검증하고 최대 크기 제한 적용
3. **[신뢰성 - 높음]** `pollExecutionStatus`에 `waiting_for_input → running` 전환 감지 시 `resumeFromForm()` 호출 추가 (WebSocket 유실 대비)
4. **[신뢰성 - 높음]** `resumeFromForm` 스토어 액션의 멱등성 명시적 보장 및 단위 테스트 작성
5. **[유지보수 - 높음]** `handleExecutionStarted`의 `waiting_for_input` guard 블록과 `resumeFromForm` 의존성 제거 (dead code)
6. **[데이터 무결성 - 중간]** `waitForFormSubmission`의 두 DB 쓰기를 `EntityManager.transaction()`으로 묶어 원자성 보장
7. **[보안 - 중간]** `node.config?.timeout` 값에 `Math.max(60, Math.min(timeout, 86400))` 범위 제한 적용
8. **[성능 - 낮음]** `pendingContinuations` Map에 `timeoutHandle` 저장 후 `continueExecution`/`cancelWaitingExecution` 시 `clearTimeout` 명시적 처리
9. **[테스트]** cleanup 시 `execution.resumed` 해제 assert, `handleExecutionResumed` 상태 가드 및 엣지 케이스 테스트 추가
10. **[문서화]** `EXECUTION_RESUMED` enum JSDoc, `waitForFormSubmission` JSDoc 갱신, `handleExecutionStarted` guard 주석 추가 (또는 코드 제거)