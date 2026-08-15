# Maintainability Review — EIA 종결 이벤트 `durationMs` 배관 (R9, `11_29_02`)

## 방법론 노트

이 PR 은 이미 5차례 ai-review 라운드(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`→`11_09_44`)를
거쳤고 매번 maintainability 는 LOW 로 수렴했다. 프롬프트가 크기 제한으로 생략한
`execution-engine.service.{ts,spec.ts}`/`retry-turn.service.{ts,spec.ts}`/`terminal-duration.ts`
는 `git diff origin/main --` 로 전문을 직접 열어 대조했고(`Read`/`Bash`), 이전 라운드가 이미 근거와
함께 명시적으로 보류한 항목은 위치·개수 변동 여부만 재확인했다(재론이 목적이 아님). 이번 라운드는
**기존 5차 라운드가 놓친 신규 발견 1건**을 확보했다.

## 발견사항

- **[WARNING]** `terminal-duration.ts` — `resolveTerminalDurationMs` 를 설명하는 JSDoc 블록이
  실제로는 아무 선언에도 붙지 않는다(다른 상수의 JSDoc 에 자리를 뺏김)
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:1-34` (파일 1행부터
    34행까지 — 이 파일은 신규 생성이라 diff 게이트 번호 = 실제 파일 줄 번호와 동일)
  - 상세: 1~27행은 `/** 종결 이벤트(...)의 durationMs 를 한 곳에서 결정한다 ... @returns 밀리초.
    알 수 없으면 null ... */` 로, 문면(“왜 헬퍼인가”, `startedAt` 을 낙관하지 않는 이유, `throw`
    회귀 스토리, `null`/`undefined` 구분 근거)이 명백히 36행의 `export function
    resolveTerminalDurationMs(...)` 를 겨냥한다. 그런데 바로 뒤에 **별도의 두 번째 JSDoc
    블록**(28~33행, `PG_INT4_MAX` 상수 설명)이 끼어들고 이어서 34행에 `export const
    PG_INT4_MAX = 2147483647;` 가 온다. TypeScript/TSDoc 툴링(에디터 hover, TypeDoc)은
    **선언 바로 위에 인접한 코멘트 블록 하나만** 그 선언에 귀속시킨다 — 두 코멘트가 연달아
    있으면 뒤(28~33행) 블록만 `PG_INT4_MAX` 에 붙고, 앞(1~27행) 블록은 코드가 아니라 또 다른
    코멘트 앞이라 **어떤 심볼에도 귀속되지 않는다.** 실제로 `resolveTerminalDurationMs` 위에는
    JSDoc 이 전혀 없는 상태로 읽힌다(에디터에서 그 함수 위에 마우스를 올려도 1~27행 텍스트가
    뜨지 않는다). 이 문서는 이 PR 이 두 차례 CRITICAL 회귀(조건문 밖 이동 시 `startedAt` 미보장
    throw, int4 오버플로 고착)를 겪은 뒤 남긴 안전 근거라 특히 유실 비용이 크다 — 다음 편집자가
    `resolveTerminalDurationMs` 를 수정할 때 이 맥락을 볼 경로가 소스 스크롤뿐이다.
    (재현: 이 파일은 신규 생성이라 git blame 은 무의미하지만, 상수 `PG_INT4_MAX` 는
    `review/code/2026/08/15/11_09_44/RESOLUTION.md`(“JS 에도 `Math.min(span, PG_INT4_MAX)`
    클램프… 상수를 `PG_INT4_MAX` 하나로 export”)에서 CRITICAL 수정으로 삽입됐다는 이력이 있고,
    그 삽입 지점이 기존 함수 docblock 바로 뒤였다는 정황과 일치한다. 5차례 리뷰 라운드
    (`10_34_51`·`11_09_44` maintainability 포함) 중 이 구조를 지적한 라운드는 없었다 — 직접
    실측으로 처음 확인했다.)
  - 제안: 28~33행(`PG_INT4_MAX` 설명)을 34행 선언 바로 위로 유지하되, 1~27행 블록을 그 뒤로
    옮겨 36행 `resolveTerminalDurationMs` 바로 위에 붙인다(현재 순서를 단순히 뒤바꾸면 됨,
    내용 수정 불필요). 또는 두 선언 사이에 개행 하나만 넣어도 최소한 "복붙 흔적"이라는
    신호는 남지만, 툴링 귀속 문제는 순서를 바꿔야 해결된다.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스에 동일한
  5줄 근거 주석이 문자 그대로 3중 복제(4차 라운드부터 반복 확인, 신규 아님)
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-396`, `:415-419`, `:433-437`
  - 상세: "producer 는 항상 이 키를 싣고 값을 모르면 null" / "그런데 `?` 는 유지한다(consumer
    계약)" 근거가 세 번 복사돼 있다. 형제 필드 `error` 는 이미 `TerminalErrorPayload` 공유
    타입으로 이 drift 를 막았는데 `durationMs` 에는 같은 처방이 없다. 다만 3벌 모두 지금까지
    글자 단위로 동일해 실제 drift(한쪽만 갱신)는 아직 없다.
  - 제안: `type EiaTerminalDurationMs = number | null;` 로 이름 붙은 별칭에 주석을 한 번만
    달고 세 필드가 참조하게 하면, 다음에 이 정책이 바뀔 때 한 곳만 고치면 된다. 강제 아님.

- **[INFO]** raw `RETURNING` 값 추출 스니펫이 5개 함수에 verbatim 반복(`09_58_24` W5 로 이미
  근거와 함께 보류, "6번째 생기면 재검토" — 지금도 정확히 5곳)
  - 위치: `execution-engine.service.ts` `cancelParkedExecution`(:1046 부근),
    `markWebChatIdleTimeout`(:1181), `markExecutionCancelled`(:2860), `markQueueWaitTimeout`
    (:2909), `finalizeStalledExhausted`(:3362) — 전부
    `toFiniteNumber((result.raw as Array<Record<string, unknown>> | undefined)?.[0]?.duration_ms) ?? null`
    형태.
  - 제안: 재론 불필요. 6번째 raw UPDATE 종결 경로가 생기면 `extractReturningDurationMs(result)`
    1-라인 헬퍼로 승격 재검토.

- **[INFO]** `x.durationMs = resolveTerminalDurationMs(x) ?? x.durationMs;` 계산 후 몇 줄 뒤
  emit payload 에서 동일 인자로 `resolveTerminalDurationMs` 를 재호출하는 관용구가 completed
  경로 6곳 + retry-turn 3곳에 반복(4차 라운드부터 반복 확인, 신규 아님)
  - 위치: `execution-engine.service.ts:2413`/`:2424`(대입/재호출), `:2576`/`:2593`,
    `:3564`/`:3575`, `:4754`/`:4767`, `:4882`/`:4886`, `:4943`/`:4965`;
    `retry-turn.service.ts:714`/`:727`, `:896`/`:907`, `:949`/`:971`
  - 상세: 헬퍼가 순수 O(1) 함수라 비용은 무시할 수준이나, "왜 두 번 부르는가"(계산 실패 시에도
    필드를 덮어쓰지 않기 위함)가 코드만으로는 즉시 드러나지 않는다.
  - 제안: 확정된 필드(`savedExecution.durationMs`)를 emit 시점에 직접 참조하거나, 최초 등장
    지점에 짧은 이유 주석 한 줄. 우선순위 낮음, 강제 아님.

- **[INFO]** 테스트 파일의 QueryBuilder mock 팩토리(`makeIdleQb`/`makeCancelQb`/`makeQb`/
  `mkQb`/`mkExecQb` 등)에 `setParameter`/`returning` stub 2줄이 7~8개 지점에 손으로 반복
  추가됨(`09_58_24` W12 로 이미 비용 실증·보류, 신규 아님)
  - 위치: `execution-engine.service.spec.ts` 다수 지점(예: `:292-295`, `:400-403`,
    `:3163-3166`, `:4375-4378`, `:4738` 부근)
  - 제안: 공유 `makeUpdateQb(overrides)` 팩토리로의 통합은 다음 테스트 인프라 리팩터 후보.
    이번 PR 범위에서 조치 불필요.

## 그 외 확인 결과 (문제 없음으로 판정)

- **신규 파일 `terminal-duration.ts`/`terminal-duration.spec.ts`** — 위 JSDoc 배치 문제를
  제외하면, `resolveTerminalDurationMs`/`toFiniteNumber` 는 각각 단일 책임의 순수 함수(분기
  3~4개, 중첩 1단)이고 순환 복잡도가 낮다. `TERMINAL_DURATION_MS_SQL`/`TERMINAL_FINISHED_AT_PARAM`
  은 이름이 서로의 관계(파라미터 이름 일치)를 드러내고, 그 관계는 `terminal-duration.spec.ts`
  가 문자열 검사로 고정한다. int4 상한(`PG_INT4_MAX`)은 이번 라운드에서 이름 있는 export 로
  승격돼(3차 라운드가 지적한 "SQL 리터럴 안의 매직 넘버" 항목은 해소됨) JS·SQL 양쪽 경로가
  같은 상수를 참조한다.
- **`driveCallStackResume`(`execution-engine.service.ts:2529` 부근, 완료 경로)** — 4차 라운드
  (`10_18_38` side_effect, MEDIUM)가 "형제 5경로와 달리 이 경로만 `resolveTerminalDurationMs`
  가드를 계산부에서 우회한다"고 지적했던 것이, 현재 diff(`:2576-2578`)에서 다른 완료 경로와
  동일한 `resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs` 형태로
  통일돼 있음을 실측으로 확인했다 — 해소됨.
  - `chat-channel.dispatcher.ts`(`:534`, `:571`, `:587`)의 캐스트 타입도 `{ durationMs?:
    number | null }` 로 `types.ts` 의 nullable 계약과 일치하도록 수정돼 있다(4차 라운드
    지적 W8 해소 확인).
- **함수 길이·중첩** — `cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/
  `markQueueWaitTimeout`/`finalizeStalledExhausted` 는 `terminalFinishedAt` 변수 도입 +
  `setParameter`/`returning` 체이닝 + `toFiniteNumber` 추출로 각 함수가 10~15줄 늘었으나,
  트랜잭션 콜백 1단 중첩은 그대로이고 새 조건 분기를 추가하지 않았다. `if (lastNodeId)` 블록
  밖으로 `finishedAt`/`durationMs` 대입을 옮긴 4곳은 오히려 무가드 산술을 헬퍼 호출로 대체해
  가독성이 개선됐다.
- **네이밍·일관성** — `cancelledDurationMs`/`stalledDurationMs`/`terminalFinishedAt` 등 지역
  변수명이 목적을 명확히 드러내고, engine ↔ retry-turn 두 서비스가 완전히 동형의 패턴
  (`resolveTerminalDurationMs(x) ?? x.durationMs`)을 공유해 한 곳을 이해하면 나머지가 바로
  읽힌다 — 이 저장소가 이전에 겪은 "하드닝을 자매 함수에 미적용" 패턴이 이번엔 재발하지 않았다
  (실측: engine 6곳 + retry-turn 3곳 전부 헬퍼 경유).
- **CHANGELOG/plan 문서(`plan/in-progress/spec-draft-eia-notification-payload-contract.md` 등)**
  — 체크박스·표가 실제 구현 상태와 일치하고, 남은 작업(`result.outputs`)을 별 항목으로
  분리해 "완료 체크 시 통째로 닫히는" 위험을 스스로 방지해 뒀다. `review/**` 산출물은 이
  저장소의 표준 워크플로 산출물이라 코드 리뷰 대상이 아니다.

## 요약

핵심 로직(`resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`)은 세 프리미티브로 잘 응집돼 있고, engine·retry-turn 두 서비스가 완전히 동형 패턴으로 `durationMs` 를 배관해 자매 함수 하드닝 누락이 없다. 이전 4차례 라운드가 CRITICAL 2건(int4 오버플로 JS/SQL 양쪽, 조건문 밖 `startedAt` throw)과 WARNING 다수를 실제로 해소했음을 이번 라운드에서 diff 로 직접 재확인했다(`driveCallStackResume` 가드 통일, dispatcher 캐스트 타입 정합, magic number 이름 붙이기 등). 이번 라운드의 신규 발견은 1건 — `terminal-duration.ts` 상단에서 `resolveTerminalDurationMs` 를 설명하는 안전 근거 JSDoc 블록이 뒤에 삽입된 `PG_INT4_MAX` 코멘트에 자리를 빼앗겨 어떤 선언에도 귀속되지 않는 구조적 결함이다. 기능에는 영향이 없지만, 이 PR 이 두 차례 CRITICAL 을 겪으며 남긴 안전 근거 문서가 정확히 그 함수 위에서 사라진다는 점에서 문서화 품질 이슈로는 무시하기 어렵다. 나머지는 전부 이전 라운드가 근거와 함께 명시적으로 보류한 INFO 급 중복(주석 3중복·raw-returning 추출 5중복·자기참조 폴백 관용구 반복·테스트 mock 보일러플레이트)이며 신규 악화 없음.

## 위험도

LOW
