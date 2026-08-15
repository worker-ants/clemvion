# 유지보수성(Maintainability) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (5차 라운드, `11_09_44`)

## 방법론 노트

이 PR 은 이미 4차례 ai-review 라운드(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`)를 거쳤고 매번
maintainability reviewer 가 **LOW** 로 수렴했다. 프롬프트에서 크기 제한으로 diff 가 생략된
`execution-engine.service.ts`/`.spec.ts`/`plan/**` 는 `git diff origin/main --` 로 전문을 직접
열어 대조했고, `types.ts`/`terminal-duration.ts` 등 인용 대상은 `Read`/`grep` 으로 현재 `HEAD`
(`bd611be81`, 직전 라운드 이후 유일한 델타 — `execution-engine.service.spec.ts` 단언 2건 추가)의
실제 줄 번호와 대조해 확정했다. 이전 라운드가 이미 근거와 함께 명시적으로 보류한 항목은 위치·개수
변동 여부만 재확인하고 등급을 재상향하지 않았다(재론 자체가 목적이 아님).

## 발견사항

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스에 동일한 5줄
  설명 주석이 문자 그대로 3중 복제돼 있다
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-396`, `:415-419`, `:433-437`
    (세 블록 모두 `// EIA §6 — producer 는 **항상** 이 키를 싣고 …` 로 시작해 마지막 줄까지 동일)
  - 상세: 세 필드(`durationMs?: number | null`)의 타입은 완전히 동일한데(에러 필드처럼 인터페이스별
    shape 이 갈리지 않는다), 그 "왜 optional 을 유지하는가"라는 근거 주석이 손으로 3벌 복사돼
    있다. 이 저장소는 바로 이웃한 `error` 필드에 대해서는 이미 이런 드리프트를 막으려고
    `TerminalErrorPayload` 라는 공유 인터페이스를 별도 파일(`terminal-error-payload.ts`)로
    추출한 선례가 있다 — 같은 처방을 `durationMs` 에는 적용하지 않았다. 4개 라운드에 걸쳐 위치·
    문구가 그대로임을 재확인했다(신규 악화 없음).
  - 제안: `type EiaTerminalDurationMs = number | null;` 류의 명명 타입 별칭에 주석을 한 번만
    달고 세 인터페이스가 `durationMs?: EiaTerminalDurationMs;` 로 참조하면, 다음에 이 근거가
    바뀔 때(예: optional 정책 재검토) 한 곳만 고치면 된다. 강제 조치 아님 — 세 라운드 동안
    반복 확인만 됐을 뿐 실제 drift(세 곳이 서로 달라진 사례)는 아직 없다.

- **[INFO]** raw `RETURNING` 값 추출 스니펫이 5개 함수에 verbatim 반복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1046`
    (`cancelParkedExecution`), `:1181`(`markWebChatIdleTimeout`), `:2860`
    (`markExecutionCancelled`), `:2909`(`markQueueWaitTimeout`), `:3362`
    (`finalizeStalledExhausted`)
  - 상세: 다섯 곳 모두
    `toFiniteNumber((result.raw as Array<Record<string, unknown>> | undefined)?.[0]?.duration_ms) ?? null`
    형태의 3-4줄 캐스팅+추출 코드를 그대로 복제한다. `09_58_24` RESOLUTION.md 의 W5 가 이미
    "QueryBuilder 체인이라 얇은 헬퍼로 감싸면 오히려 호출부가 읽기 어려워진다. 6번째가 생기면
    재검토"로 명시적으로 보류한 항목이다. `grep -n "toFiniteNumber("` 로 재확인한 결과 지금도
    정확히 5곳 — 6번째는 생기지 않았다.
  - 제안: 현 상태 유지로 충분(이미 근거 있는 결정). 다음에 raw UPDATE 종결 경로가 추가되면
    그때 `extractReturningDurationMs(result)` 같은 작은 헬퍼로 승격을 재검토할 것.

- **[INFO]** `resolveTerminalDurationMs(x)` 자기참조 폴백(`x.durationMs = resolveTerminalDurationMs(x) ?? x.durationMs`) 직후 동일 인자로 재호출하는 관용구가 completed 경로 다섯 곳 + retry-turn 한 곳에 반복
  - 위치: `execution-engine.service.ts:2413`(대입)/`:2424`(재호출), `:2577`/`:2593`,
    `:3564`/`:3575`, `:4754`/`:4767`, `:4882`/`:4886`, `:4943`/`:4965`;
    `retry-turn.service.ts:895`/`:907`
  - 상세: 계산부에서 이미 확정한 `savedExecution.durationMs`(또는 `execution.durationMs`)를
    몇 줄 뒤 emit payload 에서 같은 인자로 `resolveTerminalDurationMs` 를 다시 호출해 사실상
    같은 값을 재계산한다. 함수 자체가 O(1) 순수 함수라 실질 비용은 무시할 수준이지만, 읽는
    사람 입장에서 "왜 두 번 부르는가"(계산 실패 시에도 필드를 건드리지 않기 위한 의도)가
    코드만 봐서는 바로 드러나지 않는다. 이전 라운드가 이미 지적·보류했고 이번 라운드도 개수·
    위치 동일함을 확인했다.
  - 제안: `durationMs: savedExecution.durationMs` 로 확정된 필드를 직접 참조하거나, 짧은 주석
    한 줄("계산 실패 시에도 필드를 덮어쓰지 않기 위해 재호출")을 emit 지점에 남기면 다음
    편집자의 의문을 줄인다. 우선순위 낮음.

- **[INFO]** `TERMINAL_DURATION_MS_SQL` 안의 `LEAST(2147483647, …)` 은 이름 없는 정수 리터럴이다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:88-89`
  - 상세: `int4` 상한(2^31-1)이 SQL 문자열 리터럴 안에 그대로 박혀 있다. 다만 바로 위 JSDoc
    (`:74-79`)이 "`duration_ms` 는 `INTEGER`(int4, 최대 ≈24.8일), `V001__initial_schema.sql:223`"
    라고 출처·단위·근거를 정확히 설명하고, `terminal-duration.spec.ts:125-127`도 이 값을
    `TERMINAL_DURATION_MS_SQL` 문자열 검사로 고정한다. 전형적인 "의미를 알 수 없는 매직
    넘버"와는 다르다(주석+테스트가 이미 문서화 역할을 함).
  - 제안: 선택적으로 `Number.MAX_SAFE_INTEGER`류가 아닌 `2 ** 31 - 1` 표현식이나 named
    export(`const INT4_MAX = 2147483647`)로 바꾸면 리터럴이 스스로 의미를 드러내지만, 문자열
    SQL 안에 삽입해야 하는 특성상(`String(2 ** 31 - 1)` 로 다시 문자열화) 실익이 크지 않다.
    강제 사항 아님.

- **[INFO]** `chat-channel.dispatcher.spec.ts` 신규 `mk` 헬퍼가 파일의 지배적 로컬 컨벤션(캐스트
  없는 직접 타입 리터럴)에서 벗어나 `as unknown as` 캐스트를 쓴다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:387`
    (`} as unknown as ExecutionChannelEvent);`) — 신규 `describe('toChatChannelEvent —
    durationMs 전파', ...)` 블록의 `mk` 헬퍼 정의부
  - 상세: 같은 파일의 다른 30여 개 테스트는 전부 `const event: ExecutionChannelEvent = {...}`
    형태로 캐스트 없이 직접 타입을 지정한다(예: `:34, 66, 91, 117, 141, 154, 169, 201, 295,
    315`). 신규 헬퍼는 `status` 별로 payload 형태가 갈리는 것을 `extra: object` 스프레드로
    흡수하려다 보니 구조 타이핑을 만족시키기 어려워 `as unknown as` 로 우회했다. 동작에는
    문제 없고 테스트도 통과하지만, 파라미터화된 헬퍼가 이 describe 블록에 한정된 유일한
    캐스트 예외라는 사실이 다음 확장자에게는 낯설 수 있다. 4차 라운드가 이미 지적했고 위치·
    형태 그대로 유지된다.
  - 제안: 필수 아님. `Partial<ExecutionChannelEvent>` 류의 더 좁은 타입으로 `extra` 를 받거나,
    헬퍼 정의 바로 위에 "이 헬퍼만 캐스트를 쓰는 이유" 한 줄을 남기면 충분하다.

## 그 외 확인 결과 (문제 없음으로 판정)

- **신규 파일 `terminal-duration.ts`/`terminal-duration.spec.ts`** — `resolveTerminalDurationMs`
  /`toFiniteNumber` 는 각각 단일 책임의 순수 함수(분기 3-4개, 중첩 1단)이고, `TERMINAL_DURATION_MS_SQL`
  /`TERMINAL_FINISHED_AT_PARAM` 은 이름이 서로의 관계(파라미터 이름 일치)를 드러낸다. 형제 헬퍼
  `terminal-error-payload.ts` 와 문서화 스타일(JSDoc 에 "왜 헬퍼인가"·SoT 링크·회귀 배경)이
  일관된다. 함수 길이·순환 복잡도 모두 낮다.
- **`execution-engine.service.ts`(diff 대상 함수들)** — `cancelParkedExecution`/
  `markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`/
  `finalizeStalledExhausted` 는 이 PR 이전부터 있던 중첩 깊이(트랜잭션 콜백 1단)를 그대로
  유지하며, `durationMs` 배관을 위해 새 조건 분기나 중첩을 추가하지 않았다. `if (lastNodeId)`
  블록 밖으로 `finishedAt`/`durationMs` 대입을 옮긴 4곳(:2404-2413, :3548-3564, :4739-4754,
  :4876-4882)은 CRITICAL 회귀(§`resolveTerminalDurationMs` JSDoc 참조 — 노드 0개 그래프에서
  `startedAt.getTime()` throw)를 고친 결과이고, `resolveTerminalDurationMs` 로 흡수되므로
  가독성이 오히려 개선됐다(무가드 산술 제거).
- **네이밍** — `cancelledDurationMs`/`stalledDurationMs`/`terminalFinishedAt`/
  `TERMINAL_FINISHED_AT_PARAM` 모두 값의 출처·성격을 정확히 드러내며 기존 `cancelled`(boolean
  플래그) 명명 패턴과 일관된다.
- **테스트 mock 확산(`execution-engine.service.spec.ts`)** — `.setParameter`/`.returning` stub
  이 QueryBuilder 리터럴 mock 15곳 이상에 반복 추가됐다. 이는 이 PR 이 새로 만든 문제가
  아니라 파일 전역에 걸쳐 이미 존재하는 "파일마다 손으로 쓴 query-builder 리터럴" 구조(19,700줄
  단일 spec 파일)의 필연적 파급이며, 같은 세션의 scope 리뷰(`09_58_24` scope.md)가 이미 실측
  근거와 함께 "scope 이탈 아님"으로 판정했다. 장기적으로 공유 mock 팩토리로 정리하면 이런
  파급이 줄어들겠지만 이 PR 의 범위는 아니다.
- **함수 길이/중첩** — 이번 diff 로 새로 40줄을 넘는 함수나 3단 이상 중첩이 생긴 지점은 없다.
  가장 긴 변경은 `cancelParkedExecution`/`markWebChatIdleTimeout` 인데 둘 다 이 PR 이전부터
  있던 구조(try/transaction/if)를 유지한 채 필드 3-4개만 추가했다.

## 요약

이 PR 은 EIA 종결 이벤트(`completed`/`failed`/`cancelled`) 16 개 emit 경로에 `durationMs` 를
채우는 배관 작업으로, 계산 로직을 `resolveTerminalDurationMs`/`toFiniteNumber`/
`TERMINAL_DURATION_MS_SQL` 세 개의 작고 순수한 프리미티브(신규 파일 `terminal-duration.ts`)로
응집시켜 16개 호출부에서 반복될 뻔한 계산·null 처리·SQL 클램프 로직의 drift 를 막았다. 4차례의
선행 리뷰 라운드가 CRITICAL(int4 오버플로로 인한 실행 영구 고착)과 주요 WARNING(형제 6곳의
헬퍼 미적용, 시계 역행 시 경로별 다른 sentinel, 타입 nullable)을 이미 조치했고, 이번 5차
라운드에서 그 상태가 그대로 유지되고 있음을 소스 레벨에서 재확인했다. 남은 항목은 전부 이전
라운드가 근거와 함께 명시적으로 보류한 INFO 성 사안(주석 3중복, raw-returning 추출 5중복, SQL
매직 넘버, 자기참조 폴백 이중호출, 테스트 헬퍼의 캐스트 예외)이며 4개 라운드에 걸쳐 위치·개수가
변하지 않았다 — 새로운 악화도, 재상향할 근거도 없다. 함수 하나가 여러 책임을 떠안거나 조건문이
과도하게 중첩된 곳, 이해하기 어려운 이름은 발견되지 않았다.

## 위험도

LOW
