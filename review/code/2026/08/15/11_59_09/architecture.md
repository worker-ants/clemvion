STATUS=success

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (2026-08-15 11:59, 7번째 라운드)

## 리뷰 범위 및 방법

프롬프트 diff 가 크기 제한으로 다수 생략돼 있어(`terminal-duration.ts`/`.spec.ts`, `execution-engine.service.{ts,spec.ts}` 등), `Read`/`Bash(grep, git log, git diff)` 로 저장소를 직접 열어 대조했다. 이 PR 은 이미 6차례 리뷰(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`→`11_09_44`→`11_29_02`→`11_44_10`)를 거쳤으므로, 직전 architecture 라운드(`11_44_10`)의 산출물을 먼저 읽고 그 이후 실제 변경분(커밋 `777698bbe`, delta: `execution-engine.service.spec.ts` mock RETURNING 값 보강·`terminal-duration.{ts,spec.ts}` 4→5 정정·`spec-sync-external-interaction-api-gaps.md` 취소선 서식 수정)만 재검증했다. 근거와 함께 이미 보류된 항목은 반복 제기하지 않되, **"별건으로 등재돼 있다"는 반복된 주장은 이번에 직접 grep 으로 실측했다.**

## 발견사항

- **[WARNING]** 종결 이벤트 emit payload 조립을 강제하는 타입 초크포인트 부재 — 그리고 "별건 등재" 주장이 3차례째 실측되지 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` 함수 `emitExecution`(`payload: unknown` 파라미터, 37번째 줄 부근). 호출부는 `execution-engine.service.ts`·`retry-turn.service.ts` 도합 16곳(`grep -n "durationMs: resolveTerminalDurationMs\|durationMs: () => TERMINAL_DURATION_MS_SQL"`로 재확인).
  - 상세: `ExecutionEventEmitter` 는 전송(라우팅) 관심사만 단일 진입점으로 분리했을 뿐, 종결 이벤트의 `{status, durationMs, error?}` 형태는 타입으로 강제되지 않는다. 이 PR 자신이 그 대가를 실측으로 여러 번 치렀다 — 형제 경로 누락(`09_58_24` W2), grep 이 멀티라인을 못 잡아 9곳 중 3곳 누락(`10_18_38` W1), JS/SQL 클램프 비대칭(`11_09_44` CRITICAL), vacuous mock(`11_29_02` W5, `11_44_10` W1) — 전부 "필드 하나를 16곳에 손으로 스레딩 + 컴파일러/런타임 가드 부재"라는 같은 구조적 원인의 다른 증상이다.
    이번 라운드에 새로 확인한 사실: `11_29_02` RESOLUTION 과 `11_44_10` RESOLUTION 이 연속으로 이 항목을 "별건으로 등재돼 있다(emit 경계 타입화)"라 적었고, 최신 커밋 `777698bbe` 의 커밋 메시지도 같은 문구를 세 번째로 반복한다. 그런데 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 전체(체크리스트 헤더 전수: `durationMs 후속 2건`·`retry-turn 재진입 DB/emit 어긋남`·`duration_ms 대기시간 오염`·`§8.2 HMAC` 등)와 `plan/in-progress/eia-terminal-payload.md`, `plan/in-progress/*.md` 전체를 `초크포인트`/`emit 경계`/`파사드`/`emitTerminalExecutionEvent` 키워드로 훑었으나(`grep -rn`) **어디에도 이 항목을 가리키는 체크박스가 없다.** 유사해 보이는 `retry-turn-terminal-guard.md` 의 "driver choke point 우회"(Warning #2)는 **다른 개념**(멱등 분기의 상태전이 driver 우회)이라 이 항목의 등재로 볼 수 없다.
  - 제안: 종결 3종 전용 `emitTerminalExecutionEvent(executionId, type, {status, durationMs, error?})` 같은 좁은 타입 파사드 도입(이전 라운드 제안 유지, 이번 PR 범위 밖). 그보다 시급한 것은 — **이번에 실제로** `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 체크박스 항목을 만들어 등재할 것. "등재돼 있다"는 서술을 실측 없이 세 번째 반복하는 것 자체가 이 세션의 반복 패턴(유예 근거 미실측)이다.

- **[INFO]** (긍정 평가) 신규 공용 헬퍼 `terminal-duration.ts` 의 설계는 SRP/ISP 를 잘 지킨다.
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts`
  - 상세: "종결 duration 을 어떻게 결정하는가"라는 단일 관심사에 집중하고, `resolveTerminalDurationMs(row: {durationMs?, startedAt?, finishedAt?})`가 구조적 타입으로 최소 요구만 받아 `savedExecution`/`reloaded`/raw `row` 등 다양한 형태에 재사용된다. `shared/utils/` 는 리프 유틸로 `modules/execution-engine/*` 에서만 단방향 참조하며(`grep -rln terminal-duration codebase/backend/src`) 순환 의존성이 없다. `startedAt` 부재 시 throw 대신 `null` 로 흡수하는 fail-safe 계산 설계도 일관되게 유지된다.
  - 제안: 없음(유지 권장).

- **[INFO]** (변경 없음, 재확인) `resolveTerminalDurationMs` 이중 호출 패턴(계산 후 대입 → 몇 줄 뒤 재계산해 emit)이 5개 완료 경로에 반복된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(4곳), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(1곳, `resumeGraphAfterRetry`)
  - 상세: 이미 성능 리뷰(`09_58_24` performance INFO)가 지적했고 실질 비용은 무시할 수준이다. 아키텍처 관점에서는 "값을 한 곳에서 결정한다"는 헬퍼의 설계 의도를 완전히 충족하지 못하고 같은 계산이 두 지점에 흩어져 있다는 정도의 사소한 DRY 잔여이며, 별도 조치가 필요한 수준은 아니다.
  - 제안: 없음(우선순위 낮음, 기록 목적).

- **[INFO]** (변경 없음, 재확인) raw `UPDATE ... RETURNING` 5경로의 SQL 삽입·바인딩·파싱 보일러플레이트가 손으로 반복된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelParkedExecution`/`markWebChatIdleTimeout`/`markQueueWaitTimeout`/`finalizeStalledExhausted` 등 5곳
  - 상세: 순수 계산부(`TERMINAL_DURATION_MS_SQL`)와 상수(`PG_INT4_MAX`, `TERMINAL_FINISHED_AT_PARAM`)는 이미 추출돼 있고, 나머지는 TypeORM QueryBuilder 체인이라 얇은 헬퍼로 감싸면 오히려 호출부 가독성이 떨어진다는 판단(`09_58_24` RESOLUTION W5)이 합리적이다. 6번째 유사 경로가 생기면 재검토할 사안.
  - 제안: 없음(이미 근거와 함께 보류, 재론 불필요).

## 긍정적으로 평가한 부분

- **레이어 경계**: `chat-channel.dispatcher.ts`/`types.ts` 는 캐스팅 타입만 넓혔을 뿐(`number` → `number | null`), presentation 경계와 도메인 계산이 섞이지 않는다. `EiaCompletedEvent` 등의 optional 유지는 "producer 는 항상 채우지만 consumer 계약은 레거시 재생 이벤트를 흡수해야 한다"는 근거가 타입 옆 주석에 명시돼 있어 LSP 상 합리적인 의도된 비대칭이다.
- **DIP/신규 모듈 경계**: `terminal-duration.ts` 가 `execution-engine`/`retry-turn` 양쪽 서비스가 공유하는 순수 함수 레이어로 적절히 분리됐고, DB 컬럼 상한(`PG_INT4_MAX`)이라는 인프라 제약을 단일 상수로 노출해 JS/SQL 두 구현이 drift 하지 않도록 최소한의 계약을 걸어 둔다.
- **확장성**: `resolveTerminalDurationMs` 의 구조적 타입 파라미터는 향후 다른 엔티티 형태(예: 새 종결 경로)에도 재사용 가능하다.

## 요약

이번 7번째 라운드의 실제 신규 delta(`777698bbe`)는 mock RETURNING 값 보강·문서 카운트 정정(4→5)·plan 서식 정정으로, 구조를 바꾸지 않는다. 아키텍처 관점의 핵심 리스크도 5·6차 라운드(`11_29_02`/`11_44_10`)와 동일하게 유지된다 — 종결 이벤트 payload 조립에 컴파일러가 강제하는 단일 초크포인트가 없어(`emitExecution(payload: unknown)`), 16개 호출부에 필드를 손으로 스레딩해야 했고 그 대가로 이 PR 자체가 6라운드 이상 같은 클래스의 결함을 반복해서 냈다. 이번 라운드에서 새로 확인한 것은, 이 구조적 리스크를 "별건으로 등재돼 있다"고 두 차례(그리고 최신 커밋 메시지에서 세 번째로) 반복 주장했지만 `plan/in-progress/**` 전체를 실측한 결과 그 등재가 실제로 존재하지 않는다는 점이다 — 유예 근거를 실측하지 않고 반복 인용하는 패턴이 문서 축에서도 나타났다. 신규 공용 헬퍼(`terminal-duration.ts`)의 SRP/ISP 설계, 레이어 경계 유지, 순환 의존성 부재는 이번에도 양호하게 확인됐다. 신규 CRITICAL/차단 사유는 없다.

## 위험도

MEDIUM
