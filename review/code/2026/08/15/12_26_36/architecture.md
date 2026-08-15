STATUS=success

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (8번째 라운드)

## 방법론 노트

이 PR 은 이미 7차례 architecture 리뷰(`09_58_24`→`10_34_51`→`10_52_08`→`11_09_44`→`11_29_02`→`11_44_10`→`11_59_09`)를 거쳤다. `git log --oneline` 으로 `11_59_09` 이후 delta 를 확인한 결과, 신규 프로덕션 코드 변경은 없다 — `f79792621`(집계 필터 수정, `11_59_09` W2 로 이미 그 라운드 자체에서 다뤄짐) · `c4e6e8d96`(공백 스타일) · `ef1ed21d7`(RESOLUTION 문서)뿐이다. 따라서 이번 라운드는 (1) 직전 라운드까지의 구조적 판단이 현재 소스에 여전히 유효한지 `Read`/`grep -n` 으로 재확인하고, (2) `11_59_09` 가 "세 번째로 미실측이었다" 며 등재를 요구한 항목이 실제로 등재됐는지 직접 확인하는 데 집중했다. 프롬프트 diff 가 크기 제한으로 다수 생략돼 있어 `terminal-duration.ts`, `execution-engine.service.ts`, `chat-channel/types.ts`, `retry-turn.service.ts`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 는 저장소를 직접 열어 대조했다(아래 위치는 모두 실제 소스 파일의 현재 줄 번호).

## 발견사항

- **[WARNING]** 종결 이벤트 emit payload 조립에 타입 초크포인트가 없다 — 여전히 유효한 구조적 리스크(재확인, 신규 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:37-40`(`emitExecution(executionId, eventType, payload: unknown)`). 호출부는 `execution-engine.service.ts` 5곳(`:2415/2426`, `:2579/2595`, `:3566/3577`, `:4756/4769`, `:4884/4888`, `:4945/4967` — `resolveTerminalDurationMs(savedExecution)` 계열 grep 기준 실제로는 6개 완료 지점) + `retry-turn.service.ts` 3곳(`:714/730`, `:896/907`, `:949/971`) + `emitCancellationEvent`(`:1101-1125`)를 경유하는 취소 계열 5곳.
  - 상세: `ExecutionEventEmitter` 는 전송(라우팅) 관심사만 단일 진입점으로 분리했을 뿐(`payload: unknown`), 종결 이벤트가 항상 `{status, durationMs, error?}` 형태를 갖춰야 한다는 불변식은 컴파일러도 런타임 가드도 강제하지 않는다. 이 PR 자신이 그 대가를 8라운드에 걸쳐 실측으로 치렀다 — 형제 경로 누락(`09_58_24` W2), 한 줄 grep 이 멀티라인을 못 잡아 3곳 누락(`10_18_38` W1), JS/SQL 클램프 비대칭(`11_09_44` CRITICAL), vacuous mock 3연속(`11_29_02` W5·`11_44_10` W1·`11_59_09` W3) — 전부 "필드 하나를 16곳에 손으로 스레딩 + 강제 장치 부재"라는 같은 구조적 원인의 다른 증상이다.
  - **변경점(이번 라운드 확인)**: `11_59_09` architecture 가 지적한 "이 항목을 '별건 등재됨'이라 세 차례 반복 주장했는데 실측하면 등재가 없었다"는 결함은 실제로 해소됐다 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md:227-234`에 `## 종결 이벤트 emit 에 타입 초크포인트가 없다 (2026-08-15 등재, 11_59_09 architecture W1)` 절과 `emitTerminalExecutionEvent(...)` 도입 검토 체크박스가 실재함을 `grep -n` 으로 직접 확인했다. 유예 근거가 이제 실측 가능한 상태다.
  - 제안: 이전 라운드 제안 유지 — 종결 3종 전용 `emitTerminalExecutionEvent(executionId, type, {status, durationMs, error?})` 같은 좁은 타입 파사드. 이번 PR 범위 밖(트래커 등재 완료), 재차 차단 사유로 제기하지 않는다.

- **[INFO]** (재확인, 변경 없음) `resolveTerminalDurationMs` 를 같은 완료 경로 안에서 두 번 호출하는 관용구가 6곳 반복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2415`/`2426`, `:2579`/`2595`, `:3566`/`3577`, `:4756`/`4769`, `:4884`/`4888`(대입 없이 즉시 emit, `finalizeCancelledExecution` 부근), `:4945`/`4967`. `retry-turn.service.ts:896`/`907` 도 동형.
  - 상세: `x.durationMs = resolveTerminalDurationMs(x) ?? x.durationMs;` 로 엔티티에 값을 확정한 직후, 같은 함수 안에서 emit payload 를 구성하며 동일 인자로 재호출한다. "값을 한 곳에서 결정한다"는 헬퍼의 설계 의도(JSDoc 1줄 목표)를 완전히 충족하지 못하고 계산 지점이 물리적으로 두 곳에 남는다. 성능 영향은 무시할 수준(O(1), 실행당 1회대)이라 이미 성능 리뷰가 INFO 로 처리했고, 아키텍처 관점에서도 사소한 DRY 잔여일 뿐 별도 조치를 요구할 정도는 아니다.
  - 제안: 없음(우선순위 낮음, 기록 목적).

- **[INFO]** (재확인, 변경 없음) `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스가 `durationMs?: number | null` 필드와 5줄 계약 주석을 문자 그대로 3중 복제
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:397`(Completed), `:420`(Failed), `:438`(Cancelled)
  - 상세: `durationMs` 는 종결 3종에만 있고 `EiaWaitingForInputEvent`/`EiaAiMessageEvent` 등 비종결 이벤트가 공유하는 `EiaEventBase` 로는 올릴 수 없다 — 지금처럼 3곳에 개별 선언한 것 자체는 LSP/ISP 관점에서 **의도적으로 옳은 설계**다. 다만 종결 3종만 묶는 중간 인터페이스(`interface EiaTerminalDurationField { durationMs?: number | null }`)가 없어 필드와 주석이 통째로 복제됐다. 세 곳이 물리적으로 떨어져 있어 향후 계약 문구(null 의미, optional 유지 이유)를 한쪽만 고치는 drift 위험이 이론적으로 남는다.
  - 제안: 강제 아님. 다음에 이 세 인터페이스 중 하나를 편집할 때 mixin 추출을 함께 고려.

- **[INFO]** (재확인, 변경 없음) `shared/utils/terminal-duration.ts` 가 이 폴더에서 처음으로 Postgres 방언 SQL(`::timestamptz`, `EXTRACT(EPOCH …)`, 컬럼명 `started_at`)을 문자열 상수로 보유
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:102-105`(`TERMINAL_DURATION_MS_SQL`)
  - 상세: 자매 파일 `terminal-error-payload.ts` 는 순수 TS 변환만 담당해 DB 스키마와 무관한 반면, 이 파일은 엔티티 미로드 5경로가 "같은 UPDATE 문 안에서 계산"해야 하는 원자성 제약(JSDoc `:80-101`에 근거 명시) 때문에 SQL 조각을 포함한다. 이미 여러 라운드가 "shared/utils = DB 비의존" 관례를 살짝 벗어난다고 지적했고, 팀은 "원자성상 불가피 + 근거 문서화"로 수용했다(`10_52_08` RESOLUTION W6). JS(`resolveTerminalDurationMs`)와 SQL(`TERMINAL_DURATION_MS_SQL`) 두 표현이 같은 규칙(음수→null, 상한 클램프)을 독립 구현하는 것도 동일 원인이다 — 다만 이번엔 두 표현이 `PG_INT4_MAX`(`terminal-duration.ts:7`) 라는 **공유 named export** 를 참조하도록 정정돼 있어(`:56`, `:104`), 매직 넘버가 두 곳에 따로 하드코딩됐던 `11_09_44` CRITICAL 시점보다 SSOT 위반의 폭이 좁혀졌다. 값 수준 e2e 검증 부재는 이미 별도 트래커(W10/W4 계열)로 관리 중이라 재론하지 않는다.
  - 제안: 없음(이미 근거와 함께 수용된 트레이드오프, 재론 불필요).

## 긍정적으로 평가한 부분

- **SRP/ISP**: `resolveTerminalDurationMs(row: {durationMs?, startedAt?, finishedAt?})` 가 `Execution` 엔티티 전체가 아니라 구조적 타입(duck type)만 요구해 `savedExecution`/`reloaded`/부분 select 행/테스트 fixture 등 다양한 형태에 상속 관계 없이 재사용된다 — 이 세션 전체에서 가장 일관되게 확인된 긍정 신호.
- **개방-폐쇄**: `emitCancellationEvent`(`execution-engine.service.ts:1101-1125`) 의 옵션 객체에 `durationMs?: number | null` 을 추가한 방식은 optional 필드 + 내부 기본값 처리(`opts.durationMs ?? null`)로 기존 계약을 넓히기만 했지 좁히지 않았다.
- **Producer/consumer 계약 분리(DIP)**: `chat-channel/types.ts` 의 `durationMs` 가 optional 로 남아 있는 이유가 타입 옆 주석에 명시돼 있다 — producer(emit 쪽)는 항상 키를 채우지만, consumer 타입은 배포 경계에서 재생되는 레거시 이벤트가 키를 갖지 않는 현실을 반영한다. 타입이 구현보다 넓은 보장을 주장하지 않는 방향으로 의도적으로 제약된 판단.
- **순환 의존성 없음**: `terminal-duration.ts` 는 다른 애플리케이션 모듈을 import 하지 않는 리프 유틸이고, `execution-engine.service.ts`/`retry-turn.service.ts` 만 단방향으로 참조한다(`grep -rln terminal-duration codebase/backend/src` 결과 두 파일뿐). `chat-channel` 모듈은 이 파일을 참조하지 않고 이벤트 페이로드 타입만 소비해 presentation/도메인 계층 결합도 이벤트 기반으로 유지된다.
- **레이어 책임**: `chat-channel.dispatcher.ts`/`types.ts` 의 변경은 캐스팅 타입만 넓혔을 뿐(`{ durationMs?: number }` → `{ durationMs?: number | null }`), presentation 어댑터 경계와 도메인 계산(`resolveTerminalDurationMs`)이 섞이지 않았다.

## 요약

이번 8번째 라운드에서 프로덕션 코드에 신규 변경은 없었고(집계 필터 수정은 `11_59_09` 라운드 자체에서 이미 다뤄짐), 확인 결과 직전까지의 구조적 판단은 현재 소스에 그대로 유효하다. 핵심 설계(순수 계산·SQL 상수를 `terminal-duration.ts` 로 추출, `PG_INT4_MAX` 공유 상수로 JS/SQL 클램프 SSOT 수렴, `resolveTerminalDurationMs` 의 구조적 타입 파라미터, producer/consumer 타입 계약 분리)는 SRP·ISP·DIP·OCP 관점에서 건전하고 직전 PR(`error` 필드)이 세운 패턴을 일관되게 재사용했다. 유일하게 남은 구조적 WARNING(`emitExecution(payload: unknown)` 에 종결 payload 형태를 강제하는 타입 초크포인트가 없어 16개 호출부에 필드를 손으로 스레딩해야 하고, 이 PR 자체가 8라운드에 걸쳐 같은 클래스의 결함을 반복 재발시켰다는 사실)은 이번 라운드에 실제로 트래커(`spec-sync-external-interaction-api-gaps.md:227-234`)에 등재됐음을 직접 확인했다 — 직전 라운드가 지적한 "유예 근거 미실측" 결함은 해소됐다. 나머지(이중 호출, 타입 주석 3중 복제, shared/utils 의 SQL 혼입)는 모두 이미 여러 라운드가 근거와 함께 보류한 저위험 INFO 이며 이번에 재확인한 결과 변경이 없다. 신규 CRITICAL/차단 사유 없음.

## 위험도

LOW
