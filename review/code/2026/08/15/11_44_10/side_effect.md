STATUS=success

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (7차 라운드, `11_29_02` 이후)

## 방법론 노트

이 PR 은 이미 6차례 리뷰 라운드(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`→`11_09_44`→`11_29_02`)를
거쳤고, 이번 프롬프트에 실린 diff/전체 파일 컨텍스트가 크기 제한으로 대부분 생략돼 있어
`Read`/`Bash`(`git show`, `git diff origin/main...HEAD`, `grep`)로 저장소를 직접 열어 대조했다.
`11_29_02` 라운드가 낸 WARNING(W2~W5)에 대한 fix 커밋(`f5c609aa8`)이 이번 라운드가 새로 봐야
할 diff 의 핵심이며, 그 외 파일(review/`plan/` 산출물)은 코드가 아니라 리뷰/문서 부산물이라
side-effect 관점에서 제외했다.

## 발견사항

- **[INFO]** `f5c609aa8`(W3) JSDoc 재배치 재확인 — orphan 이 해소됐다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:1-7`(`PG_INT4_MAX` 상수+docstring),
    `:9-37`(`resolveTerminalDurationMs` docstring+함수)
  - 상세: 직전 라운드(`11_29_02`)가 지적한 "`PG_INT4_MAX` 삽입이 `resolveTerminalDurationMs`
    JSDoc 을 고아로 만들었다"가 이번 커밋에서 상수 블록을 파일 최상단으로, 함수 docstring 을
    함수 바로 위로 재배치해 해소됐음을 `Read`로 직접 확인했다. 각 comment 블록이 바로 다음
    선언에 정확히 붙는다.
  - 제안: 없음.

- **[INFO]** `f5c609aa8`(W5) 테스트 mock 의 vacuous 단언 수정이 프로덕션 읽기 지점과 정확히
  일치함을 재확인
  - 위치: `execution-engine.service.spec.ts:2987-2990`(`makeIdleQb` — `raw: [{id:'exec-idle',
    duration_ms: 3600000}]`), 프로덕션 읽기 지점 `execution-engine.service.ts:1182-1186`
    (`cancelledDurationMs = toFiniteNumber((result.raw as …)?.[0]?.duration_ms) ?? null`)
  - 상세: `installIdleTx`는 execution qb 와 NodeExecution qb 를 **같은 헬퍼**(`makeIdleQb`)로
    만들어 둘 다 `duration_ms: 3600000`을 담은 `raw`를 반환하지만, 프로덕션 코드는 트랜잭션
    안에서 **첫 번째** `createQueryBuilder()` 호출(Execution UPDATE)의 `result.raw`만 읽고
    두 번째(NodeExecution UPDATE)는 `duration_ms`를 `.set()`도 `.returning()`도 하지 않는다
    (`:1192-1203`). mock 순서(`qbs[i++]`)와 실제 호출 순서가 일치해 이 테스트는 실제로
    threading 을 검증하며, 이전 라운드가 지적한 "mock 이 경로를 안 태워 vacuous"였던 결함은
    없다.
  - 제안: 없음.

- **[INFO]** `emitCancellationEvent` 시그니처 확장(`durationMs?: number | null` 추가) — private
  메서드, 호출부 전수 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1101-1115`
    (시그니처), 호출부 5곳: `:1077`(`cancelParkedExecution`), `:1210`(`markWebChatIdleTimeout`),
    `:2860`(`markExecutionCancelled`), `:2909`(`markQueueWaitTimeout`),
    `:4886`(`finalizeCancelledExecution`)
  - 상세: `private` 메서드라 외부 계약 영향 없음. `grep -n "emitCancellationEvent("` 로 호출부
    5곳 전수 확인 — 전부 `durationMs` 키를 명시적으로 넘긴다(계산값 또는 `null`). 옵션 필드
    추가라 기존 시그니처와 하위호환.
  - 제안: 없음.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`.`durationMs` 타입 확장
  (`number` → `number | null`)과 `chat-channel.dispatcher.ts` 캐스트 3곳이 일치
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:397,420,438`,
    `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:534-535,572-573,589-590`
  - 상세: 필드는 여전히 optional(`?`)이라 값을 읽지 않는 기존 소비자는 영향 없다(추가 필드,
    제거·이름변경 아님). dispatcher 의 세 캐스트 타입이 `types.ts` 선언과 정확히 일치해
    (`10_18_38` W8 이 지적했던 좁은 캐스트 불일치가 재발하지 않았음을 `grep`으로 재확인.
  - 제안: 없음.

- **[WARNING]** (기존 등재, 신규 아님 — 최종 상태 재확인) `EXECUTION_COMPLETED`/`FAILED`/
  `CANCELLED` 이벤트 payload 필드 추가는 push 계열(webhook/SSE/WS) 외부 소비자에게 전파되는
  실질적 인터페이스 변경이다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`·
    `retry-turn.service.ts` 의 `emitExecution(...)` 호출 16곳 전체
  - 상세: 이벤트 emit(콜백/webhook 트리거)의 발생 조건·횟수·타입은 바뀌지 않았고, payload 에
    필드 하나만 additive 로 늘었다(CHANGELOG 도 "제거·변경 아님"으로 명시). 다만 이는 이
    PR 의 의도된 핵심 변경이며 side-effect 리뷰 관점에서 "인터페이스 변경"에 해당하므로
    재확인 목적으로 기록한다 — 실제 breaking 여부는 이미 6개 라운드에 걸쳐 안전하다고
    판단됐고 이번 라운드에서 반증되지 않았다.
  - 제안: 없음(차단 사유 아님, 기록 목적).

- **[WARNING]** (기존 등재, 신규 아님 — 최종 상태 재확인) retry-turn 재진입 시 DB 에 영속된
  `durationMs`와 emit 값이 갈릴 수 있다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 함수
    `failRetryExecution` 946-949행(계산부, in-memory), 968-971행(emit)
  - 상세: `stop()`이 이미 DB에 커밋한 T1 값을 `finalizeGuarded`의 CANCELLED 분기가 `COALESCE`로
    보존하지만, in-memory `execution.durationMs`는 갱신되지 않아 재진입 시 emit이 T2(더 큰 값)를
    wire로 내보낼 수 있다. 이 PR이 만든 신규 회귀가 아니라(재진입 로직 자체는 선행 PR)
    `durationMs`를 처음 emit payload에 싣기 시작하면서 이 기존 불일치가 처음 wire에
    노출된 것이다.
  - 상태: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 근거와 함께 등재됨
    (`10_34_51` W1, `11_09_44`·`11_29_02` 재확인). 이번 라운드에서 코드 변경 없음 — 재확인만.
  - 제안: 트래커 처방(CANCELLED 분기에 `.returning(['duration_ms'])` 추가) 대로 후속 PR.
    이번 라운드 신규 조치 요구 아님.

- **[WARNING]** (기존 등재, 신규 아님 — 최종 상태 재확인) 새로 채워지는 `duration_ms`가
  status 필터 없는 평균 집계(대시보드/통계) 3곳을 오염시킬 수 있다
  - 위치: PR diff 밖 — `dashboard.service.ts`/`statistics.service.ts`의 `AVG(e.duration_ms)` 계열
  - 상세: park 취소·위젯 idle-wait 취소 등 "대기 시간"이 실행 시간처럼 평균에 섞여 들어갈 수
    있음. `10_34_51` W3, `11_09_44`·`11_29_02` 재확인, PR 범위 밖으로 명시적으로 트래커에
    유예됨. 이번 라운드 코드 변경 없음.
  - 제안: 후속 PR에서 집계 쿼리에 `status='completed'` 필터 추가. 재론 불필요.

- **[INFO]** 환경 변수·파일시스템·네트워크 호출 — 신규 도입 없음
  - 상세: `git diff origin/main...HEAD -- codebase/` 전체를 `process.env|fs\.|readFile|writeFile|
    fetch\(|axios|http.request` 로 grep — 매치 0건. 이번 PR 은 순수 in-process 계산(JS 산술
    또는 raw SQL 문자열 상수) + 기존 TypeORM 트랜잭션/이벤트 emitter 재사용뿐이다.
  - 제안: 없음.

## 요약

이번 7차 라운드의 신규 diff(`f5c609aa8`)는 직전 라운드가 낸 WARNING 4건(orphan JSDoc, 호출부
개수 오기, CHANGELOG 영향범위 축소 서술, vacuous mock 단언)을 모두 실측으로 해소를 확인했다.
`emitCancellationEvent`의 옵션 필드 확장은 private 메서드 + 호출부 5곳 전수 값 전달로 안전하고,
`EiaCompletedEvent` 등 3개 인터페이스의 `durationMs?: number | null` 확장은 optional 필드
유지로 기존 파서와 하위호환이다. 새로운 전역 변수·환경 변수 읽기/쓰기·파일시스템 부작용·
의도치 않은 네트워크 호출은 발견되지 않았다. 이 PR 의 핵심 side-effect 는 "종결 이벤트 3종의
emit payload 에 필드 하나가 추가된다"는 의도된 additive 인터페이스 변경이며, 여러 라운드에
걸쳐 안전성이 확인됐다. 기존에 등재된 WARNING 2건(retry-turn 재진입 시 DB↔emit 값 불일치,
status 필터 없는 평균 집계 오염)은 이 PR 이 새로 만든 회귀가 아니라 `durationMs`를 처음
wire 에 노출시키며 드러난 기존 결함이고, 근거와 함께 후속 트래커에 명시적으로 유예돼 있어
이번 라운드의 신규 차단 사유가 아니다. 신규 CRITICAL/차단 WARNING 없음.

## 위험도

LOW
