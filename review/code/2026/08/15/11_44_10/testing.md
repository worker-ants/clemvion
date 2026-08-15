# 테스트(Testing) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (11_44_10)

## 방법론

프롬프트 번들이 6개 파일(execution-engine.service.ts/.spec.ts, terminal-duration.ts/.spec.ts 등)에서
크기 제한으로 diff 를 생략해, `git diff origin/main...HEAD` 로 실제 diff 를 직접 확보하고 `Read`/`grep -n`
으로 원본 파일 줄 번호를 대조했다. `markQueueWaitTimeout` 갭은 **뮤테이션으로 실증**했다 —
`toFiniteNumber(...)` 추출을 `toFiniteNumber(undefined)` 로 바꿔 이 경로의 `durationMs` RETURNING
threading 을 깨뜨린 뒤 관련 테스트(`큐 대기 5분 초과 → cancelled`)를 재실행했고, **여전히 GREEN** 이었다
(원복 후 재확인 완료, `git status`/`git diff --stat` clean).

## 발견사항

- **[WARNING]** `markQueueWaitTimeout` 의 `durationMs` RETURNING-threading 이 테스트로 전혀 검증되지 않는다 — 뮤테이션으로 실증
  - 위치: 구현 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2886`(`markQueueWaitTimeout`)
    ~`:2918`, 특히 `:2910-2914`(`toFiniteNumber((result.raw as ...)?.[0]?.duration_ms) ?? null`)
  - 위치: 테스트 `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4380`(`mkQb` 헬퍼,
    `execute` mock 이 항상 `raw: []`) / `:4534`(`it('큐 대기 5분 초과 → cancelled...')`, emit 단언에 `durationMs` 키 자체가 없음)
  - 상세: 형제 raw-UPDATE 경로 5곳 중 4곳(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·
    `finalizeStalledExhausted`)은 이번 라운드에서 `raw`에 `duration_ms` 를 채운 mock + 정확 매칭(`durationMs: 3600000` /
    `durationMs: 1234` / `durationMs: 4242`)으로 고정됐는데, `markQueueWaitTimeout` 만 `mkQb` 의 `execute` mock 이 여전히
    `raw: []` 를 고정 반환하고 해당 테스트의 emit 단언에도 `durationMs` 검사가 없다. `toFiniteNumber` 추출부를 통째로 깨는
    뮤테이션(`?.duration_ms` → `undefined`)을 넣고 `npx jest ... -t "큐 대기 5분 초과"` 를 돌려도 **여전히 통과**했다 —
    이 경로만 회귀 안전망이 없다는 뜻이다. 이 항목은 신규 발견이 아니라 직전 라운드 testing 리뷰(`09_58_24` W9/RESOLUTION
    W2)가 이미 지적했고, 같은 갭을 공유하던 `markWebChatIdleTimeout`/`markExecutionCancelled` 는 이번 라운드에 고쳤지만
    `markQueueWaitTimeout` 은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:215`에 "3라운드 이월"로
    다시 미루고 넘어갔다(사유: "이 경로만 값의 의미가 '큐 대기 시간' 이라 다른 4경로로 대체 증명되지 않는다" — 정확한
    지적이지만, 대체 증명이 안 된다는 것이 곧 **이 경로 자체의 커버리지가 필요하다**는 뜻이다).
  - 제안: `mkQb(1)` 이 `raw: [{ id: 'e3', duration_ms: <N> }]` 를 돌려주게 하고, 4534행 단언에
    `durationMs: <N>` 을 정확 매칭으로 추가한다. 형제 4곳과 동일 패턴이라 비용은 낮다(추정 5줄 내외).

- **[INFO]** `cancelParkedExecution` 은 `durationMs` 의 **null 분기만** 테스트되고, RETURNING 이 값을 돌려주는 분기는 미검증
  - 위치: 구현 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1023`(`cancelParkedExecution`)
    ~`:1049`
  - 위치: 테스트 `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3168`(`makeCancelQb`,
    `execute` mock 이 `raw` 필드 자체를 안 줌 → `result.raw` 는 `undefined`) / `:3192`(단언 `durationMs: null`)
  - 상세: `toFiniteNumber`/`resolveTerminalDurationMs` 공용 헬퍼 레벨에서는 양수 값 처리가 충분히 커버되고, 형제 경로
    (`markWebChatIdleTimeout`/`markExecutionCancelled`/`finalizeStalledExhausted`)가 양수 threading 을 각각 고정하므로
    회귀 위험은 낮다. 다만 `cancelParkedExecution` 자신에 한정하면 "RETURNING 이 실제로 값을 줬을 때 그 값이 그대로
    나가는지"는 이 함수의 테스트만으로는 증명되지 않는다.
  - 제안: 우선순위 낮음(공용 로직 재확인 성격). 필요 시 `makeCancelQb(1)` 에도 `raw` 를 채우는 변형을 하나 추가.

- **[INFO]** `TERMINAL_DURATION_MS_SQL` 은 문자열 `toContain` 단언뿐 — 실제 Postgres 값 검증 없음 (이미 트래커 등재, W10)
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.spec.ts` `describe('TERMINAL_DURATION_MS_SQL', ...)` 블록
    (예: `TERMINAL_DURATION_MS_SQL).toContain('LEAST(2147483647'`, `.not.toContain('GREATEST(0'`)
  - 상세: `EXTRACT(EPOCH FROM ...)`, `::timestamptz` 캐스팅, 파라미터 바인딩 이름 일치처럼 DB 엔진에서만 검증 가능한
    문법·타입 오류는 이 단위 테스트가 못 잡는다. 이 SQL 을 실제로 태우는 유일한 e2e(`webchat-idle-reaper.e2e-spec.ts`)도
    `duration_ms` 값 자체를 assert 하지 않는다. 다만 이 갭은 이미 `RESOLUTION.md` W10 및
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:232-237`("e2e 에 `duration_ms >= 0` sanity 단언
    추가")에 명시적으로 등재·유예됐다 — 새 발견이 아니라 추적 상태 재확인.
  - 제안: 기존 트래커 항목 유지. 이번 PR 범위에서 추가 조치 불필요.

- **[INFO]** `chat-channel.dispatcher.spec.ts` 의 null/레거시-키 테스트가 `'completed'` 상태만 커버
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` (신규
    `describe('toChatChannelEvent — durationMs 전파', ...)` 블록의 `'null 을 그대로 싣는다'`, `'레거시(키 부재) 이벤트도
    깨지지 않는다'` 두 케이스 — 둘 다 `mk('completed', ...)` 만 호출)
  - 상세: 숫자 값 threading 은 `it.each`로 `completed`/`failed`/`cancelled` 세 상태 모두 커버했지만, `null`/키-부재
    분기는 `completed` 만 검증한다. `toChatChannelEvent` 의 세 case 분기가 `(event.payload as {durationMs?: number |
    null}).durationMs` 로 동일 캐스팅 패턴이라 실질 회귀 위험은 낮으나, 세 case 는 서로 다른 스위치 분기라 완전성
    관점에서는 갭이다.
  - 제안: `it.each` 를 status 축으로도 파라미터화하면 비용 없이 닫힌다. 낮은 우선순위.

## 잘 된 점 (회귀 방지 관점에서 특기할 만함)

- `terminal-duration.spec.ts` 의 `resolveTerminalDurationMs`/`toFiniteNumber` 순수 함수 테스트는 경계값이 촘촘하다:
  `startedAt`/`finishedAt` 각각 부재, 둘 다 부재, `Date` 아닌 값, `Invalid Date`, 시계 역행(음수), int4 상한 초과
  saturate, `NaN`/`Infinity` durationMs 폴백, `durationMs: 0` falsy 오분류 방지(`??` vs `||`)까지 모두 개별 케이스로
  고정돼 있다. 이 PR 이 실제로 겪은 두 회귀(SQL 만 클램프하고 JS 를 빠뜨림, `startedAt.getTime()` throw 로 종결 emit
  자체가 사라짐)를 각각 전용 테스트로 캐너리 처리한 것도 좋다.
- `markWebChatIdleTimeout`/`finalizeStalledExhausted`/`markExecutionCancelled`(2 호출부)는 이번 라운드에 `raw`
  mock 을 채우고 `objectContaining` 대신 정확 매칭으로 전환해, 직전 라운드 testing 리뷰가 지적한 "느슨한 단언이
  threading 버그를 숨긴다" 패턴을 실제로 닫았다(`execution-engine.service.spec.ts:3054-3062`,
  `:4830-4833`, `:14997`, `:16398` 부근).
- `retry-turn.service.spec.ts` 의 `expect.any(Number)` 단언들은 fixture 에 `startedAt`이 항상 채워져 있어
  vacuous 하지 않다 — `resolveTerminalDurationMs` 가 fallback 으로 `null`(→ 이전 `durationMs`, 보통 `undefined`)을
  돌려주면 `expect.any(Number)` 자체가 실패하므로 실제로 값 계산 경로를 태우는지 검증한다.
- 테스트 mock 확장(`.setParameter`/`.returning` 을 수십 개 query-builder 리터럴에 추가)은 실제 프로덕션 호출
  지점(5곳)보다 넓어 보이지만, `createQueryBuilder` 의 파일 전역 기본 mock 구조상 불가피한 파급이며 scope 이탈이
  아니다(별도 scope 리뷰가 실측 완료).
- 테스트 격리: `mockWorkflowRepo.findOne.mockClear()` 처럼 이전 테스트의 누적 호출을 명시적으로 격리하는 패턴이
  유지되고 있고, 신규 추가 테스트들이 독립된 `describe`/헬퍼로 구성돼 순서 의존성을 새로 만들지 않았다.

## 요약

핵심 순수 로직(`resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL` 문자열 형태)은 경계값을
꼼꼼히 커버하는 양질의 테스트를 갖췄고, raw-UPDATE 5경로 중 4곳(`cancelParkedExecution`은 null 분기만·
`markWebChatIdleTimeout`·`markExecutionCancelled`·`finalizeStalledExhausted`)은 이번 라운드에 정확 매칭으로
`durationMs` threading 을 제대로 고정했다. 다만 **`markQueueWaitTimeout` 하나만은 여전히 무방비**다 — 뮤테이션으로
직접 확인한 결과, 이 경로의 `RETURNING` 추출 로직을 통째로 깨도 기존 테스트는 GREEN 을 낸다. 이 갭은 직전 라운드
testing 리뷰가 형제 3곳과 함께 지적했던 것인데 이번에 2곳만 닫히고 이 한 곳만 다시 트래커로 이월됐다 — "형제 함수
전수 적용" 원칙에서 한 곳이 새어나간 형태다. `TERMINAL_DURATION_MS_SQL` 의 실 DB 미검증은 이미 별도 트래커(W10)에
등재돼 있어 반복 지적은 아니고 현황 재확인 성격이다. CRITICAL 급 결함은 없다.

## 위험도

MEDIUM
