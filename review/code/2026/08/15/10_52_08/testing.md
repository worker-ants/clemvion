STATUS=success

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (4차 라운드, `10_52_08`)

## 방법론 노트

이 PR 은 이미 3차례 ai-review 라운드(`09_58_24`, `10_18_38`, `10_34_51`)를 거쳤다. 프롬프트
번들에서 크기 제한으로 diff 가 생략된 두 파일(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`)은 `git diff origin/main -- <path>` 로 전문을 직접 열어
대조했고, 의문이 남은 지점은 `Read`/`grep` 으로 실제 소스 줄 번호를 재확인했다(아래 위치 표기는
프롬프트 게이트가 있는 파일은 게이트 숫자를, 게이트가 없는 파일은 `Read` 로 확인한 실제 소스
줄 번호를 그대로 인용한다). 직전 라운드 `testing.md`(`10_34_51`)가 지적한 W4(dispatcher 회귀
테스트 부재)가 이번 diff 에서 해소됐는지, 그리고 세 라운드 동안 반복 지적된 항목이 실제로
"테스트"까지 닫혔는지(코드만 고치고 테스트 요구는 미이행 상태로 남았는지)를 중점적으로
재검증했다.

## 발견사항

- **[WARNING]** `driveCallStackResume` 완료 경로의 `durationMs` emit — 두 라운드에 걸쳐
  명시적으로 요청된 회귀 테스트가 여전히 없다
  - 위치: 프로덕션 코드 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    함수 `driveCallStackResume` 계산부 `:2576-2577`, emit 부 `:2593`(현재 소스에서 `Read` 로
    확인). 테스트: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    `describe('driveCallStackResume / driveResumeFrame / injectInvokerOutput (CRITICAL #1)')`
    (`:16185`~`:16800` 부근, "Case1"/"Case2" 완료 테스트 `:16279`~`:16390`, `:16393`~`:16480`)
  - 상세: `10_18_38` 라운드 `side_effect.md` 가 "`driveCallStackResume` 완료 경로가 형제 5경로와
    다르게 `resolveTerminalDurationMs` 계산-측 가드를 우회한다"는 CODE WARNING 과 함께 "이
    경로에 대한 `durationMs` 단언(양수·null 양쪽 케이스)을 스펙에 추가해 형제 경로와 같은
    계약을 지킴을 고정할 것"을 명시적으로 제안했다. 코드 쪽 결함은 이후 실제로 고쳐졌다
    (`10_34_51` 라운드가 `execution-engine.service.ts:2574` 에서 `resolveTerminalDurationMs`
    경유로 전환됐음을 확인, 이번 라운드도 `:2576-2577`/`:2593` 에서 동일하게 재확인함). **그러나
    제안된 테스트는 아직 추가되지 않았다** — `driveCallStackResume` CRITICAL#1 describe 블록
    전체(`:16185`~`:16800`)를 `grep`한 결과 `durationMs`/`emitExecution`/`eventEmitter` 어느
    것도 0건이다. Case1(`:16279`)·Case2(`:16393`) 완료 테스트는 `driveResumeFrame` 호출 횟수·
    상태 전이(`RUNNING`→`COMPLETED`)·`injectInvokerOutput` 호출만 검증하고, `EXECUTION_COMPLETED`
    emit 자체를 스파이하지 않는다. `10_34_51` 라운드 `scope.md`(`:47`)도 "요청받았던
    `driveCallStackResume` 1곳에 대한 테스트도 없다 — 별개 testing 관점 이슈"라고 명시적으로
    남겼으나, 같은 라운드의 `testing.md` 는 코드 재확인만 하고 이 테스트 갭을 재지적하지
    않았다. 결과적으로 이 경로(중첩 sub-workflow 호출 스택 재개 완료)는 이 PR 이 추가한
    신규 필드 `durationMs` 에 대해 형제 5경로 대비 유일하게 테스트로 고정되지 않은 곳이다 —
    코드가 맞더라도 다음 리팩터가 이 지점만 조용히 되돌릴 여지가 남는다(이 브랜치가 W2 에서
    실제로 겪은 "정규식 과잉 수정 → 원상복구"류 회귀가 재발해도 감지할 안전망이 없다).
  - 제안: `driveCallStackResume` Case1/Case2 완료 테스트에 `eventEmitter.emitExecution` (또는
    `mockWebsocketService.emitExecutionEvent`) 스파이를 추가해 `EXECUTION_COMPLETED` payload 의
    `durationMs` 를 최소 1건(`expect.any(Number)` 수준이라도) 단언할 것.

- **[WARNING]** raw UPDATE 취소 경로 5곳 중 4곳이 `durationMs` RETURNING 값 threading 을
  실제로 검증하지 않는다 — mock 데이터는 존재하는데 그 값을 쓰는 단언이 없다
  - 위치:
    - `markWebChatIdleTimeout` — mock `makeIdleQb`(spec.ts `:2978`, `execute` 는 `raw` 필드
      자체가 없음) / emit 단언 `:3054-3061`(`expect.objectContaining({ result: ..., error: ... })`,
      `durationMs` 키 없음)
    - `markQueueWaitTimeout` — mock `mkQb`(spec.ts `:4372`, `raw: []`) / emit 단언
      `:4537-4546`(`objectContaining`, `durationMs` 키 없음)
    - `markExecutionCancelled` — mock `buildUpdateChain`(spec.ts `:14770-14801`, **`raw: [{
      duration_ms: 1234 }]` 를 명시적으로 반환**) / emit 단언 `:14984-14993`(`objectContaining`,
      `durationMs` 키 없음)
    - `cancelParkedExecution`(`applyCancellation`) — mock `makeCancelQb`(spec.ts `:3160-3167`,
      `execute` 반환값에 `raw` 자체가 없음) / emit 단언 `:3193-3213`(정확 매칭, `durationMs:
      null`)
  - 상세: 5개 raw-UPDATE 취소/실패 경로 중 실제로 **DB 가 돌려준 숫자 값이 emit payload 로
    올바르게 threading 되는지**를 검증하는 곳은 `finalizeStalledExhausted`
    (spec.ts `:4741-4745` 에서 `raw: [{ duration_ms: 4242 }]` 를 명시적으로 세팅하고
    `:4826-4828` 에서 `durationMs: 4242` 정확 매칭) 단 1곳뿐이다. `cancelParkedExecution` 은
    `durationMs: null` 을 정확 매칭하지만, 이는 mock 이 애초에 `raw` 필드를 주지 않아 **항상**
    null 이 되는 기본 동작을 확인하는 것이지, `toFiniteNumber` 가 실제 숫자 문자열/숫자를
    올바르게 좁히는 경로를 검증하지 않는다(같은 함수가 값 있는 케이스에서 깨져도 이 테스트는
    통과한다). 더 눈에 띄는 것은 `markExecutionCancelled` 다 — 이 함수가 쓰는 mock
    (`buildUpdateChain`)은 `finalizeStalledExhausted` 와 똑같이 `raw: [{ duration_ms: 1234 }]`
    를 **이미 갖고 있는데도**, 이 mock 을 공유하는 어떤 `it` 도 emit payload 의 `durationMs`
    를 단언하지 않는다(`:14826` 은 `execute` 호출 여부만, `:14984-14993` 은 `error`/`result` 만
    검사). 즉 "정확한 값을 흘려보내는 인프라"는 이미 준비돼 있는데 마지막 단언 한 줄이
    빠져 있다 — `toFiniteNumber`/`RETURNING` 배선이 이 경로에서 깨져도(예: 컬럼명 오타,
    배열 인덱스 오류) 어떤 테스트도 실패하지 않는다. 이 갭 자체는 `09_58_24`/`10_18_38`/
    `10_34_51` 세 라운드가 이미 발견해 "근거 있는 이월"로 `RESOLUTION.md`/`spec-sync-
    external-interaction-api-gaps.md` 에 등재돼 있으나(추출 로직이 5곳 모두 동일 패턴이고
    대표 2경로가 정확 매칭으로 고정됐다는 근거), 그 근거가 주장하는 "대표 2경로 검증"조차
    한쪽(`cancelParkedExecution`)은 사실상 null-폴백만 확인하는 점은 이번 라운드에서 처음
    구체적으로 짚는다.
  - 제안: 이미 트래커에 등재된 사안이라 이번 라운드에서 강제 조치는 요구하지 않는다. 다만
    후속 착수 시 `markExecutionCancelled` 는 이미 `raw: [{ duration_ms: 1234 }]` mock 이 있으니
    단언 한 줄(`durationMs: 1234`)만 추가하면 되는 최저비용 항목이라는 점을 기록해 둔다.

- **[INFO]** `chat-channel.dispatcher.spec.ts` 신규 `durationMs` 회귀 테스트 — `10_34_51`
  WARNING 이 해소됨을 확인
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`
    `describe('toChatChannelEvent — durationMs 전파')` (게이트 `:374`~`:416`)
  - 상세: 직전 라운드(`10_34_51` `testing.md` WARNING)가 "CHANGELOG 가 breaking 으로 고지한
    wire 경계(`toChatChannelEvent`)에 `durationMs` 회귀 테스트가 전혀 없다"고 지적했는데, 이번
    diff 가 `completed`/`failed`/`cancelled` 세 상태 × 숫자(`it.each` 3케이스) + `null`
    (`completed` 1케이스) + 키 부재(`completed` 1케이스), 총 5개 테스트로 그 갭을 메웠다. `mk`
    헬퍼가 `status`/`extra` 를 매개변수화해 세 상태를 한 자리에서 다루는 구조도 명확하다.
  - 다만 `null`/키부재 두 케이스는 `completed` 상태로만 검증되고 `failed`/`cancelled` 로는
    반복되지 않는다. `toChatChannelEvent` 의 세 분기(게이트 `:531-536`, `:569-574`,
    `:586-591`, 파일 3)가 `durationMs` 를 완전히 동형으로(`(event.payload as {...}).durationMs`)
    다루는 것을 코드로 확인했으므로 실질 위험은 낮지만, `it.each` 배열에 `null`/키부재
    케이스도 3-상태 매트릭스로 넣으면 "형태가 갈리면 놓친다"(이 세션이 반복 학습한 패턴)에
    대한 방어가 더 촘촘해진다. 강제 사항 아님.

- **[INFO]** `terminal-duration.spec.ts` 의 "NaN/Infinity" 테스트 제목이 실제로는 NaN 만
  검증한다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.spec.ts` 게이트 `:65-73`
    (`it('durationMs 가 NaN/Infinity 면 계산으로 폴백한다', ...)`)
  - 상세: 테스트 본문은 `durationMs: Number.NaN` 케이스 하나만 실행한다. 함수 로직상
    (`Number.isFinite(row.durationMs)` 가드) `Infinity` 도 같은 분기로 폴백하는 것이 맞지만,
    제목이 커버리지를 실제보다 넓게 주장한다 — 다음에 이 조건을 리팩터하다 `Infinity` 분기가
    깨져도 이 테스트 이름만 보고 "이미 검증됨"으로 오인하기 쉽다.
  - 제안: `it.each([['NaN', Number.NaN], ['Infinity', Number.POSITIVE_INFINITY]])` 로
    분리하거나, 제목을 "NaN 이면"으로 좁힌다. 강제 사항 아님.

- **[INFO]** `resolveTerminalDurationMs`/`retry-turn.service.spec.ts` 호출부 단언이
  `expect.any(Number)` 수준에 머무는 것은 계층화된 설계로 적절함
  - 위치: `retry-turn.service.spec.ts` 게이트 `:691`, `:727`, `:858`, `:894`
  - 상세: 호출부는 값 검증을 `expect.any(Number)` 로만 하고, 정확한 산술(음수/NaN/`0`/실제
    ms 값)은 `terminal-duration.spec.ts` 가 순수 함수 레벨에서 이미 촘촘히 고정한다(25개
    케이스). 헬퍼가 커버한 edge case 를 호출부에서 중복 검증하지 않는 판단으로 읽혀 문제
    삼지 않는다.

## 잘 된 점

- `terminal-duration.spec.ts`(신규)는 순수 함수 단위 테스트의 모범이다 — 이미 계산된 값
  보존, `startedAt`/`finishedAt` 각각·둘 다 부재·`null`(4-fixture `it.each`), non-`Date` 값,
  `Invalid Date`, 시계 역행(음수)→`null`, `0`(falsy 취급 방지 명시), pg 드라이버 문자열
  bigint/numeric(`toFiniteNumber`)까지 촘촘하다. 특히 "이 PR 이 실제로 겪은 회귀"(조건 밖
  hoist 가 `startedAt.getTime()` 에서 throw 해 종결 emit 자체가 사라짐)를 그대로 재현하는
  회귀 테스트(`it.each`, 게이트 `:31-39`)를 갖췄다 — 값이 아니라 "throw 하지 않는다"는 실패
  모드 자체를 고정한 점이 특히 견고하다.
- `TERMINAL_DURATION_MS_SQL` 상수의 형태 검증(파라미터 이름 일치, `LEAST(2147483647` 클램프,
  `THEN NULL` sentinel, `GREATEST(0` 부재)이 문자열 `toContain` 수준이지만 정적 drift 방지
  목적은 충분히 달성한다(실제 Postgres 값 검증은 별도 트래커 항목 — 아래 참고).
- `chat-channel.dispatcher.spec.ts` 신규 5테스트는 위 INFO 항목대로 직전 라운드 WARNING을
  실제로 닫았고, 각 테스트가 `durationMs` 한 필드만 단언해 읽기 쉽다.
- 세 라운드 동안 반복 지적된 항목(raw UPDATE 실값 threading 미검증, SQL e2e 값 미검증,
  `resolveTerminalDurationMs` 의 "이미 계산된 값 신뢰" 분기 음수-우회 비대칭)은 `RESOLUTION.md`
  와 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 근거와 함께 명시적으로
  등재돼 있어, "미룬 항목이 기록되지 않아 유실"되는 패턴은 이 PR 에서 재발하지 않았다.

## 요약

핵심 신규 로직(`resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`)의
단위 테스트는 매우 탄탄하고, 직전 라운드가 지적한 dispatcher 회귀 테스트 부재(W4)도 이번
diff 에서 실제로 해소됐다. 다만 두 개의 WARNING 급 갭이 남아 있다 — (1) `driveCallStackResume`
완료 경로는 코드상 방어(음수/NaN 가드)가 형제 5경로와 동형으로 맞춰졌지만, 이를 고정하는
emit 단언 테스트는 두 라운드에 걸쳐 명시적으로 요청되고도 아직 추가되지 않았다. (2) raw
UPDATE 취소/실패 5경로 중 `finalizeStalledExhausted` 를 제외한 4곳은 `durationMs` 의 DB→wire
threading 을 검증하지 않으며, 그중 `markExecutionCancelled` 는 정확한 mock 데이터
(`duration_ms: 1234`)가 이미 준비돼 있음에도 마지막 단언 한 줄이 빠져 있어 비용 대비
효과가 특히 큰 미해결 항목이다. 둘 다 이 세션이 반복 학습한 "하드닝을 자매 함수/경로에
미적용"·"쓰기 인프라는 준비했는데 마지막 단언이 없다"는 패턴의 재현이며, CRITICAL 급
실결함은 아니지만(현재 코드 자체는 올바름) 회귀 안전망 공백으로 남는다.

## 위험도

MEDIUM
