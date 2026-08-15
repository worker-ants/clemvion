STATUS=success

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — EIA 종결 이벤트 `durationMs` (7차 누적 라운드)

## 방법론

이 changeset 은 오늘 이미 6차례(`09_58_24` ~ `11_44_10`) ai-review 를 거쳐 CRITICAL 2건(SQL int4
오버플로 → UPDATE 실패 → 실행 영구 고착, 이어서 같은 결함이 JS 경로에도 남아 있던 것)을 포함해
다수의 WARNING 이 실제로 수정된 누적 diff다. 프롬프트가 큰 파일(`execution-engine.service.ts`,
`retry-turn.service.ts`, `terminal-duration.{ts,spec.ts}`)의 diff/컨텍스트를 예산 초과로 생략해,
`Read`/`Bash grep` 으로 저장소를 직접 열어 16개 종결 emit 경로 전부와 `spec/5-system/
14-external-interaction-api.md` §6, `spec/conventions/chat-channel-adapter.md`,
`spec/3-workflow-editor/3-execution.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
를 대조했다. 마지막 커밋(`777698bbe`, W1 vacuous mock 수정)의 실제 diff 도 `git show` 로 직접
확인했다.

## 발견사항

- **[INFO]** `markQueueWaitTimeout` durationMs threading 테스트가 이번 라운드에 실제로
  non-vacuous 하게 고정됨 — 확인 목적, 조치 불필요
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4389-4392`(mock),
    `:4558-4560`(단언)
  - 상세: 직전 라운드(`11_44_10` W1)가 "mock 의 `raw` 가 비어 있어 추출부를 통째로 깨는
    뮤테이션에도 GREEN" 이라고 지적한 것을, 이번 라운드는 `raw: affected > 0 ? [{ id: 'e3',
    duration_ms: 600000 }] : []` 로 실값을 주고 `durationMs: 600000` 정확 매칭으로 고정했다.
    직접 실행 결과 이 경로가 실제로 값을 태우는 것을 코드로 확인했다 — vacuous 아님.
  - 제안: 없음.

- **[INFO]** `resolveTerminalDurationMs`/`TERMINAL_DURATION_MS_SQL` 의 int4 클램프가 JS·SQL
  두 경로 모두에 적용돼 있고 공유 상수(`PG_INT4_MAX`)로 drift 를 막음 — 확인 목적
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:7`(상수), `:56`(JS `Math.min`),
    `:104`(SQL `LEAST(${PG_INT4_MAX}`)
  - 상세: 직전 CRITICAL(SQL 만 클램프, JS 는 미클램프)이 실제로 해소돼 있다. SQL 식은
    `LEAST(PG_INT4_MAX, (EXTRACT(EPOCH...)::bigint))::int` 순서라 `LEAST` 이후에만 `::int`
    캐스팅해 오버플로 여지가 없다. 음수(시계 역행)는 JS/SQL 둘 다 `null` sentinel 로 통일.
  - 제안: 없음.

- **[INFO]** 종결 3종 16개 emit 경로 전부에서 `durationMs` 키가 항상 포함됨(생략 없음) —
  spec §6 필드 집합 표("이 표가 전부다") 및 "알 수 없으면 null" 규정과 line-level 일치
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`emitCancellationEvent`:1125 `durationMs: opts.durationMs ?? null`; completed 6곳
    `durationMs: resolveTerminalDurationMs(...)`; `finalizeStalledExhausted`:3399
    `durationMs: stalledDurationMs`), `retry-turn.service.ts`(:730, :907, :971 모두 동형),
    spec: `spec/5-system/14-external-interaction-api.md:575`
  - 상세: `grep`으로 emit 호출부 전수를 대조한 결과 `durationMs` 를 조건부로 생략하는 경로가
    없다 — `?? null` 병합이거나 `resolveTerminalDurationMs`(내부에서 항상 `number | null`
    반환)를 직접 대입한다. `chat-channel/types.ts` 의 `durationMs?: number | null` 은
    producer 계약이 아니라 **consumer(레거시 재생 이벤트 흡수)** 계약이라는 주석 근거가
    코드와 일치한다(생산 측은 항상 채움 확인).
  - 제안: 없음.

- **[WARNING]** 대기 시간이 `duration_ms` 에 섞여 다른 모듈의 status-비필터 평균 집계를
  오염시키는 부작용 — 이미 트래커에 등재돼 있으나 이 PR 이 만든 신규 데이터 품질 회귀라
  기재를 유지한다
  - 위치: 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:177-193`
    (`10_34_51` W3 등재분). 소비처: `dashboard.service.ts:96` `avgExecutionTime`,
    `statistics.service.ts:95,221` `avgDurationMs`
  - 상세: 이 PR 이전에는 `cancelParkedExecution`/`markWebChatIdleTimeout`/
    `markQueueWaitTimeout`/`finalizeStalledExhausted` 등 대기 위주 종결 경로가 `duration_ms`
    를 전혀 쓰지 않았다(컬럼이 비어 있었다). 이 PR 이 그 경로들에 값을 채우기 시작하면서,
    "실행 시간" 이 아니라 "대기 시간"(위젯 idle grace 최대 1시간, park 는 무기한)인 값이
    `status` 필터 없이 평균을 내는 두 소비처에 섞여 들어간다. `alerts-evaluator` 만
    `status='completed'` 필터가 있어 우연히 안전하다. 이 PR 은 종결 payload 배관(EIA §6)에만
    책임이 있고 집계 쿼리는 다른 모듈이라 이번 스코프에서 직접 고치지 않은 판단은 합리적이나,
    **트리거 조건(경로에 값이 채워지기 시작하는 시점)이 바로 이 PR** 이므로 배포 시점에
    관측 가능한 지표 왜곡이 실제로 발생한다.
  - 제안: 코드 변경 불요(이미 근거와 함께 별도 트래커 항목으로 정당하게 defer 됨) — push
    전에 이 트래커 항목이 실제로 in-progress 백로그에 살아있는지만 재확인 권장. spec 수정
    대상 아님(구현 세부사항).

- **[INFO]** retry-turn 재진입(Stop 중첩) 시 DB(`COALESCE` 보존값 T1)와 emit(재계산값 T2)의
  `durationMs` 가 어긋날 수 있는 잔여 갭 — 이미 트래커에 근거와 함께 등재, 확인 목적
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:637-650`
    (`finalizeGuarded` CANCELLED 분기 `COALESCE(duration_ms, :newDurationMs)`),
    트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:206-224`
  - 상세: `stop()` 이 사용자가 취소를 누른 정확한 시각(T1)을 이미 guarded UPDATE 로
    커밋했는데, 같은 함수의 이후 emit(`retry-turn.service.ts:971`)은 in-memory
    `execution.durationMs` 를 재계산해 재진입 시각(T2, 더 큰 값)을 싣는다. DB 는 T1 을
    보존하는데 wire 는 T2 를 보낸다 — 이 PR 이 세운 "DB=wire" 불변식의 유일한 잔여 위반.
    코드 자체(`finalizeGuarded`)와 트래커 서술(`.returning(['duration_ms'])` 추가로
    실제 persist 값을 되읽어야 한다는 처방)이 일치해 새로 지적할 내용은 아니다.
  - 제안: 없음(이미 방향까지 정해져 등재됨). 다음 편집에서 DB write 경로를 만질 때 함께
    처리 권장.

- **[INFO]** REST `GET /api/external/executions/:id` 에 `durationMs` 부재 — push 계열(webhook/
  SSE/WS)과의 비대칭. 이미 CHANGELOG·트래커에 고지, 확인 목적
  - 위치: CHANGELOG.md:22-23, 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:228-231`
  - 상세: 이벤트로 받으면 있는데 재조회(`ExecutionStatusDto`)하면 사라지는 비대칭이 실제로
    존재하고, 새로 지적할 내용이 아니라 CHANGELOG 로 고지 + 트래커 등재까지 완료된 상태다.
  - 제안: 없음.

## 확인 결과 (spec fidelity — line-level 대조)

- `spec/5-system/14-external-interaction-api.md:575` 필드 집합 표의 `durationMs` 서술
  ("밀리초, 알 수 없으면 null, 엔티티 미로드 5경로는 SQL 계산+RETURNING, `markQueueWaitTimeout`
  값은 큐 대기 시간") 이 코드 구현과 정확히 일치한다.
- `spec/3-workflow-editor/3-execution.md:308-309` 의 이벤트 표에 `execution.failed`/
  `execution.cancelled` 행에 `duration` 컬럼이 추가돼 3종 전부 duration 을 갖는다는 서술과
  실제 emit 코드가 일치.
- `spec/conventions/chat-channel-adapter.md:149-151` 의 `EiaEvent` union 타입이
  `durationMs?: number | null` 로 갱신돼 `chat-channel/types.ts`/`dispatcher.ts` 의 실제
  TypeScript 타입·캐스팅과 일치.
- `spec/data-flow/3-execution.md` 는 plan frontmatter `spec_impact` 에 등재돼 있으나 이번
  diff 에 변경이 없다 — 확인 결과 이 문서의 관련 서술(`:111` `UPDATE execution SET ...,
  duration_ms, ...`)은 이 PR 이전부터 이미 일반적으로 `duration_ms` 갱신을 언급하고 있어
  필드 단위 상세(EIA §6 이 SoT)를 다시 나열하지 않는 문서라 갱신 불요로 판단된다 — 결함
  아님(INFO 로도 별도 기재 안 함).

## 요약

7차 누적 라운드 시점에서 `durationMs` 종결 이벤트 배관 기능은 완전하다 — 종결 3종
(`completed`/`failed`/`cancelled`) 16개 emit 경로 전부가 값을 계산·영속·threading 하며,
값을 모르면 `null` 을 명시적으로 싣고 키를 생략하지 않는다(spec §5.4 부재 표현 규약과
일치). 앞선 라운드들이 잡은 CRITICAL(SQL/JS int4 오버플로 → 실행 영구 고착)은 공유 상수
`PG_INT4_MAX` 로 양쪽 다 해소돼 있고, 헬퍼(`resolveTerminalDurationMs`/`toFiniteNumber`)의
엣지 케이스 테스트(null/undefined/Invalid Date/문자열 날짜/음수/NaN/Infinity/0/int4 초과)가
전부 갖춰져 있다. 이번 라운드의 실제 신규 diff(마지막 커밋 `777698bbe`)는 직전 라운드가
지적한 vacuous mock(`markQueueWaitTimeout`)을 실값 threading 으로 실제로 고쳤음을 코드로
직접 확인했다. spec 본문(EIA §6, 3-execution.md, chat-channel-adapter.md)은 구현과
line-level 로 일치한다. 남은 항목(REST 비대칭, retry-turn 재진입 DB↔emit 값 어긋남, 통계
평균 오염)은 전부 근거와 함께 별도 트래커에 등재돼 있고 이 PR 범위를 의도적으로 벗어난
것으로 판단된다 — 다만 통계 평균 오염은 **이 PR 이 트리거하는 신규 관측 가능 부작용**이라
WARNING 으로 재확인 기재했다(코드 변경 요구 아님, 트래커 생존 확인 목적).

## 위험도

LOW
