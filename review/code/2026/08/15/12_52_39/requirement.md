STATUS=success

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (누적 diff, `12_52_39`)

## 방법론 노트

이 PR 은 이미 9회의 ai-review 라운드(`09_58_24` ~ `12_26_36`)와 4회의 consistency-check 라운드를
거친 누적 diff다. 프롬프트 번들이 대형 파일(`execution-engine.service.ts`,
`terminal-duration.ts` 등)의 diff 를 예산 초과로 생략했으므로, 해당 파일은 `Read`/`git diff
origin/main --`/`grep` 으로 저장소에서 직접 열어 대조했다. RESOLUTION.md 들의 주장을 그대로
신뢰하지 않고 핵심 불변식(5개 raw UPDATE 경로의 SQL 클램프·9개 JS 경로의 헬퍼 사용·타입-런타임
일치·spec §6 필드표)을 독립적으로 재검증했다.

## 발견사항

없음(CRITICAL/WARNING 신규 0건). 아래는 재검증 결과(INFO)만 기록한다.

- **[INFO]** 5개 raw UPDATE 경로(`cancelParkedExecution`, `markWebChatIdleTimeout`,
  `markExecutionCancelled`, `markQueueWaitTimeout`, `finalizeStalledExhausted`) 전부가
  `TERMINAL_DURATION_MS_SQL`(음수→`NULL`, int4 상한 `LEAST(2147483647,…)` 클램프)을
  `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` + `.returning(['id','duration_ms'])`
  + `toFiniteNumber(...)` 패턴으로 일관되게 사용함을 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1036`,
    `:1173`, `:2830`, `:2901`, `:3354` (각 `.returning` 호출부 및 `emitCancellationEvent` 전달부 포함)
  - 상세: 직전 라운드들이 CRITICAL 로 잡았던 "SQL 만 클램프하고 JS 는 빠졌다" 류 비대칭이 이번
    시점 소스에는 남아 있지 않다. `duration_ms` 컬럼이 실제로 `INTEGER`임을
    `codebase/backend/migrations/V001__initial_schema.sql:223,242` 로 직접 확인해 "int4 ≈24.8일"
    근거 자체도 검증됨.
  - 제안: 없음(현행 유지).

- **[INFO]** JS 경로(엔티티 로드 후 계산) 9곳 전부가 `resolveTerminalDurationMs(row) ??
  row.durationMs` → 대입 → 별도로 `resolveTerminalDurationMs(row)` 재호출 → emit 이라는 동일
  패턴을 따름 — `execution-engine.service.ts:639,2414-2415,2578-2579,3565-3566,4295-4296,
  4755-4756,4883-4884,4944-4945` + `retry-turn.service.ts:713-714,895-896,948-949`. 값 자체는
  같은 함수 재호출이므로 결과가 갈리지 않는다(성능 관점 중복 호출은 별도 라운드 INFO 로 이미
  기록됨 — 기능상 문제 아님).
  - 제안: 없음.

- **[INFO]** `retry-turn.service.ts` `finalizeGuarded` 의 CANCELLED 재진입 분기(`:637-650`)가
  `COALESCE(duration_ms, :newDurationMs)` 로 DB 의 기존 값(사용자 Stop 이 커밋한 T1)을
  보존하면서도, 뒤이은 emit(`failRetryExecution` `:971`)은 in-memory `execution.durationMs`
  (재진입 시점 T2, `:948-949`에서 이미 갱신됨)를 싣는다는 것을 코드로 직접 확인 — spec
  §6.5(`spec/5-system/14-external-interaction-api.md:810-814`)가 "알려진 예외 1건"으로 정확히
  같은 시나리오(DB=T1 보존, emit=재진입 시점 값)를 서술하고 있고, `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md:221` 에 등재돼 추적 중임을 대조 확인. 은폐된 결함이
  아니라 spec 이 알고 문서화한 갭.
  - 제안: 없음(이미 spec·plan 양쪽에 정확히 반영).

- **[INFO]** `chat-channel.dispatcher.ts` 3곳(`completed`/`failed`/`cancelled`)이 모두
  `(event.payload as { durationMs?: number | null }).durationMs` 로 캐스팅해 레거시(키 부재)
  이벤트에서는 `undefined`, 명시적 `null` 값은 `null` 그대로, 숫자는 숫자 그대로 통과시킴을
  확인 — `chat-channel.dispatcher.spec.ts` 신규 `describe('toChatChannelEvent — durationMs
  전파', …)` (숫자 3종 × it.each, `null`, 레거시-키-부재 3가지 분기 모두 실제 값으로 정확
  매칭)로 고정돼 있어 vacuous 하지 않음.
  - 제안: 없음.

- **[INFO]** `dashboard.service.ts`(`avg7d`, 1곳) + `statistics.service.ts`(`getSummary`,
  `getTopWorkflows` 2곳) = 총 3곳에 `AND e.status = :completedStatus`/`'completed'` 필터가
  추가돼 CHANGELOG 의 "세 곳" 서술과 정확히 일치함을 `grep` 으로 확인. `statistics.service.ts:268`
  의 `ne.duration_ms`(NodeExecution 노드별 집계)는 이번 변경의 오염 대상(Execution 레벨
  취소/타임아웃 경로)과 무관한 별도 테이블이라 필터 미적용이 올바름 — 범위 밖 컬럼까지
  건드리지 않았다.
  - 제안: 없음.

- **[INFO]** 아직 남은 known gap 두 건(REST `GET /api/external/executions/:id` 에
  `durationMs` 부재, 프런트엔드 실행 목록 Duration 컬럼 4곳이 취소/타임아웃 경로에서
  "대기 시간"을 "실행 시간"인 것처럼 보여줌)이 CHANGELOG·`spec-sync-external-interaction-api-gaps.md:186-192,258-260`·
  frontend user-guide Callout(`run-results.mdx`/`run-results.en.mdx`) 세 군데에 일관되게
  고지·추적되고 있음을 확인. 코드가 이 갭을 은폐하지 않는다.
  - 제안: 없음(이미 트래커·문서에 등재).

- **[INFO]** `TODO`/`FIXME`/`HACK`/`XXX` 신규 삽입 0건(`git diff origin/main -- codebase/ CHANGELOG.md
  spec/ plan/` 전수 grep).

## 확인된 spec fidelity

- SoT: `spec/5-system/14-external-interaction-api.md` §"종결 이벤트의 필드 집합"(:575),
  §6.3~§6.5(:739-819). 필드표의 `durationMs` 행("3종 · 구현됨 · 알 수 없으면 null · 5경로는
  SQL+RETURNING · markQueueWaitTimeout 은 큐 대기 시간")이 코드와 line-level 로 일치.
- `spec/3-workflow-editor/3-execution.md` 이벤트 테이블에 `execution.failed`/`execution.cancelled`
  행이 `duration`(및 `cancelled` 는 `result.cancelledBy`)을 새로 나열 — 구현과 일치.
- `spec/conventions/chat-channel-adapter.md` 의 `EiaEvent` union 타입이 `durationMs?: number |
  null` 로 갱신돼 실제 TS 타입(`chat-channel/types.ts`)과 일치, "optional 인 이유" 각주도
  현재 상태(구현됨, 값 모르면 null)를 정확히 서술.
- 불일치 발견 없음 — SPEC-DRIFT 항목 없음.

## 요약

9라운드에 걸친 반복 리뷰·수정(int4 오버플로 CRITICAL 2건 — SQL 경로·JS 경로 각각 — 포함)을
거친 이 PR 의 현재 상태를 독립적으로 재검증한 결과, 신규로 지적할 CRITICAL/WARNING 은 없다.
종결 이벤트 3종(`completed`/`failed`/`cancelled`) 전 경로에 `durationMs` 를 싣는다는 단일
요구사항이 16개 emit 지점(엔티티 로드 9곳 + raw UPDATE 5곳 + `emitCancellationEvent` 위임
경로 포함)에서 하나의 공유 헬퍼(`resolveTerminalDurationMs`/`TERMINAL_DURATION_MS_SQL`)로
일관되게 구현돼 있고, int4 상한 클램프·음수(시계 역행) sentinel·레거시 키-부재 이벤트·
NaN/Infinity 폴백 등 엣지 케이스가 25개 헬퍼 테스트 + dispatcher 5개 테스트 + int4 클램프
전용 e2e-근접 unit 테스트로 실측 고정돼 있다. 남은 결함류는 전부 (a) spec·CHANGELOG·plan
트래커에 근거와 함께 명시적으로 등재된 알려진 갭(REST 비대칭, retry-turn 재진입 DB/emit
값 불일치, 프런트엔드 Duration 컬럼 의미 혼선)이거나 (b) 과거 라운드가 이미 근거와 함께
비차단 처분한 INFO 성격 잔여(주석 3중 복제, 헬퍼 중복 호출)이며, 이번 재검증에서 새로
발견된 것은 없다.

## 위험도

NONE
