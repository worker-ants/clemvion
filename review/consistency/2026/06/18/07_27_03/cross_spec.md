# Cross-Spec 일관성 검토 결과

target: `spec/5-system/4-execution-engine.md`
검토 모드: `--impl-done` (scope=spec/5-system/4-execution-engine.md, diff-base=claude/engine-split-s3-formbutton)
검토 대상 변경: C-1 step4 — `RetryTurnService` 추출 (PR4 `claude/engine-split-s4-retry`)

---

## 발견사항

### INFO-1: spec 이 아직 `ExecutionEngineService` 직속 암묵 표현 유지 — `RetryTurnService` 미등재
- target 위치: `spec/5-system/4-execution-engine.md` §1.3 / §7.5 / 전반 — `applyRetryLastTurn`, `resumeGraphAfterRetry`, `completeRetryExecution`, `failRetryExecution` 메서드가 `ExecutionEngineService` 직속인 것처럼 기술됨
- 충돌 대상: 구현 `retry-turn.service.ts` (PR4), `c1-engine-split.md §PR4`, `spec-update-engine-split.md §변경`
- 상세: spec 본문에 `RetryTurnService` 에 대한 언급이 없으며, 위 4개 메서드를 엔진 신규 서비스가 담당한다는 서술이 없다. 단, `spec-update-engine-split.md` 가 이를 체인 종료 시 일괄 반영할 "후속 planner 작업"으로 명시적으로 지정해 두었으므로 현재 PR4 범위에서 spec 에 이 메서드 이동을 반영하지 않은 것은 의도된 상태다.
- 제안: `plan/in-progress/spec-update-engine-split.md` 의 실행 절차에 따라 planner 가 `spec/5-system/4-execution-engine.md §Rationale` 에 C-1 분할 결정 항 신설 + §1.3/§7.5 메서드 소속 포인터 갱신. PR4 배포 후 수행. 코드 동작은 정확하며 spec 텍스트만 추적이 늦음 — 차단 아님.

### INFO-2: `spec/conventions/interaction-type-registry.md §1.2` Backend emit 위치 열 — `ai_conversation`/`ai_form_render`/`buttons` 포인터 stale
- target 위치: 해당 없음 (PR4 변경과 직접 관계 없으나 C-1 체인의 누적 stale)
- 충돌 대상: `spec/conventions/interaction-type-registry.md` L31 (WaitingInteractionType 위치 포인터) / L43-44 (Backend emit 위치 열)
- 상세: `interaction-type-registry.md` §1.2 의 "Backend emit 위치" 열이 `ExecutionEngineService` 를 직접 가리키고 있으나, PR2(AiTurnOrchestrator)·PR3(ButtonInteractionService) 에서 실제 emit 위치가 이동됐다. L31 에 `WaitingInteractionType` 소속은 `execution-engine.service.ts` 로 표기돼 있으며 이는 현재도 정확하나, emit 위치는 위임 서비스로 이동됐다.
- 제안: `spec-update-engine-split.md §spec/conventions/interaction-type-registry.md §1.1·§1.2` 갱신 항에 이미 반영 예정. planner 가 체인 종료 시 처리.

### INFO-3: `spec/data-flow/3-execution.md` 시퀀스 다이어그램 actor — `ExecutionEngineService` 단일 actor 로 표현
- target 위치: `spec/data-flow/3-execution.md` L42, L73, L123, L152 (`participant Eng as ExecutionEngineService`)
- 충돌 대상: 구현 — `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService` 가 실제 처리 주체
- 상세: data-flow 다이어그램이 엔진 내부 위임 구조를 반영하지 않고 단일 actor 로 표현 중. 기능 동작 자체는 정확하며 위임 패턴이 외부 시퀀스(REST·WS·큐 경계)를 변경하지 않으므로 동작 모순은 없다.
- 제안: `spec-update-engine-split.md §spec/data-flow/3-execution.md` 에 "선택(차단 아님)" 으로 이미 분류됨. planner 재량.

### INFO-4: `EngineDriver` 계약이 spec 어느 파일에도 명시적으로 정의되지 않음
- target 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` (PR4 에서 `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache` 5개 멤버 추가)
- 충돌 대상: `spec/5-system/4-execution-engine.md` — EngineDriver 인터페이스 멤버 목록 미기재
- 상세: PR2 도입 후 PR3·PR4 가 멤버를 계속 추가해 총 12+개 멤버가 됐으나 spec 본문 어디에도 `EngineDriver` 멤버 카탈로그가 없다. `c1-engine-split.md` 는 이것이 "엔진 내부 전용 계약(in-process 전제, 분산 분리 아님)" 임을 규정하고 있으며, spec 변경 계획(`spec-update-engine-split.md`)은 Rationale 에 설계 결정만 기록하는 방향이다 — 멤버 목록 박제는 불필요로 간주된 것으로 보인다.
- 제안: spec 에 EngineDriver 멤버 목록까지 박제할 필요는 없으나(내부 계약, 코드베이스 SoT), Rationale 신설 항에 "EngineDriver 는 엔진 내부 전용 토큰이며 spec 레벨 외부 계약이 아님" 을 명시해 후속 독자 혼란 방지.

### INFO-5: `rehydrateContext` / `loadAndBuildGraph` / `runNodeDispatchLoop` — `private` → `public` 변경이 spec 의 "엔진 내부" 전제와 잠재 불일치
- target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — PR4 에서 5개 메서드가 `private` → `public` 으로 변경되고 `@internal` JSDoc 주석 추가됨
- 충돌 대상: `spec/5-system/4-execution-engine.md` §7.5 — `rehydrateContext` 를 엔진 내부 호출로 설명; `spec-update-engine-split.md` — "EngineDriver 는 in-process 전제, 분산 분리 아님" 으로 설계 결정 기록 예정
- 상세: TypeScript `public` 은 NestJS DI + 인터페이스 계약을 통해서만 접근 가능하도록 `@internal` 주석으로 보호하는 구현 패턴이며, 실제 모듈 외부 직접 접근은 JSDoc 으로 금지됨. 동일 패턴이 PR2(`AiTurnOrchestrator`)·PR3(`FormInteractionService`·`ButtonInteractionService`) 에도 적용됐고 이미 병합됨. 기능적 모순은 없으나 `public` 변경이 spec 의 "내부 전용" 서술과 겉보기 어긋남.
- 제안: spec-update-engine-split.md 의 Rationale 항에 "`EngineDriver` 멤버는 `public` 이지만 NestJS DI 경유만 허용 (`@internal`)" 설명 추가.

---

## 요약

PR4(`RetryTurnService` 추출)는 `spec/5-system/4-execution-engine.md` 가 정의하는 `retry_last_turn` 생명주기(`§1.3` 상태 전이 / `§7.9` AI Agent retryable error 종결 / WebSocket `§4.2` ack 계약) 에 대한 어떤 동작 모순도 도입하지 않는다. 이전 PR2·PR3 와 동일한 "엔진 thin delegator 잔류 + 추출 서비스로 위임" 패턴을 재사용했으며, 외부 표면(`retryLastTurn` / `applyRetryLastTurn` 엔진 메서드, WS gateway 호출 경로)은 보존됐다. 식별된 모든 항목은 INFO 등급의 spec 텍스트 추적 지연이며, 이는 C-1 체인 종료 시 `plan/in-progress/spec-update-engine-split.md` 의 planner 작업으로 명시 예약된 상태다. `ExecutionCancelledError` 를 `execution-engine.service.ts` 내부 class 에서 `workflow-errors.ts` export 로 이동한 것도 spec 이 클래스 파일 위치를 정의하지 않으므로 침묵 영역이다.

## 위험도

NONE
