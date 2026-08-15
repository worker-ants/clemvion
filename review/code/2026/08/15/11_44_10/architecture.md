STATUS=success

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (2026-08-15 11:44, 6번째 라운드)

## 리뷰 범위 및 방법

프롬프트 diff 는 크기 제한으로 대부분 생략(`... 프롬프트 크기 제한으로 diff 생략 ...`)돼 있어, `git diff origin/main -- <path>`/`git log --format`/`Read`/`grep -n` 으로 저장소를 직접 열어 대조했다.

- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규 공용 헬퍼) — 전체 diff 확인
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — 전체 diff 확인 (16 emit 경로)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — 전체 diff 확인
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, `types.ts` — 프롬프트 diff 확인
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` — 교차 확인용(diff 없음, `emitExecution` 시그니처 확인)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `plan/in-progress/eia-terminal-payload.md` — 백로그 등재 여부 교차 확인
- 이번 라운드는 이미 5차례 리뷰(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`→`11_09_44`→`11_29_02`)를 거친 PR 이다. 직전 architecture 라운드(`11_29_02`)의 산출물을 먼저 읽고, 그 이후 커밋(`f5c609aa8`, delta: `CHANGELOG.md`/`execution-engine.service.spec.ts`/`execution-engine.service.ts`/`terminal-duration.ts`)이 구조적으로 무엇을 바꿨는지만 재검증하는 방식으로 진행했다 — 이미 근거와 함께 보류된 항목을 반복 제기하지 않기 위함이다.

## 발견사항

- **[WARNING]** 종결 이벤트 emit 에 "payload 조립을 강제하는 초크포인트"가 여전히 없다 — 직전 라운드(`11_29_02`)가 지적한 구조적 리스크가 이번 delta 에서도 해소되지 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` 함수 `emitExecution` (`payload: unknown` 파라미터). 호출부는 `execution-engine.service.ts`·`retry-turn.service.ts` 도합 16곳(`grep -n "emitCancellationEvent\|EXECUTION_COMPLETED\|EXECUTION_FAILED" 로 확인).
  - 상세: `ExecutionEventEmitter` 는 전송(라우팅) 관심사만 단일 진입점으로 분리했을 뿐, 종결 이벤트의 `{status, durationMs, error?}` 형태는 타입으로 강제되지 않는다. 이 PR 자신이 그 대가를 실측으로 치렀다 — `09_58_24` RESOLUTION W2("헬퍼는 있는데 형제 4곳이 맨손"), `10_18_38` RESOLUTION W1("grep 한 줄이 멀티라인을 놓쳐 9곳 중 3곳 누락"), `11_09_44`("SQL 경로만 클램프하고 JS 경로는 누락"), `11_29_02` W5("mock 이 RETURNING 경로를 안 태워 단언이 vacuous") 가 전부 같은 근본 원인(필드 하나를 N곳에 손으로 스레딩 + 컴파일러/런타임 가드 부재)의 다른 증상이다. 6라운드에 걸쳐 같은 클래스의 결함이 계속 재발한 사실 자체가, 이 아키텍처 결함이 실증됐음을 보여준다.
  - **백로그 등재 여부 확인 결과**: `11_29_02` RESOLUTION 은 이 항목을 "별건 등재됨(emit 경계 타입화)" 이라 적었으나, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`·`plan/in-progress/eia-terminal-payload.md` 를 포함해 `plan/in-progress/*.md` 전체를 `durationMs`/`emitTerminalExecutionEvent`/`파사드`/`초크포인트` 키워드로 훑었으나 이 항목(emit payload 타입 파사드)을 다루는 체크박스를 찾지 못했다. (해당 두 파일에 등재된 것은 `retry-turn DB↔emit 드리프트`·`REST 비대칭`·`SQL 값 미검증` 등 **다른** 항목들이다.) 확정적으로 "등재 안 됨"이라 단정하기보다, **등재 위치를 재확인/명시할 필요가 있다**는 수준으로 기재한다 — 추적이 실제로 안 됐다면 다음에 종결 이벤트 필드가 하나 더 추가될 때 같은 실패 모드가 아무 안전망 없이 재발한다.
  - 제안: 종결 3종 전용 `emitTerminalExecutionEvent(executionId, type, {status, durationMs, error?})` 같은 좁은 타입 파사드 도입(이전 라운드 제안 유지). 이번 PR 범위를 넘는 리팩터이나, 백로그 문서(`spec-sync-external-interaction-api-gaps.md` 또는 신규 plan)에 **명시적으로** 체크박스로 등재해 둘 것을 권장.

- **[INFO]** (확인) `PG_INT4_MAX` JSDoc 고아 상태 — 이번 delta(`f5c609aa8`)에서 해소됨을 재확인.
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:1-11`(상수+JSDoc), `:13-33`(`resolveTerminalDurationMs` 고유 JSDoc)
  - 상세: 직전 커밋이 `PG_INT4_MAX` 를 `resolveTerminalDurationMs` 바로 앞에 삽입하며 함수 JSDoc 이 어느 선언에도 안 붙던 상태(`11_29_02` W3)를, 이번 delta 가 상수 블록을 파일 최상단으로, 함수 JSDoc 을 함수 바로 위로 재배치해 정정했다. 순수 문서 재배치이며 구조 변경은 없다.
  - 제안: 없음(해소 확인).

- **[INFO]** (확인) `driveCallStackResume` 가 형제 completed 경로와 다른 방어를 쓰던 비대칭 — 이전 라운드(`10_18_38` side_effect WARNING) 지적이 이후 커밋에서 해소됨을 이번에도 재확인.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 함수 `driveCallStackResume` (계산부 `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;`, emit 부 `durationMs: resolveTerminalDurationMs(savedExecution)`)
  - 제안: 없음(해소 확인, 재론 불필요).

- **[INFO]** (변경 없음, 재확인만) `TERMINAL_DURATION_MS_SQL`(SQL) 과 `resolveTerminalDurationMs`(JS) 가 같은 비즈니스 규칙(음수→`null`, int4 상한 클램프)을 두 언어로 독립 구현한다.
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` `resolveTerminalDurationMs` / `TERMINAL_DURATION_MS_SQL`
  - 상세: 엔티티 로드 경로(Node)와 raw UPDATE 경로(Postgres)가 실행 환경이 달라 완전한 코드 공유는 불가능하다는 제약은 합리적이고, `PG_INT4_MAX` 공유 상수 + `terminal-duration.spec.ts` 의 문자열 교차검증으로 drift 를 어느 정도 잡는다. 다만 이는 이미 `09_58_24`/`10_34_51`(W7·W10)로 등재된 "값 수준 e2e 부재" 갭과 동일 계열이며, 이번 delta 로 변경되지 않았다.
  - 제안: 추가 조치 불필요(이미 별도 트랙에서 추적 중).

- **[INFO]** (변경 없음, 재확인만) `finalizeGuarded`(retry-turn) 의 CANCELLED 분기 — DB 는 `COALESCE(duration_ms, :new)` 로 `stop()` 이 커밋한 값(T1)을 보존하지만, in-memory `execution.durationMs` 는 갱신되지 않아 재진입 시 emit 이 다른 값(T2)을 실을 수 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 함수 `finalizeGuarded`(CANCELLED 분기), 및 `completeRetryExecution`/`failRetryExecution` 이 `resolveTerminalDurationMs(execution)` 을 재호출하는 emit 부
  - 상세: 이는 이 PR 이 raw UPDATE 5경로에 대해 세운 "DB = wire" 불변식의 유일한 잔여 위반이며, `10_34_51` RESOLUTION W1 + `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-222` 에 근거와 함께 명시적으로 이연됐다(같은 라운드에서 DB write 경로를 또 바꾸면 스코프가 과잉 확장된다는 판단, `10_34_51` W2 가 실제로 그 실패를 겪은 직후라 신뢰할 만한 판단). 이번 delta 는 이 경로를 건드리지 않았다 — 새 리스크 아님, 기존 이연 상태 유지.
  - 제안: 추가 조치 불필요(이미 근거 있는 이연, 재론하지 않음).

## 긍정적으로 평가한 부분

- **SRP/DRY**: `terminal-duration.ts` 가 "종결 duration 을 어떻게 결정하는가" 라는 단일 관심사에 집중하고, 직전 PR 의 `terminal-error-payload.ts` 선례를 그대로 따른다.
- **ISP**: `resolveTerminalDurationMs(row: {durationMs?, startedAt?, finishedAt?})` 가 구조적 타입으로 최소 요구만 받아 `savedExecution`/`reloaded`/`row` 등 다양한 엔티티 형태에 재사용된다.
- **레이어 경계 유지**: `chat-channel.dispatcher.ts` 는 캐스팅 타입만 넓혔을 뿐(presentation 경계와 도메인 계산이 섞이지 않음), `EiaCompletedEvent` 등의 인터페이스는 "producer 는 항상 채우지만 consumer 계약은 optional 유지" 라는 LSP 상 합리적인 비대칭을 의도적으로 유지한다(레거시 재생 이벤트 흡수).
- **순환 의존성 없음**: `shared/utils/terminal-duration.ts` 는 리프 유틸이며 `modules/execution-engine/*` 에서만 단방향 참조(`grep -rln terminal-duration codebase/backend/src` 로 재확인, `chat-channel` 은 참조하지 않음).
- **부작용 격리**: `startedAt` 부재 시 `.getTime()` 이 throw 해 종결 emit 자체가 사라지던 회귀를 헬퍼 내부에서 `null` 흡수로 방어한 설계(fail-safe 계산, fail-visible 데이터)가 일관되게 유지된다.

## 요약

이번 6번째 라운드의 실제 신규 delta(`f5c609aa8`: JSDoc 재배치, CHANGELOG 문구 확장, 카운트 정정 4→5, mock threading 정정)는 전부 문서·테스트 정밀도 교정이며 구조를 바꾸지 않는다. 아키텍처 관점의 핵심 리스크는 5차 라운드(`11_29_02`)가 지적한 것과 동일하게 유지된다 — 종결 이벤트 payload 조립에 컴파일러가 강제하는 단일 초크포인트가 없어(`emitExecution(payload: unknown)`), 필드 하나를 16개 호출부에 손으로 스레딩해야 했고 그 대가로 이 PR 자체가 여섯 라운드에 걸쳐 같은 클래스의 결함(형제 경로 누락·grep 미검출·JS/SQL 비대칭 클램프·vacuous mock)을 반복해서 냈다. 이 WARNING 은 새 회귀가 아니라 기존 emit 아키텍처의 구조적 한계이고, 다음에 종결 이벤트에 필드가 하나 더 추가되면 같은 실패 모드가 다시 나타날 가능성이 높다 — 다만 그 백로그 등재 위치를 이번에 재확인하지 못했다는 점은 짚어 둔다. `finalizeGuarded` 의 DB↔emit 드리프트도 동일 계열의 잔여 이슈이나 이미 근거와 함께 이연된 상태로, 이번 delta 가 만든 새 문제는 아니다. 나머지(raw RETURNING 5중 반복, 타입 주석 3중 복제, JS/SQL 이중 구현)는 모두 이전 라운드에서 INFO 로 근거와 함께 보류됐고 이번에도 변경이 없다. 신규 CRITICAL/차단 사유 없음.

## 위험도

MEDIUM
