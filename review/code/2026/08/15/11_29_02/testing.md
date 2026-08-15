STATUS=success

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (7차 라운드)

## 방법론 노트

프롬프트 번들이 크기 제한으로 생략한 파일(`execution-engine.service.ts`/`.spec.ts`,
`terminal-duration.spec.ts`, plan 문서)은 `Read`/`git show`/`grep` 으로 저장소를 직접 열어
대조했다. 이 PR 은 이미 6차례 ai-review 를 거쳤고(`09_58_24`~`11_09_44`), 각 라운드의
`testing.md`/`RESOLUTION.md` 를 먼저 읽어 (a) 이전 라운드 지적이 이번 최신 커밋
(`2c9b490fd`, "고쳤다고 선언한 결함이 절반 경로에 남아 있었다")에서 실제로 해소됐는지,
(b) 근거와 함께 명시적으로 이월된 항목인지, (c) 아직 아무도 못 본 지점인지를 구분했다.
`terminal-duration.spec.ts` 의 신규 saturate 테스트는 `Math.min(span, PG_INT4_MAX)` →
`span` 으로 되돌리는 뮤테이션을 직접 적용해 실제로 RED 가 되는지 실측 후 원복했다
(방어가 아니라 "회귀를 잡는 테스트"임을 확인).

## 발견사항

- **[WARNING]** `emitCancellationEvent` 의 신규 JSDoc이 "호출부 4곳 모두 명시적으로 값을
  넘긴다" 고 검증을 선언했는데, 실제 호출부는 **5곳**이고 누락된 5번째(`finalizeCancelledExecution`)
  가 정확히 `durationMs` 가 테스트로 전혀 단언되지 않는 곳이다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1107-1112`
    (JSDoc 주장) — 실제 호출부 5곳: `:1077`(`cancelParkedExecution`), `:1210`
    (`markWebChatIdleTimeout`), `:2860`(`markExecutionCancelled`), `:2909`
    (`markQueueWaitTimeout`), `:4886`(`finalizeCancelledExecution`)
  - 상세: 이 JSDoc 은 이번 라운드가 조치했다고 보고한 "W6"(`11_09_44` documentation)의
    수정본이다 — 직전 문서가 "엔티티가 없으면 생략한다" 고 잘못 적었던 것을 "호출부 4곳
    모두 명시적으로 값을 넘긴다" 로 고쳤다. 그런데 실제로 `grep -n "emitCancellationEvent("`
    는 5개 호출부를 찾는다. `finalizeCancelledExecution`(엔티티 기로드 경로, raw UPDATE 4곳과
    구분되는 카테고리)이 그 다섯 번째다. 이 함수를 실제로 실행하는 테스트는 다수
    존재하지만(예: `execution-engine.service.spec.ts:6794-6798`, `:7353-7357`, `:11276`,
    `:11374`, `:11648`, `:13513` 의 `execution.cancelled` emit 단언) **어느 하나도
    `durationMs` 키를 검사하지 않는다** — 전부 `expect.objectContaining({ status: 'cancelled' })`
    수준에 그친다(`cancelledBy: 'user'` 리터럴로 이 경로를 특정해 검색해도 `cancelParkedExecution`
    테스트(`:3209`) 1건만 걸린다). 즉 "4곳 모두 검증됐다"는 이번 라운드의 문서 주장 자체가,
    검증되지 않은 다섯 번째 경로를 세는 데서 빠뜨렸다 — 이 세션이 반복 지적해 온 "green 이
    증거가 아니다"/"문서한 보장이 구현보다 넓다" 패턴이 이번엔 코드 주석 레벨에서 재현됐다.
  - 제안: JSDoc 을 "5곳"으로 정정하거나(사실 정정만으로도 가치가 있다), `finalizeCancelledExecution`
    을 exercise 하는 기존 테스트 중 하나(예: `:6794` 근방, Sub-Workflow 취소 시나리오)의
    `objectContaining` 에 `durationMs: expect.any(Number)` 를 추가해 실제로 값이 threading 되는지
    최소 1건이라도 고정할 것.

- **[WARNING]** `markWebChatIdleTimeout` 의 `EXECUTION_CANCELLED` emit 단언이 `durationMs`
  키를 전혀 검사하지 않는다 — 2라운드 전(`11_09_44`)이 "비용 낮음(objectContaining 에 키 하나
  추가)"이라고 명시했음에도 이번 커밋에서도 미반영, 게다가 plan 트래커에도 독립 항목으로
  옮겨지지 않았다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3054-3061`
    (`markWebChatIdleTimeout — affected:1 → true, ...` 테스트의 `emitSpy` 단언 —
    `objectContaining({ result: { cancelledBy: 'timeout' }, error: expect.objectContaining(...) })`
    에 `durationMs` 없음)
  - 상세: 이 raw-UPDATE 경로는 `TERMINAL_DURATION_MS_SQL` + `RETURNING` + `toFiniteNumber`
    추출까지 신규 로직 전부를 실제로 실행하는 테스트가 있다는 점에서 `markQueueWaitTimeout`
    (호출 자체가 안 됨)보다는 낫지만, 그 실행 결과가 emit 페이로드까지 올바르게 흘렀는지는
    이 테스트가 전혀 확인하지 못한다. `11_09_44` testing.md 가 "markWebChatIdleTimeout 도
    기존 objectContaining 에 durationMs 키를 추가하는 것만으로 충분(비용 낮음)" 이라고 구체적
    수정 방법까지 제시했고, 같은 라운드의 RESOLUTION 은 자매 항목 `markQueueWaitTimeout`
    (W4)만 트래커에 등재하고 이 항목은 별도 결정 없이 묵시적으로 드롭했다
    (`plan/in-progress/spec-sync-external-interaction-api-gaps.md:215` 체크박스는
    `markQueueWaitTimeout` 만 명명).
  - 제안: `execution-engine.service.spec.ts:3057` 의 `objectContaining` 에
    `durationMs: expect.any(Number)` 한 줄 추가. `installIdleTx` mock 이 이미
    `duration_ms` 를 raw 로 주는지 확인 필요(비어 있으면 `makeCancelQb` 류로 값 부여도 함께).

- **[INFO]** `markQueueWaitTimeout` 직접 호출 단위 테스트 부재 — 4라운드 연속 이월이지만,
  이번엔 처음으로 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 독립
  체크박스로 옮겨져 review 산출물에만 존재하던 유실 위험이 해소됐다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:215-216`
    (`markQueueWaitTimeout` 직접 호출 단위 테스트... `11_09_44` testing W4`)
  - 상세: `execution-engine.service.spec.ts:5112` 부근 유일한 관련 테스트는 `admitExecutionOrDefer`
    를 스텁해 `markQueueWaitTimeout` 본문을 한 번도 실행하지 않는다(주석 자체가 명시). 이
    경로는 다른 4개 raw-UPDATE 경로와 달리 `durationMs` 의미가 "실행 시간"이 아니라 "큐 대기
    시간"이라 대표 경로 검증으로 대체 증명되지 않는다는 지적은 여전히 유효하다. 다만
    "review/** 는 SoT 아님, 미룬 항목은 plan/ 에 적을 것"이라는 이 세션의 반복 교훈을 이번엔
    실제로 따랐으므로, 조치는 안 됐지만 **유실 위험은 닫혔다** — WARNING 에서 INFO 로 낮춘다.
  - 제안: 다음 편집 때 `mkQb`/`installTx` 재사용해 최소 1건 추가.

- **[INFO]** `terminal-duration.spec.ts` 에 int4 상한(`2147483647`)을 검증하는 테스트가
  두 곳에서 사실상 같은 사실을 다른 방식으로 중복 확인한다 — 문제는 아니고 기록용
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.spec.ts:76-79`
    (`'SQL 쌍둥이와 같은 상한 상수를 쓴다'` — `TERMINAL_DURATION_MS_SQL.toContain(String(PG_INT4_MAX))`)
    / `:144-146` (`'int4 상한으로 클램프한다'` — `.toContain('LEAST(2147483647')`)
  - 상세: 후자는 `PG_INT4_MAX` 상수를 참조하지 않고 리터럴 `2147483647` 을 하드코딩해서,
    상수 값이 바뀌면 두 테스트를 각각 손으로 갱신해야 한다(전자는 상수를 참조하므로 자동
    추종). 두 테스트가 겹치는 명제(SQL 문자열에 `2147483647` 이 들어있다)를 서로 다른
    신뢰 경로로 검증하는 셈이라 나쁘지 않지만, 리터럴 쪽을 `` `LEAST(${PG_INT4_MAX}` `` 로
    바꾸면 drift 표면이 하나 줄어든다.
  - 제안: 강제 아님. 다음 편집 때 리터럴을 상수 보간으로 교체 권장.

## 잘 된 점 (신규 확인)

- **CRITICAL 회귀(JS 클램프 누락)를 잡는 신규 테스트가 실제로 뮤테이션을 검출한다** —
  `resolveTerminalDurationMs` 의 `Math.min(span, PG_INT4_MAX)` 를 `span` 으로 되돌리고
  직접 실행해 `int4 상한을 넘으면 saturate 한다` 테스트가 정확히 RED 로 실패함을 확인했다
  (`Expected: 2147483647 / Received: 2147488647`) — 방어처럼 보이는 코드가 아니라 실제로
  작동하는 회귀 가드다. `SQL 쌍둥이와 같은 상한 상수를 쓴다` 테스트는 두 경로(JS/SQL)가
  같은 `PG_INT4_MAX` export 를 공유하도록 강제해, "한쪽만 고치는" 이 PR 자신의 반복 결함
  클래스(§CLAUDE.md 메모리 "방어의 정의를 한 칸 좁게 잡는다")를 구조적으로 막는다.
- **테스트 제목-커버리지 괴리(NaN/Infinity) 실제 해소** — `it.each([['NaN', NaN], ['Infinity', Infinity]])`
  로 전환해(`terminal-duration.spec.ts:81-92`), 2라운드째 미뤄졌던 지적이 이번엔 실제로
  반영됐다.
- 헬퍼 단위 테스트(`terminal-duration.spec.ts`, 이번 라운드 28 케이스)는 여전히 순수 함수
  테스트의 모범 사례 — 경계값(음수·0·Invalid Date·non-Date·상한 초과)·pg 드라이버 문자열
  숫자·SQL 상수 형태를 촘촘히 고정한다.
- `chat-channel.dispatcher.spec.ts`(외부 wire 변환 경계)·`retry-turn.service.spec.ts`
  (`durationMs: expect.any(Number)`, 실제 `Date` fixture 로 계산 분기를 실제로 태움)는
  이전 라운드 대비 변경 없이 안정적으로 유지되고 있다.

## 요약

이번 최신 커밋은 architecture 리뷰가 지적한 CRITICAL(SQL 경로만 클램프하고 JS 경로를
빼먹은 결함)을 `PG_INT4_MAX` 단일 export 로 정확히 고쳤고, 그 회귀를 실제로 잡아내는 테스트를
뮤테이션으로 직접 검증했다 — 이 라운드의 핵심 리스크는 실효성 있게 닫혔다. 다만 그 고침
과정에서 새로 쓴 JSDoc이 "호출부 4곳 모두 검증됐다"고 선언했는데 실제로는 5곳이고, 정확히
누락된 다섯 번째(`finalizeCancelledExecution`)와 그 이웃(`markWebChatIdleTimeout`)이
`durationMs` emit 검증이 비어 있는 자리다 — 둘 다 저비용 assertion 추가로 닫히는 gap 이고,
`markWebChatIdleTimeout` 쪽은 2라운드 전에 이미 구체적 해법까지 제시됐던 항목이 이번에도
드롭됐다. `markQueueWaitTimeout` 미테스트는 여전히 미해결이지만 이번엔 plan 트래커로 옮겨져
review 산출물 유실 위험이 닫혔으므로 심각도를 낮췄다. 전반적으로 핵심 회귀는 막혔고 남은
gap 은 전부 저비용·국소적이라 MEDIUM 으로 판정한다.

## 위험도

MEDIUM
