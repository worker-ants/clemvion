# 유지보수성(Maintainability) Review — retry_last_turn 재진입 DB 가드 (12차 라운드, JSDoc 대칭 정정 후)

대상: `engine-driver.interface.ts`, `retry-turn.service.ts`, `state/state-machine.ts`
(execution-engine 모듈, `execution.retry_last_turn` 재진입 짝 전이 DB 가드 — 11R "가이드
목록 파손 + JSDoc 비대칭 정정" 이후 재점검).

이번 라운드의 실제 diff는 `engine-driver.interface.ts` 의 `updateExecutionStatus` 에 `@param
opts.allowRetryReentry` JSDoc 8줄을 추가한 것뿐이다(형제 메서드 `tryLockActiveExecutionAndSaveNodeExec`
와의 문서 비대칭 정정, 동작 로직 무변경). 아래 발견사항은 그 변경 자체와, 함께 제공된 3개 파일
전체의 현재 상태를 유지보수성 8개 관점에서 재점검한 결과다.

## 발견사항

- **[WARNING]** `opts.allowRetryReentry` 계약이 이제 타입 shape 뿐 아니라 JSDoc 산문까지 같은 파일 안에서 두 번 손 복제됨
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:76-82`(`CoreEngineDriver.updateExecutionStatus` 신규 JSDoc 문단), `:88`(같은 메서드의 `opts?: { allowRetryReentry?: boolean }` 타입) / `:216-222`(`AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec` 기존 JSDoc 문단), `:226`(같은 메서드의 동일 타입)
  - 상세: 이번 라운드가 추가한 문단(76-82행 — "상태머신 opt-in 과 DB 가드 양쪽에 함께 적용돼야 하고 하나만 반영하면 전이가 항상 0행으로 막힌다")은 `tryLockActiveExecutionAndSaveNodeExec` 의 기존 문단(216-222행)이 서술하는 것과 사실상 동일한 계약을 거의 같은 문장 구조로 다시 풀어쓴 것이다. 인라인 타입 `{ allowRetryReentry?: boolean }` 자체도 두 메서드에 각각 독립 선언돼 있다 — 이 구조적 중복은 이미 `plan/in-progress/retry-turn-terminal-guard.md` #22(P3)로 추적되고 있고, 4-파일 재배선이 새 리뷰 표면을 여는 비용 때문에 11R 에서 의도적으로 defer 됐다. 이번 diff 는 그 타입 중복 위에 "설명 산문" 중복까지 한 겹 더 쌓은 셈이다. 이 계약(DB 가드 opt-in 은 상태머신 opt-in 과 **반드시 함께** 적용돼야 한다는 것)이 바뀔 때 두 JSDoc 블록 중 하나만 갱신되고 나머지가 stale 로 남는 사고는, 바로 이 브랜치가 8R·10R 두 라운드에 걸쳐 실제로 겪은 "일부 소비처만 갱신되고 나머지는 누락" 결함 클래스와 같은 모양이다.
  - 제안: 두 문단이 설명하는 불변식을 인터페이스 상단(이미 `CoreEngineDriver` 위에 파일 전체 docstring 이 있다) 또는 `ReentryStateDriver` 근처에 1곳으로 옮기고, 각 메서드 JSDoc 은 `@param opts.allowRetryReentry` 뒤에 그 위치를 가리키는 참조 + 메서드 고유의 한 줄 차이만 남긴다. 타입도 plan #22 의 권고대로 이름 있는 옵션 타입(`TransitionOptions` 재사용 또는 신설 `RetryReentryOptions`)으로 통일하는 편이 근본적이다.

- **[WARNING]** `applyRetryLastTurn` 이 여전히 8가지 이상의 책임을 한 메서드에 담고 있음 (기존 추적, 이번 라운드도 미해소)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:288-483`
  - 상세: not-found 가드 → 멱등 fast-path 체크 → 원자 claim(`claimSpawnedRetryRow`) → (이론상 도달 불가능한) 방어적 invariant 체크 → in-memory 동기화(`delete`) → execution/node 병렬 조회 + 각 실패 시 FAILED 마킹 → context rehydrate → `_resumeState` 구성 + cache seed → `NODE_STARTED` emit → turn 처리 위임(`processAiResumeTurn`) → 그래프 재개/실패 처리(try/catch/finally)까지 약 196행 한 메서드 안에 몰려 있다. `review/code/2026/07/30/16_42_36/maintainability.md` 가 이미 WARNING 으로 지적했고 `plan/in-progress/retry-turn-terminal-guard.md` #19 로 추적 중이나 이번 라운드(JSDoc 전용 diff)까지도 손대지 않았다. 같은 파일이 `claimSpawnedRetryRow`/`buildRetryReentryState` 를 이미 SRP 목적으로 분리한 선례가 있고 메서드 자신도 "본 메서드는 orchestration … 만 담당" 이라 서술하는 것과는 다소 어긋난다.
  - 제안: "fast-path 확인 → 원자 claim → 방어 체크 → in-memory sync" 구간(약 301-369행)을 `private async claimAndLoadRetryState(spawnedRow): Promise<RetryState | null>` 류 헬퍼로 추출하면 본체 길이가 줄고 orchestration 만 남는다는 자체 서술과도 합치된다. 즉시 조치가 아니어도 다음 정리 라운드 후보로 계속 남겨둘 것.

- **[INFO]** "not found → 스폰 row FAILED 마킹" 블록이 두 번 손 복제됨
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:377-388`(execution not found), `:389-400`(node not found)
  - 상세: 두 블록은 `spawnedRow.status = FAILED` 대입 → `error.message` 설정 → `finishedAt` 대입 → `logger.error` → `save()` → `return` 순서·구조가 완전히 동일하고, 엔티티 이름과 메시지 문자열만 다르다. "zombie row 방지" 절차에 필드가 하나 추가되면(예: 별도 메트릭 기록) 두 블록을 손으로 함께 고쳐야 한다.
  - 제안: `private async markSpawnedRowFailedAndDiscard(spawnedRow: NodeExecution, reason: string): Promise<void>` 헬퍼로 통합해 두 호출부가 사유 문자열만 다르게 넘기도록 정리.

- **[INFO]** `retryLastTurn` 과 `applyRetryLastTurn` 사이에 "JSDoc 절차 번호 ↔ 인라인 주석" 대응 스타일이 갈림
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:108-114`(`retryLastTurn` JSDoc 6단계 목록)과 인라인 `:137,143,155,162,179,202`(`// 1.`~`// 6.` 로 정확히 1:1 대응) 대 `:265-286`(`applyRetryLastTurn` JSDoc "재진입 절차" 8단계 목록)과 인라인 `:301`("fast path —"), `:322`("ATOMIC CLAIM —"), `:402`("ExecutionContext —") 등 번호 없는 산문 레이블
  - 상세: `retryLastTurn` 은 JSDoc 의 번호 매긴 절차와 본문 주석 번호가 정확히 일치해 "지금 이 줄이 JSDoc 몇 번 단계인지" 를 즉시 알 수 있다. 바로 아래 `applyRetryLastTurn` 은 JSDoc 에 동일 형식의 8단계 목록을 두고도 본문 주석은 번호 없이 설명적 레이블만 써서, 같은 파일·같은 클래스의 두 형제 public 메서드 사이에 문서화 관례가 갈린다.
  - 제안: `applyRetryLastTurn` 본문 주석 앞에도 매칭되는 JSDoc 단계 번호(예: `// 3. ExecutionContext 확보 —`)를 붙여 `retryLastTurn` 과 동일한 탐색 경험을 맞출 것.

- **[INFO]** `canTransition` 의 retry 재진입 예외가 파일 내 다른 관용구와 스타일이 다름 (기존 추적, 미해소)
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:72-77`(`||` 로 나열된 개별 `===` 비교) 대 `:82`(`allowed.includes(to)`)
  - 상세: `ALLOWED_TRANSITIONS` 표는 배열 `.includes()` 로 조회하는데, 바로 위 retry 재진입 예외 분기는 `to === RUNNING || to === WAITING_FOR_INPUT` 형태의 개별 비교 나열이다. `review/code/2026/07/30/16_42_36/maintainability.md` 가 이미 INFO 로 지적했고 이번 라운드까지 변화 없다. 허용 대상이 1개(RUNNING)에서 2개(RUNNING, WAITING_FOR_INPUT)로 늘어난 것이 바로 이 스타일 차이가 처음 드러난 지점이라, 세 번째 대상이 추가되면 `||` 체인이 더 읽기 어려워진다.
  - 제안: `const RETRY_REENTRY_TARGETS: string[] = [ExecutionStatus.RUNNING, ExecutionStatus.WAITING_FOR_INPUT];` 를 선언해 `RETRY_REENTRY_TARGETS.includes(to)` 로 파일 내 관용구를 통일.

## 요약

이번 라운드의 실제 diff(`engine-driver.interface.ts` 의 `updateExecutionStatus` JSDoc 8줄 추가)는
형제 메서드와의 문서 비대칭을 없애려는 목적에 부합하는 안전한 문서 전용 변경이며, 동작 로직에는
영향이 없다. 다만 그 문단이 형제 메서드의 기존 설명을 거의 그대로 복제해, 이미 plan 에 P3 로
추적·의도적 defer 된 "opts shape 다중 선언" 구조적 위험(이 브랜치에서 8R·10R 두 차례 실제
CRITICAL 을 유발한 이력이 있음) 위에 문서 중복까지 한 겹 더 얹었다. 3개 파일 전반의 가독성·
네이밍·중첩 깊이·매직 넘버는 양호하고(신규 매직 넘버 없음, `RETRY_STATE_KEY` 상수화 등 기존 DRY
도 그대로 유지됨), `state-machine.ts` 는 짧고 명확하며 새로 추가된 JSDoc 도 파일 기존 컨벤션(
`@param opts.<subfield>` 서브프로퍼티 문서화 스타일)과 일관된다. 남은 항목(`applyRetryLastTurn`
함수 길이, not-found 블록 중복, 절차 번호-주석 대응 비대칭, `canTransition` 스타일 불일치)은
전부 이미 최소 한 차례 이전 라운드에서 식별돼 plan 에 추적 중이거나(함수 길이, style) 이번에
새로 관측한 소규모 중복이며, 현재 동작을 바꾸거나 병합을 막을 정도의 문제는 아니다.

## 위험도
LOW
