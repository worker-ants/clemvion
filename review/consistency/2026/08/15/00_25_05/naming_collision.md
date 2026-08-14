# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (impl-done, 재검토)

## 조사 방법

1. `git diff origin/main...HEAD --stat` 로 전체 변경 범위를 확인했다. spec 변경은
   `spec/5-system/14-external-interaction-api.md`(11줄, §6 필드표·§6.4 blockquote 서술
   정정) + `spec/conventions/chat-channel-adapter.md`(`error.code` 타입을 `string` →
   `string | null` 로 spec §6.4/구현과 재정합) 뿐이다. 둘 다 **기존에 이미 정의된 필드의
   서술/타입 표기 정정**이며 새 요구사항 ID·엔티티명·endpoint·이벤트명·env var·파일 경로를
   도입하지 않는다.
2. 본 turn 은 직전 두 라운드(`22_29_16`, `23_18_06`)가 이미 `NONE` 으로 닫은 뒤 5회의
   code-review 라운드(`22_55_51`~`00_15_10`)를 거치며 코드가 계속 바뀌었으므로, 그 사이
   실제로 새 식별자가 늘었는지부터 확인했다. `git log --format='%h %ad' --date=format:'%H:%M:%S'`
   로 `23_18_06` 이후 커밋 5개(`66baf81f0`·`843a36ac7`·`812b090e9`·`1f55a6530`·`a70f60828`)를
   식별하고 각각 `git show --stat` 으로 diff 범위를 확인했다 — **4개는 테스트/plan/review
   메타데이터 전용**이고, 유일한 프로덕션 코드 변경(`66baf81f0`)은 기존 파일 하나를
   `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts` →
   `codebase/backend/src/shared/utils/terminal-error-payload.ts` 로 **이동**(git 이 rename
   으로 인식, `+0/-0` diff)시키고 `chat-channel.dispatcher.ts` 의 손수 정규화 로직을
   같은 헬퍼 호출로 교체한 것뿐이다. 새 식별자는 없다.
3. 그래서 이번 라운드에서 실제로 점검할 대상은 **PR 전체 생애주기에서 도입된 신규
   프로덕션 심볼**로 좁혔다: `git diff origin/main...HEAD -- spec/ codebase/` 의 `+` 라인을
   `export (interface|class|const|function|type)` 패턴으로 grep 한 결과, 프로덕션 export 는
   `toTerminalErrorPayload` 함수와 `TerminalErrorPayload` 인터페이스 **둘뿐**이었다(나머지
   `+` 는 전부 테스트 `it(...)` 케이스). 이 둘에 대해 절대경로
   `git -C ".../eia-r8-cache-scope-4ae434" grep -n` 전수 검색으로 충돌 여부를 재확인했다.
4. 요구사항 ID·API endpoint·이벤트명·ENV var 신규 도입 여부도 `git diff` 의 `+` 라인을
   `EIA-[A-Z]+-[0-9]+` / `POST|GET|PATCH|DELETE /api/` / `process\.env\.[A-Z_]+` /
   `"execution\.[a-z_]+"` 패턴으로 재확인 — 매치된 것은 모두 **기존 `execution.failed`
   이벤트명을 테스트/타입에서 재참조**한 것이었고 신규 도입은 0건.

## 발견사항

- **[INFO]** `toTerminalErrorPayload` / `TerminalErrorPayload` — 파일 이동 후에도 충돌 없음, 위치가 더 적절해짐
  - target 신규 식별자: `TerminalErrorPayload` 인터페이스 + `toTerminalErrorPayload()` 함수
    (현재 경로: `codebase/backend/src/shared/utils/terminal-error-payload.ts:36,48`)
  - 기존 사용처: 전역 grep(`git grep -n "TerminalErrorPayload"`) 결과 정의 파일과 호출부
    (`execution-engine.service.ts:664,3314,4872`, `retry-turn.service.ts:966`,
    `chat-channel.dispatcher.ts:552`, 각 `*.spec.ts`) 외 다른 정의는 없다. 직전 라운드
    (`23_18_06`)는 이 파일이 `modules/execution-engine/` 아래 있다고 기록했으나, 이후
    `66baf81f0` 커밋이 `shared/utils/` 로 옮겼다 — `execution-engine`·`retry-turn`(같은
    execution-engine 모듈)·`chat-channel`(다른 모듈) 세 소비처가 생기면서 모듈-국소적
    위치가 더 이상 맞지 않았기 때문이다. 새 위치는 형제 파일(`sanitize-error-message.ts`,
    `strip-external-only-fields.ts`)과 동일한 kebab-case·"cross-module 정규화 헬퍼" 컨벤션에
    부합하며, 파일 경로 충돌도 없다(`shared/utils/` 에 동명 파일 없음).
  - 상세: 직전 라운드가 지적한 "같은 이름 패턴(`…ErrorPayload`)의 다른 계층 헬퍼"
    (`AiTurnOrchestrator.extractAiTurnErrorPayload()`, 프런트 `extractNodeErrorPayload()`)와의
    표면적 유사성은 이번에도 유효하지만 이름이 100% 동일하지 않고(`to*` vs `extract*`,
    `Terminal` vs `AiTurn`/`Node` 접두), 이번 diff 로 그 관계가 더 나빠지지도 않았다 — 오히려
    `chat-channel.dispatcher.ts` 가 손으로 짜던 3-way 캐스팅 정규화를 걷어내고 이 헬퍼
    하나로 수렴시켜, 같은 값이 여러 곳에서 다른 이름·다른 로직으로 재구현되는 위험(이
    PR 자체가 고치고 있는 결함 클래스)을 줄이는 방향이다.
  - 제안: 액션 불요. 직전 라운드가 남긴 참고사항(`to<X>ErrorPayload` vs
    `extract<X>ErrorPayload` 접두사 컨벤션 명시)은 여전히 유효하나 비차단.

- **[정상 — 충돌 없음, 재확인]** 요구사항 ID·API endpoint·이벤트명·ENV var
  - 이번 diff 는 `EIA-*` ID·`/api/external/*` endpoint·`execution.*` 이벤트명·ENV var 를
    신규 도입하지 않는다. `EiaFailedEvent`(`chat-channel/types.ts`)는 기존 타입이며 이번
    diff 는 `error.code` 필드 타입만 `string` → `string | null` 로 좁혔을 뿐 이름은
    그대로다. `INTERNAL_ERROR` 라는 (가상의) 코드는 오히려 이번 diff 에서 **제거**됐다
    (`chat-channel.dispatcher.ts` — 분류기에 존재한 적 없는 코드를 지어내던 자리를
    `null` 로 교체) — 이는 신규 식별자 도입이 아니라 dangling 식별자 제거이므로 본
    체크 관점의 발견 대상은 아니다(참고: `consistency` 다른 checker, 예를 들어
    `dangling_reference` 관점이 다룰 사안).

## 요약

`spec/5-system/14-external-interaction-api.md` 를 target 으로 한 이번 impl-done 라운드는
직전 두 라운드(`22_29_16`, `23_18_06`)가 이미 `NONE` 판정한 위에서, 그 사이 있었던 5회의
code-review 수정 라운드(파일 이동 1건 + 테스트 보강 4건)를 재확인하는 성격이었다. 전체 PR
생애주기를 통틀어 프로덕션 코드에 도입된 신규 export 는 `toTerminalErrorPayload` 함수와
`TerminalErrorPayload` 인터페이스 두 개뿐이며, 둘 다 전역 grep 으로 유일 정의임을 재확인했고
파일 경로(이동 후 `shared/utils/terminal-error-payload.ts`)도 기존 명명 컨벤션과 충돌하지
않는다. 새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var·spec 파일 경로는 이번 diff
전체에서 0건 도입됐다 — 신규 식별자 충돌 관점에서 이 target 은 안전하다.

## 위험도

NONE
