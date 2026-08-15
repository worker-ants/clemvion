# 유지보수성(Maintainability) Review — EIA 종결 이벤트 `durationMs` 배관 (4차 라운드, `10_52_08`)

## 방법론 노트

이 PR 은 이미 3차례 ai-review 라운드(`09_58_24`, `10_18_38`, `10_34_51`)를 거쳤고 그때마다
maintainability reviewer 가 독립적으로 점검해 매번 **LOW** 로 수렴했다. 이번 라운드는 (1) 직전
라운드(`10_34_51`) 이후의 실제 델타(커밋 `8a0c2348b` — "정규식이 대상 밖 8곳까지 바꾼 것" 되돌림 +
`chat-channel.dispatcher.spec.ts` 신규 회귀 테스트)를 소스에서 직접 재확인하고, (2) 이전 라운드가
지적·보류한 항목들이 현재 `HEAD` 에서도 같은 상태(개수·위치)로 유지되는지 `Read`/`grep` 으로
재검증했다. 프롬프트에서 크기 제한으로 생략된 `execution-engine.service.ts`/`.spec.ts` diff 는
`git diff origin/main --` 로 전문을 직접 열어 대조했다.

## 직전 라운드 이후 델타 검증

- **W2 되돌림(정규식 스코프 과잉) 확인** — `grep -n "nodeExec.*durationMs\s*="` 로 대조한 결과
  `nodeExecution.durationMs =`/`nodeExec.durationMs =` 8곳(`execution-engine.service.ts:4833,
  6042, 6162, 6195, 6213, 6227, 6303, 7941-7942`)은 전부 원래의 `finishedAt.getTime() -
  startedAt.getTime()` 무가드 뺄셈으로 되돌아가 있다 — `resolveTerminalDurationMs` 로 잘못
  전환됐던 흔적이 없다. EIA 종결 payload 대상(`row`/`execution`/`savedExecution`/`reloaded`)만
  헬퍼를 쓰고 노드별 실행시간(`nodeExecution`/`nodeExec`)은 건드리지 않는다는 스코프 경계가
  코드 레벨에서 정확히 지켜지고 있다.
- **`driveCallStackResume` 완료 경로(`10_18_38` side_effect WARNING) 재확인** —
  `execution-engine.service.ts:2576-2577`(계산)·`:2593`(emit) 둘 다 형제 5경로와 동일하게
  `resolveTerminalDurationMs` 를 거친다. 음수/NaN 가드 우회가 여전히 해소된 상태.
- **신규 `chat-channel.dispatcher.spec.ts` describe 블록** (`toChatChannelEvent — durationMs
  전파`) — CHANGELOG 가 breaking 으로 고지한 wire 경계에 회귀 테스트가 없었다는 갭을 메운
  것으로, 구조는 명확하다: `mk` 헬퍼 하나로 completed/failed/cancelled 세 상태를 매개변수화하고,
  `it.each` 로 숫자 3케이스 + 별도 `it` 으로 `null`/키부재 2케이스를 고정한다. 각 테스트가
  단일 단언(`durationMs` 필드 하나)만 검증해 읽기 쉽다.
  - **[INFO]** 다만 이 헬퍼는 `toChatChannelEvent({...} as unknown as ExecutionChannelEvent)`
    로 이벤트 객체를 캐스팅하는데, 같은 파일의 다른 30여 개 테스트는 전부
    `const event: ExecutionChannelEvent = {...}` 형태로 **캐스트 없이 직접 타입 지정**한다
    (예: `chat-channel.dispatcher.spec.ts:34, 66, 91, 117, ...`). 신규 헬퍼가 이 파일의 지배적
    로컬 컨벤션에서 벗어난 유일한 지점이다.
    - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` `mk` 헬퍼
      정의부(신규 `describe('toChatChannelEvent — durationMs 전파', ...)` 블록 상단)
    - 상세: `status` 별로 payload 형태가 갈리는 것을 `extra: object` 스프레드로 흡수하려다 보니
      엄격한 구조 타이핑을 만족시키기 어려워 `as unknown as` 로 우회한 것으로 보인다. 동작에는
      문제가 없고(테스트 자체는 통과), 파라미터화된 헬퍼가 필요했던 정당한 이유가 있다. 다만
      다음에 이 describe 블록을 확장하는 사람이 "이 파일은 캐스트를 쓰지 않는다"는 기존 규범과
      다른 예외를 마주치게 된다.
    - 제안: 필수 아님. 가능하면 `Partial<ExecutionChannelEvent>` 류의 더 좁은 타입으로
      `extra`를 받거나, 파일 상단에 한 줄 주석으로 "이 헬퍼만 캐스트를 쓰는 이유(파라미터화)"를
      남기면 다음 편집자의 혼동을 줄인다.

## 이전 라운드가 이미 근거와 함께 보류한 항목 — 현재도 동일 상태 (재차단 아님, 참고 기록만)

아래는 `10_18_38`/`10_34_51` 라운드가 이미 INFO 로 지적하고 `RESOLUTION.md` 에서 명시적 근거로
보류한 항목들이다. 이번 라운드에서 위치·개수를 재확인한 결과 **변동이 없다** — 새로운 악화도
없고 해소도 없다. 재차단 사유가 아니므로 그대로 링크만 남긴다.

- `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스의 5줄 설명 주석 3중
  복제 — `codebase/backend/src/modules/chat-channel/types.ts:392-396, 415-419, 433-437` (문자
  그대로 동일함을 `grep` 재확인).
- raw `RETURNING` 값 추출 스니펫(`toFiniteNumber((result.raw as ...)?.[0]?.duration_ms) ?? null`)
  이 5개 함수(`cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/
  `markQueueWaitTimeout`/`finalizeStalledExhausted`)에 verbatim 반복 — `09_58_24` RESOLUTION
  W5 가 "6번째가 생기면 재검토" 로 보류. `grep -n "toFiniteNumber("` 결과 여전히 정확히 5곳.
- `TERMINAL_DURATION_MS_SQL` 의 `LEAST(2147483647, …)` — int4 상한 매직 넘버가 SQL 리터럴 안에
  이름 없이 박혀 있음(`terminal-duration.ts:88`). 바로 위 JSDoc 과 spec 테스트가 의미를 설명해
  실질 위험은 낮음.
- `x.durationMs = resolveTerminalDurationMs(x) ?? x.durationMs;` 자기참조 폴백 관용구 + emit
  시점 동일 인자 재호출이 10곳 안팎 반복(계산부·emit부 쌍) — 의도("계산 실패 시 필드를 건드리지
  않는다")가 코드만 봐서는 즉시 드러나지 않지만, 성능·정확성 영향은 없음.
- (컨텍스트) `execution-engine.service.ts`(8,700줄대)·`.spec.ts`(19,700줄대)가 이미 매우 큰
  단일 파일 — 이 PR 은 구조를 바꾸지 않고 종결 경로 로직만 추가했다. 파일 분할은 이 PR 범위 밖.

## 요약

이번 라운드에서 새로 발견된 CRITICAL/WARNING 은 없다. 직전 라운드가 지적한 "정규식이 대상 밖
8곳까지 건드렸다"는 회귀는 소스 레벨에서 정확히 원상복구됐음을 확인했고(EIA 종결 payload
대상과 노드별 실행시간 표시용 코드 사이의 경계가 코드에 그대로 반영됨), `driveCallStackResume`
의 이전 방어 우회 문제도 해소된 채 유지되고 있다. 신규 추가된 dispatcher 회귀 테스트는 구조가
명확하고 세 상태 × 숫자/`null`/키부재를 빠짐없이 고정하며, 유일한 관찰점은 이 헬퍼가 파일의
지배적 컨벤션(캐스트 없는 직접 타입 리터럴)에서 벗어나 `as unknown as` 캐스트를 쓴다는 것인데
파라미터화 목적상 정당화되고 강제 조치 사항은 아니다. 그 외 남은 항목(주석 3중복, raw-returning
추출 5중복, SQL 매직 넘버, 자기참조 폴백 이중호출)은 세 라운드에 걸쳐 위치·개수가 그대로이며
전부 근거와 함께 명시적으로 보류된 상태라 재론할 이유가 없다. 핵심 로직(`resolveTerminalDurationMs`/
`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`)은 여전히 세 개의 작고 순수한 프리미티브로 잘
응집돼 있고, 함수 하나가 여러 책임을 떠안거나 조건문이 과도하게 중첩된 곳은 없다.

## 위험도

LOW
