# 보안(Security) 코드 리뷰 — retry_last_turn 2차 claim 삽입 위치 결함 수정

리뷰 대상: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`,
`codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
(HEAD `414550a1d` — 직전 커밋 `b351731f0` 이 도입한 원자 claim 의 삽입 위치 결함
2건(CRITICAL #1/#2, `review/code/2026/07/28/20_32_57`)을 수정한 커밋)

## 발견사항

- **[INFO]** 인젝션 취약점 없음 — JSONB raw-SQL 조각(`output_data - '...'`,
  `jsonb_exists(...)`)에 보간되는 값은 전부 파일 상단에서 정의한 컴파일타임
  상수 `RETRY_STATE_KEY`(`'_retryState'`) 하나뿐이고, 사용자 입력에서 유래하는
  `nodeExecutionId`/`spawnedNodeExecutionId`/`status` 등은 전부 TypeORM
  바인드 파라미터(`:id`, `:running`, `:status`)로 전달된다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:42` (상수 정의), `:210`,`:217` (`retryLastTurn` 의 raw SQL), `:526`,`:531` (`claimSpawnedRetryRow` 의 raw SQL)
  - 상세: 문자열 보간이 있는 4곳 전부 확인했으며 사용자 제어 가능한 변수가 SQL 문자열에 직접 삽입되는 경로는 없다. 상수화(W3, 이 커밋에서 도입)는 "한쪽만 리네임되면 조용히 drift" 문제를 막기 위한 것이지만, 부수적으로 "미래에 이 리터럴이 동적 키로 바뀌면 인젝션 벡터가 된다"는 재발 방지 관점에서도 유효한 안전장치다.
  - 제안: 없음 (양호). 다만 향후 이 상수를 동적 값으로 바꾸는 변경이 생기면 반드시 파라미터 바인딩으로 전환해야 한다는 점을 상수 docstring에 한 줄 명시해두면 후속 회귀를 예방할 수 있다.

- **[INFO]** 인증/인가는 이 파일 밖(WS gateway)에서 이미 강제되고 있음을 교차 확인 — `retryLastTurn`/`applyRetryLastTurn` 은 자신에게 주어진 `executionId`/`nodeExecutionId` 가 서로 정합한지(소속 확인)만 검증하고, 호출자가 해당 workspace/사용자에 속하는지는 검증하지 않는다. 리뷰 대상 파일만 보면 권한 검증 누락처럼 보일 수 있어 실제 호출부를 확인했다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:806` (`getCommandAuthContext` 인증), `:826` (`verifyExecutionOwnership` 로 IDOR/소유권 가드) — `execution.retry_last_turn` 핸들러가 `retryTurnService.retryLastTurn` 호출 **이전에** 두 가드를 모두 통과시킨다. `applyRetryLastTurn` 은 그 뒤 서버가 자체 발행한 BullMQ job(`continuation-execution.processor.ts:146`)으로만 트리거되므로 외부 입력이 재차 노출되지 않는다.
  - 상세: 참고용 확인 사항이며 리뷰 대상 2개 파일 자체의 결함은 아니다. `NOT_FOUND` 로 통일해 존재 여부 추론(enumeration)을 막는 방식(same code for "없음" vs "권한 없음")도 이미 적용돼 있어 양호하다.
  - 제안: 없음.

- **[INFO]** 동시성 결함(레이스 컨디션) 수정 검증 — 이번 커밋이 되돌리는 CRITICAL #1/#2 는 순수 동시성 버그이지만, 커밋 메시지가 명시하듯 실제 위험은 "중복 LLM 과금·downstream 도구(Cafe24/MakeShop/MCP) 중복 실행"이라는 **중복 실행(TOCTOU, CWE-362/CWE-841 계열)** 문제라 보안 관점에서도 유효한 점검 대상이다. 코드 추적으로 두 수정이 올바르게 적용됐음을 확인했다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:364`-`376` (원자 claim 이 "손상 판정"보다 먼저 실행되도록 재배치 — CRITICAL #1), `:396` (`delete spawnedRow.inputData[RETRY_STATE_KEY]` — claim 성공 직후 in-memory 를 DB 와 동기화해 이후의 모든 `save(spawnedRow)` 가 TypeORM jsonb-diff 로 이미 지워진 키를 부활시키지 못하게 차단 — CRITICAL #2), `:520`-`534` (`claimSpawnedRetryRow` 원자 UPDATE, `status='running' AND jsonb_exists(...)` 이중 조건)
  - 상세: (1) claim(원자 UPDATE)이 side-effect 유발 로직(LLM 재호출·downstream graph 진행) 이전에, 그리고 "부재 → 손상" 판정보다 먼저 실행되도록 배치돼 두 delivery 가 동시에 통과하는 창이 제거됐다. (2) claim 성공 후 execution/node not-found 분기에서 stale in-memory 엔티티로 `save()` 하더라도 `_retryState` 가 이미 in-memory 에서도 삭제돼 있어 부활하지 않는다. `retry-turn.service.spec.ts` 에는 이 정확한 재현 시나리오(claim 성공 후 try 진입 전 구간에서 예외 → BullMQ 재배달 → fresh 조회가 이미 지워진 값을 관측 → claim 재실패로 안전 discard)를 그대로 흉내 낸 회귀 테스트가 추가돼 있다(`retry-turn.service.spec.ts:471`-`509` 부근, "claim 성공 후 try 진입 전 구간에서 예외가 나면 FAILED 로 마킹하지 않고 그대로 throw 한다").
  - 제안: 없음 (수정이 올바르게 적용됨을 확인).

- **[INFO]** 에러 메시지의 정보 노출 — `failRetryExecution` 이 임의의 downstream 예외(`processAiResumeTurn`/`resumeGraphAfterRetry` 내부에서 던져진 어떤 에러든) 의 `.message` 를 그대로 `execution.error` 에 저장(REST `GET /executions/:id` 로 노출)하고 `EXECUTION_FAILED` WS 이벤트로도 그대로 emit 한다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:908` (`const errMessage = error instanceof Error ? error.message : String(error);`), `:915` (`execution.error = { message: errMessage }`), `:934`-`943` (WS emit 의 `error: errMessage`)
  - 상세: 원론적으로는 downstream 라이브러리(LLM SDK, HTTP 클라이언트 등)가 던지는 예외 메시지에 내부 URL·요청 세부정보 등이 포함될 경우 노출 경로가 될 수 있다. 다만 이 패턴은 이번 커밋이 새로 도입한 것이 아니라 클래스 docstring 이 명시하듯 추출 전 코드 그대로이며, 동일 저장소의 일반 노드 실패 처리 경로인 `execution-engine.service.ts` 의 `finalizeFailedExecution`(약 `:4751`,`:4761`,`:4794`)와 정확히 같은 패턴이다 — 즉 이 프로젝트 전역에서 "워크플로 소유자에게 자신의 실행 실패 사유를 보여준다"는 의도된 설계이고 (SSRF 에러 일반화 #814와는 별개 트러스트 바운더리 — 소유자 자신의 실행이므로 cross-tenant 노출이 아니다), CANCELLED 분기는 이미 `error` 필드 자체를 제외하도록 별도로 처리돼 있다(`:936`-`941`, W16). 이번 diff 의 신규 결함은 아니다.
  - 제안: 이번 PR 범위 밖. 필요하면 별도 후속으로 "downstream 예외가 실제로 민감정보(예: 요청 헤더·토큰이 포함된 SDK 에러)를 담아 전파하는 사례가 있는지" 를 별도 감사 항목으로 등재할 것을 권장(현재 코드 자체에 대한 조치 요구 아님).

- **[INFO]** 알려진 잔여 갭 — 크래시 직후 재배달 극단 케이스에서 claim discard 후 spawn 된 row 가 RUNNING 상태로 영구 orphan 잔류할 수 있음(백스톱 부재). 코드 자체가 이 갭을 상세히 문서화했고 `plan/in-progress/retry-turn-terminal-guard.md` 항목 #15(P2)로 이미 추적 중이다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:502`-`513` (`claimSpawnedRetryRow` JSDoc의 "알려진 백스톱 갭" 단락)
  - 상세: 익스플로잇 가능한 취약점이라기보다 타임라인/진행률 집계 오염에 가까운 가용성/무결성 이슈이며, "한 번도 seed 안 된 진짜 corruption"은 `retryLastTurn` 이 항상 `_retryState` 를 seed 하므로 구조적으로 발생하지 않는다고 코드가 논증한다. 공격자가 임의로 반복 유발할 수 있는 표면이 아니다(내부 transient 장애 + 재배달 타이밍이 전제).
  - 제안: 별도 조치 불요 — 기존 plan 추적으로 충분.

- **[INFO]** 하드코딩된 시크릿·안전하지 않은 암호화·경로 탐색·XSS·LDAP 인젝션 등 나머지 점검 관점에서는 해당 사항 없음. 두 파일 모두 신규 서드파티 의존성을 도입하지 않았다.

## 요약

이번 변경은 `applyRetryLastTurn` 재진입 가드의 삽입 위치 결함 2건(원자 claim이 "손상 판정"보다 뒤에 있어 살아있는 delivery를 FAILED로 오판·킬하던 CRITICAL #1, claim 성공 후 stale in-memory `save()`가 TypeORM jsonb-diff로 이미 소비된 `_retryState`를 부활시키던 CRITICAL #2)를 수정한 것으로, 두 수정 모두 코드 추적 결과 올바르게 적용되어 있음을 확인했다. 이 결함들은 실질적으로 중복 배달 시 중복 LLM 과금·downstream 연동(Cafe24/MakeShop/MCP) 중복 실행으로 이어질 수 있는 레이스 컨디션(TOCTOU) 클래스였고, 이번 수정으로 원자 claim이 판정·부작용 로직보다 먼저 실행되도록 순서가 교정되어 그 위험이 해소됐다. SQL 인젝션(보간 값은 전부 상수 또는 바인드 파라미터), 하드코딩된 시크릿, 인증/인가(WS gateway 단에서 별도로 강제 확인됨) 측면에서는 새로운 결함을 발견하지 못했다. `failRetryExecution`의 원시 예외 메시지 노출은 저장소 전역에서 일관되게 쓰이는 기존 설계(워크플로 소유자 자신에게 실패 사유를 보여주는 의도된 트러스트 바운더리)이며 이번 diff가 새로 도입한 것이 아니어서 정보성으로만 기록한다. 문서화된 잔여 백스톱 갭(orphan RUNNING row)은 이미 P2로 추적 중이며 공격자가 임의로 유발 가능한 표면이 아니다.

## 위험도

LOW
