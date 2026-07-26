# Code Review 통합 보고서

## 전체 위험도
**LOW** — 즉시 차단할 CRITICAL 없음. WARNING 6건은 전부 기존에 이미 추적/합의되었거나 신규 발견이라도 저위험·저확률(구조 중복, 명명 일관성, 테스트 완결성, 문서 rename 전파 누락)이다. 10개 reviewer(강제 7명 포함) 전원 결과 확보 완료 — forced whitelist 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Maintainability | "Execution이 non-terminal인지 행 잠금으로 확인"하는 `SELECT ... FOR UPDATE` 트랜잭션이 신규 `assertActiveExecutionAndSaveNodeExec`와 기존 `updateExecutionStatus`의 `linkedNodeExec` 분기 두 곳에 SQL·구조가 그대로 복제됨. 근본 원인은 상태 머신이 자기-전이(RUNNING→RUNNING)를 표현하지 못해 별도 choke point가 생긴 것 | `execution-engine.service.ts:8049-8073`(신규) vs `:8230-8254`(기존 linkedNodeExec 분기) | 잠금 조회를 `lockNonTerminalExecutionRow(manager, executionId)` 같은 공유 헬퍼로 추출하거나, `assertTransition`에 자기-전이 opt-in을 추가해 단일 choke point로 수렴 |
| 2 | Requirement (표시 계층) | `handleAiMessageTurn`이 LLM 호출 종료 후 취소 재확인 없이 `AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT`을 무조건 emit — DB 최종 상태는 안전하지만 클라이언트는 "계속됨" 이벤트를 먼저 받고 뒤늦게 "취소됨" 정정을 받을 수 있음 | `ai-turn-orchestrator.service.ts:671`(turn 경계 가드, handler 호출 이전 1회) / `:838-936`,`:966-997`(무조건 emit) | 이미 3차 라운드에서 발견·`plan/in-progress/ie-resume-turn-boundary-cancel.md` "후속(본 PR 밖)"에 증상·영향·닫는 방법과 함께 등재되어 본 PR 스코프 밖으로 확정됨. 후속 PR에서 emit 직전 `assertExecutionNotCancelled` 재확인 추가 검토, 착수 전 FE의 이벤트 우선순위 처리 확인 필요 |
| 3 | Side Effect (API 표면) | `ExecutionEngineService`의 public 표면이 이번 라운드로 3개 메서드(`markNodeCancelled`/`assertExecutionNotCancelled`/`assertActiveExecutionAndSaveNodeExec`)로 확대 — DI(`ENGINE_DRIVER` 토큰) 경유 없이 concrete 클래스를 직접 참조하면 인터페이스 계약을 우회해 임의 호출 가능 | `execution-engine.service.ts:4586,7996,8049` / `engine-driver.interface.ts:134,161,183` | 즉시 조치 불요(ISP 설계 의도 문서화됨). 후속 PR에서 DI 우회 직접 참조가 추가되지 않는지 리뷰 체크리스트에 명시 |
| 4 | Maintainability (명명 일관성) | `assert*` 접두 메서드가 이 코드베이스 관례(조건 위반 시 throw)와 다르게, 신규 `assertActiveExecutionAndSaveNodeExec`는 `Promise<boolean>`을 반환하고 실패해도 throw하지 않음 — 이 PR이 고친 CRITICAL(반환값 미확인으로 조용히 진행되던 결함)과 동형의 실수를 유발할 수 있는 이름 | `engine-driver.interface.ts:183`, `execution-engine.service.ts:8049` | `checkActiveAndSaveNodeExec`/`tryLockActiveExecutionAndSave` 등으로 non-throwing/bool 반환임을 이름에 명시하거나 반환 타입을 branded 타입으로 감싸는 방안 검토 |
| 5 | Testing | `assertLinkedTransitionApplied`의 4개 소비처 중 2곳(첫 turn park / retry-last-turn RUNNING 재claim)이 `ExecutionCancelledError` 인스턴스만 검증하고 `phase` 문자열까지는 확인하지 않음 — 두 분기 중 어디서 취소됐는지 회귀를 못 잡음 | `ai-turn-orchestrator.service.spec.ts:313`,`:376` (대조군: `:210`,`:532`는 phase까지 확인) | 313행·376행에 `rejects.toThrow(/cancelled during 첫 AI turn park/)` 및 `/cancelled during AI turn 종료 처리\(RUNNING 재claim\)/` 단언 추가 (3차 라운드에서 "4곳 중 2곳 충족"으로 의도적 부분 반영된 잔여 항목) |
| 6 | Documentation | `assertLinkedTransitionApplied` 파라미터가 3차 라운드에 `applied`→`shouldProceed`로 개정됐으나, 이를 인용하는 4개 호출부 `@throws` JSDoc과 2개 테스트 주석(총 6곳)에는 rename이 전파되지 않아 여전히 옛 이름을 씀 — 이 PR이 스스로 문제 삼은 "같은 이름이 다른 의미로 읽힌다"는 이슈의 축소판이 문서 레이어에 잔존 | `ai-turn-orchestrator.service.ts:395,434,1322,1325` / `ai-turn-orchestrator.service.spec.ts:245,337` | 6곳의 `applied` 인용을 `shouldProceed`로 정정 (짧은 fix, 이번 라운드에 함께 처리 가능) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` spec/conventions/node-cancellation.md §2.1이 "resume 경로 turn 경계 abort 체크는 별도 작업으로 추적" 문구를 여전히 담고 있고, `spec/5-system/4-execution-engine.md` §1.1은 신규 짝 전이 no-op 계약을 반영 안 했으며, `## Rationale` §C-1의 멤버 수(12/7)가 코드 실측치(15/10)와 어긋남 — 코드가 옳고 spec이 stale, 이미 `spec-update-node-cancellation-shutdown-classification.md` #7로 project-planner 위임 완료 | `node-cancellation.md:44`, `execution-engine.md:79`,`:1640`, 대조 `engine-driver.interface.ts:36-43` | 코드 변경 불요. project-planner 턴에서 위임 항목(§2.1 재서술, §1.1 no-op 케이스 추가, Rationale 12/7→15/10 정정) 반영 확인 |
| 2 | Database / Side Effect | 짝 `NodeExecution`의 terminal 마킹(`markNodeCancelled`)이 Execution을 판정한 `FOR UPDATE` 트랜잭션과 분리된 별도 save — 트랜잭션 커밋~markNodeCancelled 완료 사이 크래시 시 NodeExecution이 비-terminal로 좁게 잔류 가능(3차 라운드부터 저위험 합의, 신규 아님) | `ai-turn-orchestrator.service.ts:360,376` / `execution-engine.service.ts:4586` | stalled-job recovery 백스탑이 이 케이스(NodeExecution=RUNNING, Execution=CANCELLED)를 커버하는지 확인. 우선순위 낮음 |
| 3 | Concurrency / Side Effect | `updateExecutionStatus`의 짝 전이 반환 계약(항상 true → 동시 cancel 시 false 가능)을 form/button 4개 호출부가 아직 소비하지 않음 — DB는 FOR UPDATE 가드로 안전하지만 짝 NodeExecution이 영구 RUNNING/WAITING 잔류 가능 | `form-interaction.service.ts:110,325`, `button-interaction.service.ts:395,567` | 이미 `plan/in-progress/ie-resume-turn-boundary-cancel.md` "후속(본 PR 밖)"에 추적됨. 후속 PR에서 `assertLinkedTransitionApplied` 패턴 재사용 권장 |
| 4 | Security / Database | `NON_TERMINAL_STATUSES_SQL`(enum 파생 문자열, 문자열 보간)과 e2e 전용 `__e2e_delay_ms` 마커 — 사용자 입력 무관·프로덕션 fail-closed 가드(`LLM_STUB_MODE`) 확인, 인젝션/DoS 벡터 없음 | `execution-engine.service.ts:507,8058,8235,8276`, `stub.client.ts:38-42` | 조치 불요 |
| 5 | Maintainability | `assertLinkedTransitionApplied` 4개 호출부의 `phase` 문자열 표기 관례가 제각각(em-dash/한글 접두/괄호) | `ai-turn-orchestrator.service.ts:424,526,1482,1501` | 표기 통일 검토(강제 아님) |
| 6 | Maintainability | `engine-driver.interface.ts` JSDoc 멤버 수 하드코딩이 이번 PR 안에서만 두 번째로 stale화(12/7→14/9→15/10) — 매 라운드 수동 갱신 구조 | `engine-driver.interface.ts:36-43` | 정확한 수치 대신 "갱신 절차" 서술로 대체 검토 |
| 7 | Maintainability | `assertLinkedTransitionApplied`의 `executionId` 파라미터가 `context.executionId`와 중복 보유값이고 바로 옆 `phase`와 타입이 같아(둘 다 string) 위치 교환 실수를 컴파일러가 못 잡음(현재는 4곳 모두 정상) | `ai-turn-orchestrator.service.ts:360-381` | `context.executionId` 사용으로 중복 인자 제거 검토 |
| 8 | Concurrency | `recordRunningSegmentStart`(진입)는 `persisted` 확인 후 가드되나 `segmentStartMs` 정리(이탈)는 트랜잭션 결과와 무관하게 먼저 실행 — DB 오염 없음, in-memory 카운터만 비대칭 | `execution-engine.service.ts:8195-8207` vs `:8250,:8294` | 일관성을 위해 이탈 쪽도 persisted 확인 이후로 이동 검토(필수 아님) |
| 9 | Side Effect | 신규 `assertActiveExecutionAndSaveNodeExec`도 `FOR UPDATE` 트랜잭션을 열어 `stop()`과의 직렬화 대기 지점이 하나 더 늘어남(정상 multi-turn 종료 주경로에서 매번 실행) — 데드락 아님, 짧은 단일 행 잠금 | `execution-engine.service.ts:8049-8073` | 조치 불요(의도된 동시성 강화). 고빈도 워크로드에서 지연 체감 시 재검토 |
| 10 | Maintainability | `finalizeAiNode`(~200줄, 3분기+이벤트 emit)/`updateExecutionStatus`(~125줄, 5책임)가 계속 커지는 다중 책임 함수 — 구조적 리팩터는 이전 라운드에서 "선택 사항"으로 명시적 defer됨 | `ai-turn-orchestrator.service.ts:1327-1531`, `execution-engine.service.ts:8174-8299` | 다음 리팩터 라운드 후보로 등재 유지(신규 조치 요구 아님) |
| 11 | Testing | 새 `FOR UPDATE` 가드의 실제 동시 트랜잭션 경합은 unit(mock)/e2e(결정적 순차 호출) 어느 쪽도 진짜 레이스로 재현하지 않음 — 발견된 실결함(stale in-memory lost update)은 정확히 재현되나, 락 자체의 Postgres 의미론은 신뢰에 의존 | 관련 spec 파일 전반 | 이 규모 변경에서 통상적 트레이드오프, 즉시 조치 불요 |
| 12 | Scope | 무관 백로그 plan 문서(cafe24 카탈로그 모순, harness `--impl-done` scope 버그) 편집 및 `updateExecutionStatus` else 분기 opportunistic fix(WARNING #9) — 모두 코드 스코프 침범 아니며 근거 기록·회귀 테스트 동반 | `plan/in-progress/cafe24-backlog-residual.md:220-253`, `plan/in-progress/harness-consistency-summary-downgrade-rule.md:62-85` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | INFO만 확인(executionId 노출 안전, SQL 안전, e2e 마커 안전, TOCTOU 원자화 양성 확인) |
| architecture | LOW | WARNING: choke point SQL/잠금 로직 중복(2곳) |
| requirement | LOW | WARNING: turn 경계 취소 재확인 없는 WS emit(기지 항목); SPEC-DRIFT 3건 |
| scope | NONE | INFO만 확인, 스코프 이탈 없음 |
| side_effect | LOW | WARNING: public 표면 3개 메서드로 확대 |
| maintainability | LOW | WARNING 2건: assert* 명명 계약 불일치, SQL 중복 |
| testing | LOW | WARNING: 4개 소비처 중 2곳 phase 문자열 단언 누락 |
| documentation | LOW | WARNING: `applied`→`shouldProceed` rename 6곳 미전파 |
| database | LOW | INFO만: markNodeCancelled 비원자적 별도 save(저위험, 기지) |
| concurrency | LOW | INFO만: form/button 미소비 반환계약(기지), segmentStartMs 비대칭 |

## 발견 없는 에이전트

- security, scope — Critical/Warning 없음(INFO 수준 확인·양성 검증만 존재)

## 권장 조치사항

1. (문서, 즉시 가능) `applied`→`shouldProceed` rename을 4개 JSDoc `@throws` + 2개 테스트 주석(총 6곳)에 전파 — `ai-turn-orchestrator.service.ts:395,434,1322,1325`, `ai-turn-orchestrator.service.spec.ts:245,337`.
2. (테스트, 즉시 가능) `assertLinkedTransitionApplied` 나머지 2개 소비처 테스트에 phase 문자열 회귀 단언 추가 — `ai-turn-orchestrator.service.spec.ts:313,376`.
3. (구조, 후속 검토) `SELECT ... FOR UPDATE` 잠금 조회를 공유 헬퍼로 추출해 `updateExecutionStatus`/`assertActiveExecutionAndSaveNodeExec` 간 SQL 복제 해소, 또는 상태 머신에 자기-전이 opt-in 도입.
4. (명명, 후속 검토) `assertActiveExecutionAndSaveNodeExec`를 non-throwing/bool 반환임이 드러나는 이름으로 변경 검토.
5. (spec, project-planner 턴) `spec-update-node-cancellation-shutdown-classification.md` #7에 이미 위임된 `node-cancellation.md`/`execution-engine.md` stale 서술 정정을 다음 spec 턴에 반영.
6. (범위 밖, plan에 이미 등재) `handleAiMessageTurn`의 취소 재확인 없는 WS emit, form/button 4개 호출부의 반환계약 미소비는 별도 후속 PR로 진행 — 이번 PR 착수를 막을 필요 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (10명)
  - **제외**: 표 (reviewer · 이유, 4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — whitelist 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(prompt에 구체적 사유 미제공) — 본 diff는 DB 원자성/취소 가드 위주로 성능 영향 표면이 낮다고 판단된 것으로 추정 |
  | dependency | router 판단(prompt에 구체적 사유 미제공) — 신규 외부 의존성 추가 없음 |
  | api_contract | router 판단(prompt에 구체적 사유 미제공) — 공개 API/HTTP 계약 변경 없음(엔진 내부 인터페이스만 확장) |
  | user_guide_sync | router 판단(prompt에 구체적 사유 미제공) — 사용자 대면 가이드/문서 변경 없음 |