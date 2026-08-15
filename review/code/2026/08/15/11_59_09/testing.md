STATUS=success

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (8차 라운드)

## 방법론

이 changeset 은 같은 PR 이 오늘 이미 7차례(`09_58_24`~`11_44_10`) 리뷰·수정을 거친 누적 diff 다.
프롬프트 diff 가 큰 파일(`execution-engine.service.ts`/`.spec.ts`)에서 예산 초과로 생략되어,
`git diff origin/main -- <path>` 로 각 파일을 직접 열어 최신 상태를 대조했다. 특히 이전
라운드들이 반복해서 지적·수정한 "vacuous mock"(RETURNING 값을 mock 이 안 줘서 threading 이
실제로 검증되지 않는) 클래스가 이번 diff 의 **모든** raw-UPDATE 경로에 실제로 해소됐는지
전수 확인했다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 테스트 관련
트래커 항목도 최신 커밋과 대조했다.

## 발견사항

- **[WARNING]** `cancelParkedExecution` 의 `RETURNING duration_ms` 추출 로직이 여전히 vacuous 하게만 테스트된다 — 이 라운드가 자매 4곳(`markWebChatIdleTimeout`/`markQueueWaitTimeout`/`markExecutionCancelled`/`finalizeStalledExhausted`)에서 반복 수정한 것과 **같은 결함 클래스**가 한 곳 남아 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `makeCancelQb` 헬퍼(describe `cancelParkedExecution — durable WAITING cancel (W10)` 안, `execute: jest.fn().mockResolvedValue({ affected })`)와 그 assertion `durationMs: null`
  - 상세: `cancelParkedExecution`(`execution-engine.service.ts`, `cancelledDurationMs = toFiniteNumber((result.raw as ...)?.[0]?.duration_ms) ?? null` 코드)은 구조적으로 `markWebChatIdleTimeout`(같은 파일, 동형 코드)과 완전히 동일한 raw-UPDATE + RETURNING 패턴을 쓴다. 그런데 `markWebChatIdleTimeout` 쪽 mock(`makeIdleQb`)은 이번 라운드에 `raw: affected > 0 ? [{ id: 'exec-idle', duration_ms: 3600000 }] : []` 로 바뀌어 `durationMs: 3600000` 정확 매칭을 검증하는 반면, `cancelParkedExecution` 쪽 mock(`makeCancelQb`)은 `execute: jest.fn().mockResolvedValue({ affected })` 로 `raw` 를 아예 주지 않는다. `cancelledDurationMs` 의 초기값이 `let cancelledDurationMs: number | null = null;` 이므로, `toFiniteNumber(...)` 추출 코드를 통째로 지워도(또는 잘못된 키를 읽어도) `cancelledDurationMs` 는 여전히 `null` 로 남고, 현재 유일한 테스트의 assertion(`durationMs: null`)은 그대로 통과한다 — 즉 이 assertion 은 "정확 매칭"이지만 **초기값과 우연히 같은 값**을 검증하는 것이라 추출 로직의 회귀를 잡지 못한다. 이 세션이 `10_18_38` W2 에서 "cancelParked·finalizeStalled 은 정확 매칭으로 고정돼 패턴 자체는 검증됐다"고 판단했으나, `finalizeStalledExhausted` 는 이후 `duration_ms: 4242`(0 이 아닌 실값)로 검증되도록 바뀐 반면 `cancelParkedExecution` 은 그 갱신에서 누락됐다 — 즉 그 판단은 이제 이 한 곳에서만 더 이상 성립하지 않는다.
  - 제안: `makeCancelQb` 의 Execution UPDATE 쪽에 `raw: affected > 0 ? [{ id: 'exec-park-1', duration_ms: <값> }] : []` 를 주고, `affected:1` 케이스의 assertion 을 `durationMs: <같은 값>` 으로 바꿔 실제 threading 을 정확 매칭으로 고정한다(형제 4경로와 동형).

- **[WARNING]** plan 트래커가 이미 해소된 테스트 갭을 여전히 미해결로 기재 — 트래커 신뢰도 저하
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:217` (`- [ ] \`markQueueWaitTimeout\` 직접 호출 단위 테스트 (3라운드 이월). 이 경로만 값의 의미가 "큐 대기 시간" 이라 다른 4경로로 대체 증명되지 않는다 (\`11_09_44\` testing W4)`)
  - 상세: 이 항목은 커밋 `2c9b490fd`(`11_09_44` 라운드)에서 등재됐다. 그런데 바로 다음 커밋 `777698bbe`(`11_44_10` 라운드, 커밋 메시지: *"W1 — \`markQueueWaitTimeout\` 의 threading 이 추출부를 통째로 깨는 뮤테이션에도 GREEN 이었다 ... mock 에 duration_ms: 600000 을 주고 정확 매칭으로 고정"*)가 정확히 이 항목을 해소했다 — 실측으로 `execution-engine.service.spec.ts` 의 `mkQb`(admission `PR2b §8` describe)가 현재 `raw: affected > 0 ? [{ id: 'e3', duration_ms: 600000 }] : []` 를 주고 `durationMs: 600000` 정확 매칭을 검증한다. `777698bbe` 는 같은 plan 파일도 수정했지만(다른 섹션의 취소선 W4 만) 이 line 217 은 갱신하지 않고 그대로 남겨졌다. "3라운드 이월" 이라는 문구와 `[ ]` 상태가 실제 코드 상태와 어긋난다.
  - 제안: 해당 항목을 `[x]` 로 갱신하고 `777698bbe` 를 완료 커밋으로 인용. (이번 라운드에서 위 첫 항목이 새로 지적하는 `cancelParkedExecution` 갭과 혼동되지 않도록 별개로 명시할 것.)

- **[INFO]** `retry-turn.service.spec.ts` 의 다수 `durationMs` assertion 이 `expect.any(Number)` 를 쓴다 — `NaN` 도 통과시키는 약한 단언
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:691,727,858,894`
  - 상세: `expect.any(Number)` 는 `typeof value === 'number'` 만 확인하므로 `NaN`(`typeof NaN === 'number'`)도 통과한다. `resolveTerminalDurationMs` 자체의 `NaN`/`Infinity` 방어는 `terminal-duration.spec.ts` 에서 별도로 견고하게 고정돼 있고, 이 파일의 fixture 는 항상 실제 `new Date(...)` 값을 쓰므로(예: `startedAt: new Date(Date.now() - 60_000)`) 실무상 `NaN` 이 나올 경로는 없다 — 다만 같은 파일 안의 `failRetryExecution`/`completeRetryExecution` 테스트(`:1113-1116`, `:1185-1188`)는 "이번 시도의 실제 값" 을 관계식(`setArg.durationMs === setArg.finishedAt.getTime() - execArg.startedAt.getTime()`)으로 정확히 고정하는 더 강한 패턴을 이미 쓰고 있어, 남은 4곳(CANCELLED/COMPLETED emit)만 상대적으로 약하다.
  - 제안: 저비용이므로 강제하지 않음. 여유가 있으면 동일한 관계식 패턴으로 통일하거나 최소 `expect(x).not.toBeNaN()` 추가.

## 확인 결과 (이전 라운드 지적의 실제 해소 검증)

- **`terminal-duration.spec.ts` 엣지 케이스 커버리지 — 우수.** `startedAt`/`finishedAt` 부재 4종(it.each), `Date` 아닌 값, `Invalid Date`, 시계 역행(음수), int4 상한 saturate, `durationMs` 가 이미 있을 때 재계산하지 않음, `NaN`/`Infinity` 폴백(`11_09_44` W5 가 지적한 "제목은 NaN/Infinity 인데 NaN 만 실행" 결함이 `it.each` 분리로 실제 해소됨), `durationMs === 0`(falsy 트랩) 등을 전부 개별 테스트로 고정했다. `toFiniteNumber` 도 숫자/문자열/null/undefined/공백/NaN/객체를 모두 커버한다.
- **`TERMINAL_DURATION_MS_SQL` literal-vs-상수 drift(11_44_10 maintainability INFO) — 해소 확인.** `terminal-duration.spec.ts` 의 `int4 상한으로 클램프한다` 테스트가 현재 `` `LEAST(${PG_INT4_MAX}` `` 로 보간되어 있다(이전 라운드가 지적한 `'LEAST(2147483647'` 하드코딩 리터럴이 남아 있지 않음).
- **`chat-channel.dispatcher.spec.ts` 신규 `durationMs 전파` describe — 양호.** 3개 종결 상태 × 숫자(`it.each`), 명시적 `null`, 레거시 키-부재(`toBeUndefined`) 를 분리해 "부재"와 "null"을 혼동하지 않고 각각 정확히 단언한다.
- **`markWebChatIdleTimeout`/`markQueueWaitTimeout`/`markExecutionCancelled`/`finalizeStalledExhausted` — 전부 mock 이 `raw` 에 실값을 주고 exact-match 로 threading 을 검증** (`3600000`/`600000`/`1234`/`4242`). 과거 라운드가 반복 지적한 vacuous-mock 클래스가 이 4곳에서는 실제로 닫혔다.
- **completed 경로 다수(6+2)의 `durationMs: expect.any(Number)` 단언** — 값 자체는 약하지만, `resolveTerminalDurationMs` 의 순수 로직은 헬퍼 스펙에서 이미 견고하게 커버되므로 emit 배선(threading) 확인 목적으로는 수용 가능한 수준.

## 요약

8차 누적 라운드 시점 기준, 이 PR 의 테스트 커버리지는 이미 매우 촘촘하다 — 특히 "mock 이 RETURNING 경로를 실제로 태우는지" 클래스의 결함을 4개 경로(`markWebChatIdleTimeout`/`markQueueWaitTimeout`/`markExecutionCancelled`/`finalizeStalledExhausted`)에서 라운드를 거치며 반복 발견·수정해 정확 매칭으로 고정했다. 다만 그 수정이 구조적으로 동일한 5번째 경로 `cancelParkedExecution` 까지는 확산되지 않아, 그 함수의 `RETURNING duration_ms` 추출 로직만 유일하게 여전히 vacuous 하게(초기값 `null` 과 우연히 일치하는 assertion 으로) 테스트되고 있다 — 프로덕션 코드 자체는 정상으로 보이나, 향후 이 경로의 추출 로직이 깨져도 현재 테스트로는 감지되지 않는다. 또한 plan 트래커(`spec-sync-external-interaction-api-gaps.md:217`)가 이미 해소된 `markQueueWaitTimeout` 테스트 갭을 여전히 "3라운드 이월" 로 기재해, 테스트 상태에 대한 문서와 코드가 어긋나 있다. 그 외 헬퍼(`terminal-duration.spec.ts`)와 dispatcher 테스트는 null-vs-키부재 구분, 경계값, drift 방지까지 잘 다뤄져 있고, retry-turn 쪽의 `expect.any(Number)` 사용은 실무상 위험이 낮은 약한 단언 수준의 INFO 다.

## 위험도

LOW
