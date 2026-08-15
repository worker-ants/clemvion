# 아키텍처(Architecture) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론 노트

프롬프트 번들에서 `execution-engine.service.ts`/`execution-engine.service.spec.ts` 의 unified diff 가 크기 제한으로 생략되어 있어, `git diff <merge-base> HEAD -- <path>` 로 전체 diff 를 직접 받고 `Read`/`Grep` 으로 실제 소스 파일을 열어 대조했다(merge-base=`e3825cc2c`). 아래 위치 표기는 모두 이렇게 확인한 **실제 파일의 현재 줄 번호**다(프롬프트 게이트가 없는 두 파일은 특히 유의해서 실측).

## 발견사항

- **[CRITICAL]** 신규 공용 헬퍼가 스스로 "한 곳에서 결정한다" 고 선언한 불변식(int4 상한 saturate)을 **정작 그 결정이 실제로 쓰이는 절반의 경로에서 지키지 않는다** — SQL 쌍둥이만 클램프됐고 JS 쌍둥이는 안 됐는데, 둘 다 같은 `duration_ms INTEGER` 컬럼에 쓴다.
  - 위치(핵심 비대칭): `codebase/backend/src/shared/utils/terminal-duration.ts:28-42`(`resolveTerminalDurationMs` — 클램프 없음) vs `:74-79`,`:87-90`(`TERMINAL_DURATION_MS_SQL` — `LEAST(2147483647, …)` 클램프 있음)
  - 위치(불변식이 깨진 채 값이 쓰이는 대입 지점, 전부 미클램프):
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2413,2577,3564,4294,4754,4882,4943`
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:714,896,949`
  - 위치(이 값이 실제로 int4 컬럼에 영속되는 자리, PR 이 건드리지 않은 기존 코드):
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8617` (`updateExecutionStatus` 의 guarded raw UPDATE — `duration_ms = $5` 로 `execution.durationMs ?? null` 을 그대로 바인딩). `retry-turn.service.ts` 의 3개 대입 지점은 `this.driver.updateExecutionStatus(...)` 로 위임되므로(`retry-turn.service.ts:674,897`) 동일한 컬럼·동일한 쓰기 경로를 탄다.
  - 상세: 이 PR 은 정확히 같은 클래스의 버그(`duration_ms` int4 상한 초과 → `::int` 캐스팅 실패 → UPDATE 문 전체 실패 → catch 가 삼킴 → 실행 영구 고착)를 **엔티티를 로드하지 않는 5경로**에 대해 CRITICAL 로 다루고 고쳤다(SQL 상수에 `LEAST(2147483647, …)`). 그런데 같은 컬럼에 쓰는 **엔티티 로드 경로**(완료/실패/취소 처리 함수들이 `resolveTerminalDurationMs(entity) ?? entity.durationMs` 로 계산해 엔티티에 얹고, `updateExecutionStatus`(else 분기, `:8617`)의 guarded raw UPDATE 로 영속하는 경로)는 **동일한 위험을 그대로 안고 있다**. `resolveTerminalDurationMs` 는 음수(시계 역행)만 `null` 로 막을 뿐 상한 클램프가 전혀 없다.
    이게 이론적 엣지케이스가 아닌 이유: `startedAt` 은 엔티티 생성 시 DB `default NOW()` 로 1회만 세팅되고(`codebase/backend/src/modules/executions/entities/execution.entity.ts:56-57`) 이 두 파일 어디에서도 재대입되지 않는다(`grep -n "\.startedAt\s*="` 0건) — 즉 park→resume 이 여러 번 반복돼도 `finishedAt - startedAt` 은 **실행 생성 이후 전체 wall-clock** 이다. 그리고 시간 기반 강제 취소(리퍼)는 웹챗 채널 idle-wait 전용 `webchat-idle-reaper.service.ts` 하나뿐이다 — 폼/버튼/AI 에이전트 턴 대기 등 다른 채널의 `WAITING_FOR_INPUT` 은 사용자가 응답할 때까지 시간 상한이 전혀 없다. 그런 실행이 24.8일을 넘겨 대기하다 사용자가 응답해 **정상 완료**하면, 완료 경로가 `resolveTerminalDurationMs` 로 계산한 미클램프 값을 그대로 `updateExecutionStatus` 에 넘기고 `:8617` 의 raw UPDATE 가 int4 상한을 넘는 값을 바인딩하며 실패한다 — 이 PR 이 스스로 CRITICAL 로 규정한 "값이 부정확한 것보다 훨씬 나쁜" 실패(완료/실패 마킹 자체가 사라지고 실행이 그 상태에 영구 고착)가 **고쳤다고 믿은 바로 그 헬퍼를 통해** 다른 절반의 경로에서 재발한다.
    이전 라운드(`review/code/2026/08/15/10_34_51/SUMMARY.md` #7)가 "TS 함수와 SQL 상수가 독립 재구현돼 동등성 검증 장치가 문자열 부분일치뿐" 이라고 지적했지만, 그 프레이밍은 **테스트 커버리지 갭**에 머물렀다 — "SQL 쪽만 있는 클램프가 실제로 JS 경로의 쓰기 실패를 막지 못한다" 는, 가용성에 직접 영향을 주는 비대칭 자체는 이번 라운드까지 명시적으로 지적되지 않았다(RESOLUTION.md/plan 문서 어디에도 이 특정 각도 없음 — grep 으로 확인).
  - 제안: `resolveTerminalDurationMs` 에도 동일한 `Math.min(span, 2147483647)` saturate 를 추가한다. 매직 넘버 중복을 피하려면 `2147483647` 을 named export(예: `PG_INT4_MAX`)로 한 번만 선언하고 JS 함수와 SQL 문자열 양쪽이 그 상수를 참조/문서화하게 한다 — 지금은 SQL 문자열 리터럴 안에만 하드코딩돼 있어 JS 쪽에 클램프를 추가하려는 다음 사람도 값을 다시 베껴야 한다.

- **[INFO]** `durationMs` 필드가 종결 경로에 따라 서로 다른 물리적 의미(실행 총 소요시간 vs 큐 대기시간)를 갖도록 오버로드돼 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `markQueueWaitTimeout`(주석: "이 경로의 `durationMs` 는 **큐 대기 시간**이다") / CHANGELOG.md 게이트 12-13행
  - 상세: 같은 wire 필드 이름이 종결 원인에 따라 "무엇을 잰 값인가" 가 바뀐다 — 소비자가 필드명만 보고 일괄 해석하면 오독 가능성이 있다. 다만 이는 실수가 아니라 EIA §6 이 "종결까지의 경과" 로 필드를 정의한 데 따른 의도적 결정이고 CHANGELOG·spec(§6.5)·코드 주석에 명시돼 있어 인터페이스 계약으로서는 문서화된 트레이드오프다.
  - 제안: 조치 불필요(강제 아님). 다음에 이 필드를 만지는 사람이 놓치지 않도록, 별도 `queueWaitMs` 필드 분리는 이미 spec 코멘트에 후속으로 언급돼 있다면 그 트래커를 유지.

- **[INFO]** 클램프 상수가 SQL 문자열 리터럴 안에만 존재하고 모듈 상수로 노출돼 있지 않다.
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:87-90` (`TERMINAL_DURATION_MS_SQL` 안의 `2147483647`)
  - 상세: 위 CRITICAL 항목의 근본 원인 중 하나 — `TERMINAL_FINISHED_AT_PARAM` 처럼 이름 있는 export 가 있었다면 JS/SQL 양쪽이 같은 상수를 참조하도록 강제하기 쉬웠을 것이다. 현재는 `TERMINAL_DURATION_MS_SQL` 을 검증하는 테스트도 `toContain('LEAST(2147483647')` 문자열 부분일치뿐이라, 두 표현이 갈려도 정적으로 잡히지 않는다.
  - 제안: CRITICAL 항목의 수정과 함께 처리 권장.

## 그 외 점검 결과 (문제 없음/기존 결정 확인)

- **순환 의존성**: 없음. `terminal-duration.ts` 는 외부 의존성이 전혀 없는 리프 모듈이고, `execution-engine.service.ts`/`retry-turn.service.ts` 가 단방향으로 import 한다.
- **레이어 책임 / 모듈 경계**: `shared/utils/` 에 Postgres 전용 raw SQL 상수(`TERMINAL_DURATION_MS_SQL`)를 두는 것은 "순수 유틸" 관례를 살짝 벗어나지만, 팀이 이미 이전 라운드에서 W6 으로 인지하고 "엔티티 미로드 경로의 원자성상 SQL 표현이 불가피하다" 는 근거로 수용·문서화했다(`review/code/2026/08/15/10_52_08/RESOLUTION.md` W6). 신규 이슈로 재상정하지 않는다.
- **SRP/인터페이스 분리**: `resolveTerminalDurationMs`(순수 계산)와 `toFiniteNumber`(raw 값 파싱)를 분리한 것, `TERMINAL_DURATION_MS_SQL`/`TERMINAL_FINISHED_AT_PARAM` 을 별도 export 로 둔 것은 책임이 잘 나뉘어 있다. `resolveTerminalDurationMs` 가 `Execution` 엔티티 전체가 아니라 duck-typed `{durationMs?, startedAt?, finishedAt?}` 만 받는 것도 결합도를 낮춘 좋은 선택(테스트 fixture 가 엔티티 전체를 만들 필요 없음).
- **Producer vs consumer 계약 분리**: `chat-channel/types.ts` 세 인터페이스가 `durationMs` 를 여전히 optional(`?: number | null`)로 유지한 판단(주석에 근거 명시 — producer 는 항상 채우지만 consumer 타입은 레거시 재생 이벤트의 키 부재를 반영해야 한다)은 프로듀서·컨슈머 계약을 명확히 분리한 합리적 모델링이다. LSP/ISP 위반 없음.
- **개방-폐쇄**: 3종 종결 이벤트 16개 emit 지점을 전부 수정해야 했다는 점에서 "닫혀 있지 않다" 고 볼 수 있으나, 이는 discriminated union 형태의 고정 payload 모델에서 필드 하나를 추가할 때 본질적으로 불가피한 비용이며, `emitCancellationEvent` 로 취소 계열 4곳을 이미 한 함수로 묶어 놓아 다음 필드 추가 비용은 이번보다 작을 것이다.

## 요약

이번 PR 의 핵심 아키텍처 산출물은 `terminal-duration.ts` 공용 헬퍼로, 16개 종결 emit 경로에 흩어져 있던 `durationMs` 계산·null 처리·SQL 폴백을 한 곳에 모으려는 의도 자체는 타당하고 직전 PR(`error` 필드)의 선례를 잘 따랐다. 다만 그 헬퍼가 스스로 "한 곳에서 결정한다" 고 선언한 불변식(int4 컬럼 상한 saturate)이 실제로는 SQL 쌍둥이(`TERMINAL_DURATION_MS_SQL`)에만 있고 JS 쌍둥이(`resolveTerminalDurationMs`)에는 없다 — 그런데 두 쌍둥이 모두 같은 `duration_ms INTEGER` 컬럼에 쓰인다. `startedAt` 이 실행 생성 시 1회만 세팅되고 폼/버튼/AI 에이전트 대기에는 시간 기반 강제 취소가 없다는 점을 볼 때, 이 PR 이 이미 CRITICAL 로 다루고 "고쳤다" 고 결론 낸 실패 모드(int4 오버플로 → UPDATE 실패 → catch 가 삼킴 → 실행 영구 고착)가 엔티티 로드 경로(정상 완료 8곳 + retry-turn 3곳)에서 그대로 재발할 수 있다. 나머지 구조(레이어 분리, 결합도, producer/consumer 타입 분리, 순환 의존성 없음)는 전반적으로 양호하다.

## 위험도

CRITICAL
