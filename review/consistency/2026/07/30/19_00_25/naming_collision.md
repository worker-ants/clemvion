# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위 정정

prompt 에 인라인 포함된 target 본문(`1-auth.md` · `10-graph-rag.md` · `11-mcp-client.md`)은
컨텍스트 예산 안에 들어간 스냅샷일 뿐, `origin/main` 대비 실제 diff 가 있는 파일은 이 셋이
아니다. `git diff origin/main`(워킹트리 절대경로 기준)으로 직접 확인한 결과 이번 라운드가 실제로
건드린 spec 대상은 다음이다.

- `spec/5-system/4-execution-engine.md` (+78/-6) — 신규 상태전이 `failed → waiting_for_input`
  + 신규 Rationale 절 "retry 재진입의 원자 claim — spawn 단계 원자성만으로는 불충분하다"
- `spec/5-system/6-websocket-protocol.md` (+1/-1) — 위 전이의 거울 서술
- `spec/4-nodes/3-ai/1-ai-agent.md` (+6) — §12.8 에 위 전이를 가리키는 cross-ref 콜아웃
- 뒷받침 코드: `state-machine.ts` · `engine-driver.interface.ts` · `execution-engine.service.ts` ·
  `ai-turn-orchestrator.service.ts` · `continuation-execution.processor.ts`(+각 spec) ·
  frontend 유저가이드 `run-results(.en).mdx`

`spec/5-system/4-execution-engine.md` 는 prompt 의 "컨텍스트 예산 초과로 생략된 파일 18개"
목록에 있었다 — 프롬프트에 본문이 없다는 사실을 "변경 없음"의 근거로 삼지 않고 워킹트리를
절대경로로 직접 열어 확인했다.

이 diff 는 이미 code-review 다수 라운드(07/28~07/30, `review/code/2026/07/28/20_32_57` ~
`2026/07/30/18_26_50`)와 consistency-check 2회(`2026/07/28/17_21_27`,
`2026/07/30/12_38_59`)를 거쳐 CRITICAL 0 으로 수렴한 상태(최신 커밋 `3ea7a93ec` "12R 수렴
종료")이며, 직전 consistency 세션(`2026/07/30/12_38_59`)은 이번 신규 Rationale 절 중 트레이드오프
서술 한 문단만 좁게 검증했다(위험도 NONE). 본 세션은 그 문단을 포함해 diff 전체를 신규 식별자
충돌 관점으로 재검토했다.

## 발견사항

- **[WARNING]** retry 재진입 opt-in 플래그가 계층마다 다른 이름(`retryReentry` vs
  `allowRetryReentry`)을 쓴다
  - target 신규 식별자: 이번 diff 가 `AiTurnOrchestrator` 쪽에 확장 배선한
    `opts?: { retryReentry?: boolean }` — `processAiResumeTurn`
    (`codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:212`, 파라미터
    `:220`), `reparkAiResumeTurn`(`:430`, 파라미터 `:442`), `finalizeAiNode`(`:1426`, 파라미터
    `:1437`)와 그 호출부 다수
  - 기존 사용처: 같은 "retry 재진입 허용" 개념을 가리키는 `allowRetryReentry` 가
    `state-machine.ts:57`(`TransitionOptions.allowRetryReentry`),
    `engine-driver.interface.ts:76,88,216,226`,
    `execution-engine.service.ts:8171,8233,8358`(모두 `opts?: { allowRetryReentry?: boolean }`)에
    이미 정의돼 있다
  - 상세: 두 이름은 "호출 의도(orchestrator 계층의 `retryReentry`)"와 "실제 허가 플래그(DB
    가드·상태머신 계층의 `allowRetryReentry`)"를 구분하려는 의도된 2계층 설계이며,
    `ai-turn-orchestrator.service.ts:457`(`opts?.retryReentry ? { allowRetryReentry: true } :
    undefined`)처럼 진입점에서 명시적으로 번역된다. 문제는 이 번역이 **암묵적 관례로만
    지켜진다**는 것이다 — 실제로 `execution-engine.service.ts` 의 `updateExecutionStatus` else
    분기가 직전 라운드(10R, 커밋 `3c306d593`) 동안 이 opts 를 전혀 전달받지 못해, 상태머신은
    `FAILED→WAITING_FOR_INPUT` 을 허용하는데 DB 가드는 계속 FAILED 를 배제해 **매 호출 100%
    결정적으로 실패**하는 CRITICAL 이 났었다(이미 수정 완료). 더 미묘하게는
    `ai-turn-orchestrator.service.ts:1439`가 `opts.retryReentry` 값을 받아 그 자리에서 로컬
    변수명을 `const allowRetryReentry = opts?.retryReentry === true;` 로 바꿔 저장한다 — 같은
    파일 안에서도 두 철자가 뒤섞여 등장해, 향후 6번째 소비처를 추가하는 사람이 어느 계층에서
    어느 이름을 써야 하는지 코드만 보고는 헷갈리기 쉽다. 이는 "동일 식별자가 다른 의미로
    쓰인다"는 CRITICAL 요건은 아니지만 등급 기준의 WARNING 정의("비슷한 이름이라 혼동 가능")에
    정확히 부합한다.
  - 제안: 두 계층의 property 이름을 하나(`allowRetryReentry`)로 통일하거나, 최소한 번역 지점
    (`:223-224`, `:457`, `:1439`)에 "orchestrator 계층은 `retryReentry`, 하위
    driver/state-machine 계층은 `allowRetryReentry`로 명명이 의도적으로 다르다"는 1줄 앵커
    주석을 못박아 두면 향후 동일 클래스의 propagation 누락(10R CRITICAL 과 같은 실패 패턴)을
    구조적으로 줄일 수 있다. (10R 의 실제 버그는 이미 고쳐졌으므로 이 항목은 재발 방지용 명명
    정리 제안이지 살아있는 결함 보고가 아니다.)

- **[INFO]** 인접한 두 Rationale 절 제목이 "원자 claim" 문구를 공유
  - target 신규 식별자: 신설 절 `### retry 재진입의 원자 claim — spawn 단계 원자성만으로는
    불충분하다 (§7.5 대칭, 2026-07-28)` (`spec/5-system/4-execution-engine.md:1357`)
  - 기존 사용처: 바로 다음 절 `### 재개 race 보장을 DB 원자 claim 으로 — 위 "running hop 회피"
    결정의 부분 수정 (§7.5, 2026-07-02)` (`:1415`, 이번 diff 로 변경되지 않음)
  - 상세: 두 제목의 나머지 텍스트가 달라 앵커(slug) 충돌은 없고, 각 절이 다루는 대상(신설 절 =
    2차 spawn-row claim `claimSpawnedRetryRow`, 기존 절 = 최초 재개 claim `claimResumeEntry`)도
    본문에서는 명확히 구분된다. 다만 목차만 훑는 독자에게는 "원자 claim" 이라는 문구가 두 절
    제목에 연달아 나와 같은 절의 연속처럼 보일 소지가 있다.
  - 제안: (선택) 신설 절 제목 앞에 "2차"/"spawn-row" 같은 구분어를 붙이면(예: "retry 재진입의
    **2차** 원자 claim — …") 목차 스캔만으로도 두 절이 서로 다른 claim 을 가리킴이 드러난다.
    본문 내용 자체는 이미 명확히 구분해 서술하므로 순수 가독성 제안이며 target 결함은 아니다.

## 확인 후 이상 없음으로 판정한 항목 (참고)

diff 가 새로 도입/인용하는 식별자를 전량 코드·plan 원본과 대조해 **단일 정의·의미 일치**를
확인했다(충돌 없음).

| 식별자 | 성격 | 대조 결과 |
|---|---|---|
| `claimSpawnedRetryRow` | 기존 private 메서드(신규 아님) | `retry-turn.service.ts:538` 유일 정의와 일치. spec 인용은 이번 신설 Rationale 절이 사실상 처음이지만 의미는 코드 JSDoc 과 100% 일치 |
| `NON_TERMINAL_OR_FAILED_STATUSES_SQL` | 신규 private static 상수 | `execution-engine.service.ts:534` 유일 정의. 기존 `NON_TERMINAL_STATUSES_SQL`(`:513`)과 이름·JSDoc 모두로 명확히 구분되고 둘 다 private — 외부 노출·충돌 경로 없음 |
| `failed → waiting_for_input` 전이 | 신규 상태전이 튜플 | `state-machine.ts` ALLOWED_TRANSITIONS 표 밖의 `allowRetryReentry` opt-in 전용으로만 등록. §1.1 상태표·ASCII 다이어그램·§12.8 cross-ref(`1-ai-agent.md`)·§4.2(`6-websocket-protocol.md`) 4곳 서술이 서로 모순 없이 일치 |
| `plan/in-progress/retry-turn-terminal-guard.md` | 신규 plan 파일 경로(frontmatter `pending_plans` 신규 등재) | 동명·유사 목적의 기존 파일과 충돌 없음. `plan/complete/`의 다른 `*guard*.md` 들은 전부 harness/push-guard 계열로 주제가 겹치지 않음 |
| `EXECUTION_FAILED` (신설 문장에서 재인용) | 기존 WS 이벤트 enum(`websocket.service.ts:71`, `execution.failed`) | 신설 문장은 "state-machine 가드가 없으면 일반 예외 메시지가 이 기존 이벤트의 payload 로 노출된다"는 기존 이벤트의 정확한 재인용 — 신규 이벤트 아님. (참고: `CODE_EXECUTION_FAILED` 라는 별개의 기존 Code 노드 에러 코드와 이름이 유사하지만 이는 이번 diff 이전부터 존재한 무관 식별자라 이번 target 이 만든 충돌은 아님) |
| `claimResumeEntry` / `recoverStuckExecutions` / `failOrphanRunningNodeExecutions` / `_retryState`/`RETRY_STATE_KEY` | 기존 식별자 재인용 | 전부 각 정의 파일의 단일 정의와 일치, 의미 변경 없음 |

요구사항 ID 컨벤션(`spec/5-system/4-execution-engine.md` 는 애초 `KB-GR-*` 류의 형식 ID 체계를
쓰지 않음) · API endpoint(신규 endpoint 없음) · webhook/queue/SSE 이벤트명(신규 이벤트 없음) ·
환경변수·설정키(신규 env var 없음) — 4개 점검 관점은 이번 diff 에 해당 사항 자체가 없어
"충돌 여지 없음"으로 조기 판정한다.

## 요약

`spec/5-system/4-execution-engine.md` 의 `failed → waiting_for_input` 전이 신설 + 신규 Rationale
절, `6-websocket-protocol.md`/`1-ai-agent.md` 거울 서술, 그리고 이를 뒷받침하는
state-machine.ts·engine-driver.interface.ts·execution-engine.service.ts·
ai-turn-orchestrator.service.ts 코드가 새로 도입하거나 인용하는 식별자를 전수 대조한 결과,
"동일 식별자가 다른 의미로 이미 쓰이고 있는" CRITICAL 급 충돌은 없다. 유일하게 주목할 지점은
같은 "retry 재진입 허용" 개념을 계층마다 다른 이름(orchestrator 계층의 `retryReentry` vs
driver/state-machine 계층의 `allowRetryReentry`)으로 부르는 기존 설계가 이번 diff 로 더 넓게
전파됐다는 것이다 — 이 이름 불일치 자체가 직전 라운드(10R)의 실전 CRITICAL(번역 누락으로 인한
100% 결정적 실패)의 근본 원인 중 하나였고 버그 자체는 이미 고쳐졌지만, 다음 소비처가 추가될 때
동일 클래스가 재발할 여지는 명명 차원에서 남아 있어 WARNING 으로 남긴다. 그 외 신규 plan 파일
경로, 신규 private SQL 상수, 신규 상태전이 튜플은 모두 기존 명명 컨벤션과 충돌 없이 안전하게
도입됐고, 요구사항 ID·API endpoint·이벤트명·환경변수 4개 관점은 이번 diff 의 대상 자체가 아니다.

## 위험도

LOW
