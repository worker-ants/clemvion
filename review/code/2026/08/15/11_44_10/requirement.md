STATUS=success

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (9차 라운드)

## 방법론 노트

이 PR 은 이미 8차례(`09_58_24`~`11_29_02`) ai-review 라운드를 거쳤고, 그때마다 CRITICAL(int4
오버플로 JS/SQL 양쪽) 및 다수 WARNING(호출부 개수 오산, JSDoc 모순, `it.each` NaN/Infinity
분리 미이행, `PG_INT4_MAX` 를 끼워 넣으며 JSDoc orphan 화 등)이 실제로 발견·수정됐다. 프롬프트
번들 자체는 크기 제한으로 핵심 소스(`execution-engine.service.ts`, `retry-turn.service.ts`,
`terminal-duration.ts`, `spec/5-system/14-external-interaction-api.md` 등)의 diff 를
대부분 생략했으므로, RESOLUTION 문서의 "완료" 주장을 그대로 믿지 않고 `Read`/`Grep` 으로
현재 소스 상태를 직접 재확인했다:

- `codebase/backend/src/shared/utils/terminal-duration.{ts,spec.ts}` 전문
- `execution-engine.service.ts` 의 `durationMs`/`emitCancellationEvent` 전 호출부(grep 전수)
- `retry-turn.service.ts` 의 `durationMs` 전 대입/emit 지점
- `chat-channel/{types.ts,dispatcher.ts}` (이미 diff 로 확인됨 — 3개 인터페이스 동형 변경)
- `spec/5-system/14-external-interaction-api.md` §6/§6.3/§6.4/§6.5 전문
- REST `execution-status.literal.ts`/`execution-status-response.dto.ts` (CHANGELOG 의 "REST
  엔 없다" 비대칭 주장 검증)
- `plan/in-progress/{eia-terminal-payload.md, spec-sync-external-interaction-api-gaps.md}`

## 발견사항

- **[INFO]** 이미 정본 트래커에 등재된 기지(既知) 갭 3건이 이번 diff 로 재확인됨 — 신규 발견
  아님, 조치 불필요
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 함수
    `finalizeGuarded` (CANCELLED 재진입 분기, `.set({ durationMs: () =>
    'COALESCE(duration_ms, :newDurationMs)' })`)
  - 상세: (1) retry-turn 재진입 시 DB(`stop()` 이 커밋한 T1)와 emit(재진입 시점 T2 계산값)이
    어긋나는 알려진 예외 — spec §6.5 blockquote(`durationMs (2026-08-15 구현)` 절)에 "알려진
    예외 1건"으로 명시적으로 문서화돼 있고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    에도 등재돼 있다. (2) `duration_ms` 컬럼에 "대기 시간"이 섞여 status 필터 없는 평균 집계
    3곳(대시보드/통계/실행목록)을 오염시킬 수 있다는 지적도 같은 트래커에 등재됨. (3) REST
    `GET /api/external/executions/:id` 에 `durationMs` 가 없는 비대칭도 `execution-status.literal.ts`/
    `execution-status-response.dto.ts` 를 직접 열어 실측 확인(둘 다 `durationMs`/`duration` 키
    없음) — CHANGELOG·트래커의 서술과 일치한다.
  - 제안: 조치 불필요(이미 투명하게 문서화·트래킹됨). 재론 대상 아님.

- **[INFO]** 종결 3종 emit 경로(16곳)를 grep 전수 대조한 결과, `resolveTerminalDurationMs` 헬퍼
  사용이 빠짐없이 적용돼 있음을 재확인 — 신규 회귀 없음
  - 위치: `execution-engine.service.ts` (9곳 in-memory 계산 + 5곳 raw SQL `TERMINAL_DURATION_MS_SQL`
    + `emitCancellationEvent` 통합 지점 5개 호출부), `retry-turn.service.ts` (3개 대입 지점)
  - 상세: 과거 라운드(`10_18_38` W1)가 "grep 패턴이 멀티라인 표현식을 못 셌다"고 지적했던
    형태(`x.durationMs =\n  x.finishedAt.getTime() - ...`)의 재발 여부를 별도로
    `grep -n "durationMs"` 전수 목록으로 재검증했고, 맨손 뺄셈(`.getTime() - .getTime()`)이
    남아 있는 지점은 없었다. `emitCancellationEvent` 의 JSDoc 이 스스로 "호출부 5곳 모두
    명시적으로 값을 넘긴다"고 주장하는데, 실제 호출부 개수도 정확히 5(1077/1210/2860/2909/4886)
    로 일치한다.
  - 제안: 없음.

- **[INFO]** spec §6.5 의 "취소 경로 6곳 중 4곳은 raw UPDATE" 수치가 코드와 line-level 로
  일치함을 교차검증
  - 위치: `spec/5-system/14-external-interaction-api.md:806` vs
    `execution-engine.service.ts` (`cancelParkedExecution`·`markWebChatIdleTimeout`·
    `markExecutionCancelled`·`markQueueWaitTimeout` = raw 4곳, `finalizeCancelledExecution`
    = 엔티티 기로드) + `retry-turn.service.ts` `stop()` = 엔티티 기로드. 4+2=6.
  - 상세: 같은 문서 §6 필드 집합 표(`:575`)의 "5경로" 는 이 4곳(cancelled)에
    `finalizeStalledExhausted`(FAILED 상태로 종결, cancelled 아님)를 더한 값이라 모순이
    아니라 서로 다른 모집단(“취소 6곳 중 raw 4곳” vs “전체 raw-UPDATE SQL 5곳”)을 가리키는
    것으로 확인했다.
  - 제안: 없음(둘 다 실측과 일치).

- **[INFO]** 이전 라운드가 지적했던 "제목이 실제보다 넓은 커버리지를 주장" 클래스(`NaN`/`Infinity`
  test title)가 이번 소스에서 실제로 해소돼 있음을 확인
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.spec.ts:81-92`
  - 상세: `it.each([['NaN', NaN], ['Infinity', POSITIVE_INFINITY]])` 형태로 두 값이 각각
    실행되도록 분리돼 있다(과거 `10_52_08` RESOLUTION 이 "다음 편집 때 우선 처리"로 미뤘던
    항목). `chat-channel.dispatcher.spec.ts` 의 신규 `durationMs 전파` describe 블록도 세
    상태(completed/failed/cancelled) × 숫자·`null`·키부재(레거시)를 개별 단언으로 고정한다.
  - 제안: 없음.

## 요약

이번(9차) 라운드는 프롬프트 번들이 핵심 소스 diff 대부분을 생략했음에도, 8차례에 걸친 선행
리뷰가 잡은 CRITICAL(int4 오버플로 JS/SQL 양쪽 클램프)과 WARNING(호출부 개수 오산, JSDoc-코드
모순, `it.each` 분리 미이행)이 실제 소스 상태에서 해소돼 있음을 `Read`/`Grep` 으로 독립적으로
재확인했다. `resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL` 세
프리미티브를 경유하는 16개 종결 emit 경로 전수, `chat-channel` 타입·디스패처의 3개 인터페이스
동형 nullable 확장, REST 비대칭·집계 오염·retry-turn 재진입 DB/emit skew 등 알려진 갭 3건의
투명한 트래킹 상태까지 spec(`14-external-interaction-api.md` §6/§6.3~§6.5)·CHANGELOG·plan
트래커와 line-level 로 대조한 결과 신규 CRITICAL/WARNING 은 발견되지 않았다. TODO/FIXME/HACK/XXX
마커도 변경 파일 전수에서 0건이다. 남은 항목은 전부 이미 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)
에 근거와 함께 등재된 기지 갭의 재확인(INFO)뿐이다.

## 위험도

LOW
