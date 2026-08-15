# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `driveCallStackResume` 완료 경로가 새 `durationMs` 방어(음수 클램프·타입 가드)를 형제 5경로와 다르게 우회한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 함수 `driveCallStackResume` — 계산부 2576~2578행, emit 부 2594행 (Read 로 직접 확인한 소스 줄 번호. 이 파일은 diff 가 프롬프트에서 생략돼 게이트가 없다)
  - 상세: 이 PR 은 `terminal-duration.ts` 의 `resolveTerminalDurationMs()` 를 도입해 "완료" 6경로 중 `driveResumeAwaited`·`runExecution`(2곳)·`resumeGraphAfterRetry`·재로드(`reloaded`) 경로에서 계산부(write)를 `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` 형태로 통일했다(2413, 3565, 4295, 4755행 확인). 그런데 같은 "완료" 그룹인 `driveCallStackResume` 만 계산부가 옛 형태 그대로다:
    ```
    2576: savedExecution.durationMs =
    2577:   savedExecution.finishedAt.getTime() -
    2578:   savedExecution.startedAt.getTime();
    ```
    이후 2594행의 emit 은 `resolveTerminalDurationMs(savedExecution)` 을 호출하지만, 이 함수는 `row.durationMs` 가 이미 `number` 이고 `Number.isFinite` 면 **부호·범위 검사 없이 그 값을 그대로 반환**한다(`terminal-duration.ts` 33~35행). 즉 신선 계산(음수 → `null`) 경로의 방어는 `startedAt`/`finishedAt` 로부터 **새로 계산할 때만** 적용되고, 이미 채워진 `durationMs` 를 그대로 읽는 경우엔 적용되지 않는다. `driveCallStackResume` 는 바로 이 "이미 채워진 값을 그대로 읽는" 쪽에 해당하므로, 시계 역행(음수 span)이 발생하면 이 경로만 `null` 대신 **음수 `durationMs` 를 그대로 wire 로 내보낸다** — `terminal-duration.ts` 자신의 문서화된 불변식("시계 역행(음수)은 null — 수신자의 산술이 깨진다")과 이 PR 이 다른 5경로·SQL 경로(`TERMINAL_DURATION_MS_SQL` 의 `THEN NULL`)에서 일관되게 지킨 규약을 이 경로만 어긴다.
    부수적으로, 이 경로는 여전히 `savedExecution.startedAt.getTime()` 을 무가드로 직접 호출한다 — 이 PR 의 동기가 된 실제 회귀("조건 블록 밖으로 옮긴 계산이 `startedAt.getTime()` 에서 throw 해 종결 emit 자체가 사라졌다", `terminal-duration.ts` 17~23행 docblock)와 같은 클래스의 위험이 이 지점엔 여전히 남아 있다(이 자리 자체는 이 PR 이전부터 무조건 블록이었으므로 "새로 악화"는 아니지만, PR 이 "종결 3종 전부/6경로 전부 O" 라고 선언한 커버리지 주장과는 어긋난다).
    실측: `grep -n "resolveTerminalDurationMs("` 로 세면 완료류 write 지점 6곳 중 5곳(2413/3565/4295/4755/4883/4944 — cancel/fail 포함)만 헬퍼를 거치고, 2576~2578 만 원본 뺄셈이다. `execution-engine.service.spec.ts` 의 `driveCallStackResume` 테스트 블록(16179~16810행)에도 `durationMs` 단언이 없어(grep 0건) 이 경로는 새 필드에 대한 테스트 커버리지도 없다.
  - 제안: `driveCallStackResume` 의 2576~2578행도 형제 경로와 동일하게 `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` 로 바꿔 음수·NaN 가드를 일관되게 적용한다. 또한 `driveCallStackResume` 완료 emit 에 대한 `durationMs` 단언(양수·null 양쪽 케이스)을 스펙에 추가해 이 경로가 형제 경로와 같은 계약을 지킴을 고정한다.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent.durationMs` 타입 확장(`number?` → `number | null | undefined`)이 기존 소비 코드의 stale 캐스트 타입과 어긋난다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:534,571,587` (이 PR 의 diff 대상은 아니지만 `types.ts` 인터페이스 변경의 실제 소비자)
  - 상세: `types.ts` 변경(파일 2)으로 세 인터페이스의 `durationMs` 가 `number | null` 을 받아들이게 됐다. 그런데 `chat-channel.dispatcher.ts` 는 여전히 `(event.payload as { durationMs?: number }).durationMs` 로 **좁은 타입**을 캐스팅해 값을 그대로 통과시킨다. 컴파일은 통과하고(캐스트값을 `number|null|undefined` 필드에 대입하는 것 자체는 안전), 런타임에도 값이 그대로 흘러가므로 기능적 결함은 아니다. 다만 이 캐스트 타입 주석이 실제 계약(이제 `null` 가능)보다 좁아 다음에 `durationMs` 를 이 dispatcher 안에서 산술·타입판별(`typeof x === 'number'`) 로 다루는 코드가 추가될 때 `null` 케이스를 놓칠 함정이 남는다.
  - 제안: 캐스트 타입을 `{ durationMs?: number | null }` 로 맞춰 놓거나, 가능하면 `types.ts` 의 인터페이스를 직접 import 해 캐스팅 자체를 없앤다.

- **[INFO]** 신설 함수/상수(`resolveTerminalDurationMs`, `toFiniteNumber`, `TERMINAL_DURATION_MS_SQL`, `TERMINAL_FINISHED_AT_PARAM`)와 `emitCancellationEvent` 의 시그니처 확장(`durationMs?: number | null` 추가)은 side-effect 관점에서 안전
  - 상세: 새 유틸 함수들은 순수 함수(전역·파일시스템·네트워크 접근 없음)다. `emitCancellationEvent` 는 `private` 메서드이고 새 옵션 필드는 optional + 헬퍼 내부에서 `opts.durationMs ?? null` 로 기본값 처리하므로, 값을 넘기지 않는 호출부가 있어도 깨지지 않는다(실측: 클래스 내 5개 호출부 전부 이번에 `durationMs` 를 채워 넘기지만, 넘기지 않아도 안전한 설계). raw UPDATE 5경로에 `.returning([...])` 을 확장한 것도 같은 트랜잭션 안의 부작용이라 새로운 외부 부작용을 만들지 않는다.

## 요약

핵심 위험은 하나다 — `driveCallStackResume` 완료 경로가 이 PR 이 다른 5개 형제 완료 경로에 일관되게 적용한 `resolveTerminalDurationMs` 계산-측 가드(음수/NaN → `null`)를 우회한다. emit 시점에 같은 헬퍼를 호출하긴 하지만, 이미 채워진 유한수는 그대로 통과시키는 헬퍼의 설계상 이 경로만 "시계 역행 시 null" 불변식을 어길 수 있다 — 이 저장소가 반복해서 겪어 온 "하드닝을 자매 함수에 미적용" 패턴의 재발이다. 나머지 변경(raw UPDATE RETURNING 확장, `emitCancellationEvent` optional 필드 추가, `types.ts` nullable 확장)은 optional 필드·순수 함수·트랜잭션 내부 부작용으로 범위가 잘 통제되어 있고 외부 소비자에 대한 영향(payload 필드 추가, `null` 방어 필요)도 CHANGELOG/plan 에 명시적으로 문서화돼 있다.

## 위험도

MEDIUM
