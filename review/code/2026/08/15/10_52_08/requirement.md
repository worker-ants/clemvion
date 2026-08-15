STATUS=success

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (4차 라운드, `10_52_08`)

## 방법론 노트

프롬프트 번들에서 diff 가 생략된 파일(`execution-engine.service.ts`/`.spec.ts`, `spec-sync-external-interaction-api-gaps.md` 등)은 `Read`/`Grep`으로 저장소 원본을 직접 열어 대조했다. 이 PR 은 이미 세 라운드(`09_58_24`→`10_18_38`→`10_34_51`)의 ai-review + RESOLUTION 을 거쳤고, 그 RESOLUTION.md 들이 스스로 발견·정정한 이력(int4 클램프 CRITICAL, 6곳→9곳 grep 누락, driveCallStackResume 방어 우회 등)을 실제 소스에서 재검증하는 데 집중했다.

- `resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL` 호출부 전수(`grep -n`)를 execution-engine.service.ts·retry-turn.service.ts 양쪽에서 셌다.
- 완료/실패/취소 3종 각 emit 지점(파이썬 정규식으로 `emitExecution(...)` 블록 11개 + `emitCancellationEvent` 헬퍼 1개)에 `durationMs` 가 실제로 포함돼 있는지 전수 확인했다.
- spec §6 표·§6.5·`chat-channel-adapter.md`·`data-flow/3-execution.md` 를 코드와 line-level 대조했다.

## 발견사항

- **[WARNING]** retry-turn 재진입(CANCELLED) 경로에서 emit 값이 DB 영속값과 어긋날 수 있다 — 이 PR 이 CHANGELOG/spec §6.5 에서 표방한 "DB 와 wire 가 같은 값" 불변식의 잔여 예외
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 함수 `finalizeGuarded` 의 `target === ExecutionStatus.CANCELLED` 분기(637~650행, `COALESCE(duration_ms, :newDurationMs)`) + `failRetryExecution` 의 `durationMs: resolveTerminalDurationMs(execution)` emit(964~977행)
  - 상세: `stop()` 이 커밋한 T1 값을 DB 는 `COALESCE`로 보존하는데, 그 직전에 `execution.durationMs = resolveTerminalDurationMs(execution) ?? execution.durationMs;`(948~949행)로 in-memory 필드가 이미 재진입 시각 기준 T2 로 갱신돼 있다. `finalizeGuarded` 가 DB 에는 T1 을 쓰면서도 in-memory `execution` 객체를 되읽어 갱신하지 않으므로, 뒤이은 emit(`resolveTerminalDurationMs(execution)`)은 T2 를 그대로 내보낸다 — **DB=T1, wire=T2** 로 갈린다. 이는 새로 만든 결함이 아니라 이 PR 자신이 3차 라운드(`10_34_51` W1)에서 발견해 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`("retry-turn 재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다")에 근거와 함께 명시적으로 이연한 항목이며, 소스 재확인 결과 여전히 미수정 상태다.
  - 제안: 이연 판단(같은 라운드에서 DB write 경로를 또 바꾸면 과잉 스코프 위험) 자체는 합리적이나, 이 PR 이 "16 경로 전부 완료" 로 선언한 CHANGELOG/plan 체크박스가 이 잔여 예외를 충분히 눈에 띄게 명시하는지 재확인할 것. 코드 수정은 트래커가 이미 제안한 대로 `finalizeGuarded` CANCELLED 분기에 `.returning(['duration_ms'])` 를 추가해 실제 persist 값을 되읽어 emit 전에 갱신하는 방향.

- **[WARNING]** `driveCallStackResume` 완료 경로만 `durationMs` 에 대한 회귀 테스트가 없다 (엣지 케이스 커버리지 공백)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 함수 `driveCallStackResume`(계산부는 `resolveTerminalDurationMs`를 정상적으로 경유하도록 이미 수정되어 있음 — grep 상 2576~2577행) / 테스트는 `execution-engine.service.spec.ts` 의 `describe('driveCallStackResume / driveResumeFrame / injectInvokerOutput (CRITICAL #1)', ...)` 블록(16185행~)
  - 상세: 코드 자체는 형제 5개 완료 경로와 동일하게 `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` → emit 시 재계산 패턴을 따르고 있어 (2차 라운드 `side_effect.md` WARNING이 지적한 "방어 우회"는 3차 라운드에서 실제로 해소됐다), 기능적 결함은 없다. 다만 `driveCallStackResume` 관련 테스트 블록(16185~18925행 부근)을 `grep -n "durationMs"` 로 훑은 결과 durationMs 값 자체를 단언하는 테스트가 0건이다 — 형제 5개 완료 경로(각각 개별 `it`/`it.each` 로 `durationMs: expect.any(Number)` 류 단언 보유, 예: `retry-turn.service.spec.ts` 686~700행 패턴)와 커버리지 수준이 다르다.
  - 제안: `driveCallStackResume` 완료 emit 에 대해서도 `durationMs` 양수·`null`(시계 역행/미계산) 양쪽 케이스를 최소 1개씩 고정하는 테스트를 추가해 이 경로만 회귀 안전망이 얇은 상태를 해소할 것. 우선순위는 낮음(로직 자체는 이미 맞다).

- **[INFO] spec fidelity — 확인 완료, 위반 없음**
  - `spec/5-system/14-external-interaction-api.md` §6 표(575행) · §6.5(801~812행)가 `durationMs` 구현 상태·`null` sentinel·`EXECUTION_QUEUE_WAIT_TIMEOUT` 의 "큐 대기 시간" 의미론을 코드와 line-level 로 정확히 반영한다 (`markQueueWaitTimeout` 주석 2896~2898행과 대조 확인).
  - `spec/conventions/chat-channel-adapter.md` 149~164행이 세 이벤트 타입에 `durationMs?: number | null` 을 추가하고 "2026-08-15 구현" 각주로 stale Planned 서술을 정정했다 — 코드(`types.ts` 세 인터페이스, `dispatcher.ts` 세 캐스팅)와 일치.
  - `TERMINAL_DURATION_MS_SQL` 의 `LEAST(2147483647, …)` 클램프·`CASE WHEN … THEN NULL`(음수 sentinel)이 실제 SQL 상수에 존재하고(`terminal-duration.ts:87-90`), 대응 테스트(`terminal-duration.spec.ts:110-133`)가 문자열 수준으로 고정한다 — 1차 라운드 CRITICAL(int4 오버플로 → 취소 UPDATE 실패 → 영구 고착)이 해소된 상태를 재확인.
  - raw UPDATE 5경로(`cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted`)·완료 6경로·실패 4경로 emit 전수(11개 emitExecution 호출 + `emitCancellationEvent` 헬퍼 1개)에 `durationMs` 필드가 예외 없이 포함됨을 정규식 전수 검사로 확인 — "producer 는 항상 이 키를 싣는다" 는 `types.ts` JSDoc 의 주장이 실제 코드와 일치한다.
  - `plan/in-progress/eia-terminal-payload.md` "재판정 ④" 표(completed 6/failed 3+1/cancelled 2+4 = 16 경로)를 소스 grep 카운트와 대조한 결과 정확히 일치했다.

- **[INFO] 이미 트래커에 등재된 기지 항목 (신규 발견 아님, 재확인만)**
  - REST `GET /api/external/executions/:id` 에 `durationMs` 부재(push/pull 비대칭) — `spec-sync-external-interaction-api-gaps.md` W4, CHANGELOG 에도 고지됨.
  - `TERMINAL_DURATION_MS_SQL` 이 실제 Postgres 값 수준으로 검증된 적이 없음(단위 테스트는 문자열 `toContain` 뿐, 유일한 관련 e2e `webchat-idle-reaper.e2e-spec.ts` 도 `duration_ms` 를 assert 하지 않음을 직접 확인) — W10, 이미 등재.

## 요약

이번 diff(및 그 직전 세 라운드가 만든 누적 수정)는 EIA 종결 이벤트 3종에 `durationMs` 를 채우는 명세를 spec §6/§6.5, `chat-channel-adapter.md`, plan 재판정 표와 line-level 로 정확히 구현했다. 완료 6·실패 4·취소 6 = 16 emit 경로 전수를 직접 grep/코드 추적으로 검증한 결과 `durationMs` 누락은 없고, 1차 라운드가 잡은 int4 오버플로 CRITICAL 은 클램프+테스트로 확실히 해소돼 있다. 남은 두 WARNING 은 모두 이 PR 자신이 이전 라운드에서 발견해 근거와 함께 명시적으로 이연한 잔여 항목이다 — (1) retry-turn CANCELLED 재진입 시 DB/wire `durationMs` 값 불일치(진짜 기능 결함이지만 별도 DB-write 변경이 필요해 트래커 등재), (2) `driveCallStackResume` 완료 경로의 durationMs 엣지케이스 테스트 커버리지 공백(코드는 맞으나 회귀 안전망이 형제 경로보다 얇음). 둘 다 이미 문서화·이연 사유가 있어 이번 라운드에서 신규로 차단할 사안은 아니지만, 다음 편집에서 처리돼야 할 실질 항목으로 재확인한다.

## 위험도

LOW
