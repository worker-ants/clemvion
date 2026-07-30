# Scope Review — retry_last_turn 재진입 짝 전이 DB 가드 (10R 이후 재확인 라운드)

## 조사 방법

리뷰 페이로드 5개 파일(`state/state-machine.ts`, `execution-engine.service.ts`,
`ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`,
`retry-turn.service.ts`)이 이번에도 전부 "전체 파일 컨텍스트"(unified diff 섹션
없음)로만 주어져, 실제 변경 범위를 git 으로 직접 재확정했다.

- HEAD = `3c306d593`("10R CRITICAL — opts→DB가드 번역 seam 무검증"). 직전 스코프
  라운드(`review/code/2026/07/30/16_42_36/scope.md`)는 HEAD `1838c6fec`(9R) 기준
  이었다.
- `git diff 1838c6fec..HEAD -- <5개 파일>` — **직전 라운드 이후 신규 변경은
  `engine-driver.interface.ts` 6줄(JSDoc 추가) 단 1건뿐**. 나머지 4개 파일은
  바이트 단위로 무변경.
- `git diff origin/main..HEAD -- <파일>` 을 5개 파일 각각 독립 재실행해 hunk
  단위로 전량 대조(누적 diff 재검증, 이전 라운드 결론에 의존하지 않음).
- `git diff -w`(공백 무시) 결과 줄 수가 일반 diff 와 5개 파일 전부 동일 —
  포맷팅 전용 변경이 실질 변경에 섞여 있지 않음을 확인.
- `grep -E "^[+-].*(^import|from ')"` 로 5개 파일의 import 라인 변경 여부를
  전수 확인 — **0건**.
- HEAD 가 실제로 건드린 목록 밖 파일(`CHANGELOG.md`,
  `ai-turn-orchestrator.service.spec.ts`,
  `plan/in-progress/retry-turn-terminal-guard.md`,
  `spec/5-system/4-execution-engine.md`,
  `continuation-execution.processor.ts`,
  `run-results.mdx`/`.en.mdx`)도 내용을 열어 커밋 메시지가 명시한 의도(W6~W9 +
  CRITICAL #1)와 1:1 대응하는지 확인했다.
- `git status` — 커밋 밖 미추적/미스테이지 코드 변경 없음(리뷰 산출물 디렉터리
  외 untracked 파일 없음).

## 발견사항

- **[INFO]** 직전 라운드(16_42_36) 이후 리뷰 대상 5개 파일에 발생한 유일한
  변경은 `engine-driver.interface.ts` 의 6줄 JSDoc 추가뿐이다.
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:209-214`
    (`tryLockActiveExecutionAndSaveNodeExec` 시그니처 바로 위 `@param
    opts.allowRetryReentry` 문단 — Read 로 실제 소스 줄 확인, 프롬프트 게이트
    `209|`~`214|` 와 일치)
  - 상세: 직전 라운드(9R, `1838c6fec`)에서 이미 도입된 `opts?: {
    allowRetryReentry?: boolean }` 파라미터(시그니처 자체는 무변경)의 계약 설명을
    보강하는 순수 JSDoc 추가다. 코드 로직·시그니처·동작 변화 없음 — 순수 문서화.
    커밋 메시지의 "W7(documentation) engine-driver.interface.ts 의
    tryLockActiveExecutionAndSaveNodeExec JSDoc 에 신규 opts.allowRetryReentry
    설명 추가" 와 정확히 대응한다.
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 대상 5개 파일의 origin/main 대비 누적 diff(289 insertions / 48
  deletions)를 hunk 단위로 재검증한 결과, 8개 점검 관점 위반 0건.
  - 위치: 해당 없음 (5개 파일 전체 대상 종합 판정)
  - 상세:
    - `state-machine.ts`: opt-in 대상을 `FAILED→RUNNING` 단일에서
      `FAILED→(RUNNING|WAITING_FOR_INPUT)` 로 확장 + 설명 주석. `ALLOWED_TRANSITIONS[FAILED]`
      는 `[]` 로 미변경(방어 유지) — 단일 의도.
    - `engine-driver.interface.ts`: 시그니처에 `opts?: { allowRetryReentry?:
      boolean }` 1줄 — 구현체 변경에 필수 동반.
    - `ai-turn-orchestrator.service.ts`: `reparkAiResumeTurn` 신규 `opts`
      파라미터 + 이미 계산돼 있던 `finalizeOpts`/`allowRetryReentry` 를 호출부
      6곳에 재전달. 신규 상태 변수 도입 없음.
    - `execution-engine.service.ts`: `NON_TERMINAL_OR_FAILED_STATUSES_SQL`
      신설(기존 `NON_TERMINAL_STATUSES_SQL` 과 동일 패턴 재사용, WARNING #8
      이력의 연장) + `lockNonTerminalExecutionRow`/
      `tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` 의 guarded
      UPDATE 분기(linkedNodeExec 유/무 양쪽)에 opts 전파 3곳. `updateExecutionStatus`
      자체의 `opts` 파라미터는 이 브랜치 이전부터 존재(변경 아님) — 이번 diff 는
      그 opts 를 DB 가드까지 전파만 한다.
    - `retry-turn.service.ts`: `RETRY_STATE_KEY` 상수화(ai-review WARNING #3 로
      기존에 명시 요청된 항목) + `claimSpawnedRetryRow` 2차 원자 claim. 두 항목
      모두 12_56_04/16_42_36 라운드가 이미 상세 검증 완료한 diff 와 동일.
    - import 라인 변경 0건(5개 파일 전수 grep), 공백/포맷팅 전용 hunk 0건(`diff
      -w` 결과 동일), 함수 시그니처 변경은 이번 결함과 직결된 3곳
      (`lockNonTerminalExecutionRow`, `tryLockActiveExecutionAndSaveNodeExec`
      정의, `reparkAiResumeTurn`)으로 한정.
  - 제안: 조치 불필요.

- **[INFO]** HEAD 커밋(`3c306d593`)이 실제로 건드린 리뷰 목록 밖 파일 6종은
  전부 커밋 메시지가 명시한 의도와 1:1 대응한다.
  - 위치: 해당 없음 (out-of-list 파일 6종)
  - 상세:
    - `ai-turn-orchestrator.service.spec.ts`(+42): `reparkAiResumeTurn` 의
      opts→driver 번역을 검증하는 focused 테스트 1건 — 8R mutation 오판 교훈에
      대한 직접 대응(10R CRITICAL 조치).
    - `CHANGELOG.md`(+36): "Unreleased" 신규 절 1개, 8R 결함(짝 전이 DB 가드)·
      06 C-2 계열 2차 claim·종결 2경로 guarded 전환 3축을 요약 — 코드 변경과
      내용 불일치 없음.
    - `plan/in-progress/retry-turn-terminal-guard.md`(+45): "10차 라운드" 절
      추가(라운드 이력·defer 신규 등재 #20~#25) — plan 라이프사이클 규약과 일치.
    - `spec/5-system/4-execution-engine.md`(+2/-1): 직전 라운드(16_42_36)
      scope.md 가 WARNING 으로 지적한 이중 대시 마크다운 오타(`- - 재진입 성공
      시` → `- 재진입 성공 시`)의 정확한 정정.
    - `continuation-execution.processor.ts`(comment-only): `retry_last_turn`
      제외 사유 주석이 예전에 "자체 멱등 가드(RUNNING 검증)" 라고만 적어
      check-then-act 창을 숨기던 자기모순을 정정 — 코드 로직 변경 없음, 순수
      주석 정정.
    - `run-results.mdx`/`.en.mdx`(+6/+7): ko/en 동시, "재시도 성공 후 대화가
      계속되면 downstream 대신 입력 대기로 복귀" 사용자 가이드 보강 — 이번 PR
      체인이 처음 도달 가능하게 만든 경로에 대한 문서화(W6, 아래 WARNING 참조).
  - 제안: 조치 불필요.

- **[INFO]** (참고, 리뷰 대상 5개 파일 목록 밖 — documentation/user_guide_sync
  중복 지적 가능) `run-results.mdx` 의 신규 문단이 바로 아래 기존 문장과 다소
  겹친다.
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:107-115`
    (Read 로 직접 확인한 실제 소스 줄 — 이번 리뷰 payload 5개 파일 목록에는
    없는 파일이라 게이트 인용 불가)
  - 상세: 신규 삽입(107~111행)은 "재시도 성공 시 화면은 두 가지 — (1) 대화
    종료→downstream 진행, (2) 대화 계속→downstream 대신 입력 대기 복귀" 를
    설명한다. 그런데 바로 몇 줄 뒤(115행, 기존 미변경 문장) "재시도가 성공하면
    AI 노드 다음에 연결된 노드가 일반 실행과 동일하게 이어서 실행돼요" 가
    무조건문으로 남아 있어, 방금 도입한 "(2) 대화 계속 시엔 downstream 으로
    가지 않는다" 는 조건부 설명과 나란히 읽으면 다소 상충하는 인상을 준다.
    `.en.mdx` 는 신규 문단이 파일 끝부분(마지막 불릿 앞)에 삽입돼 이 문제가
    없다 — ko 버전에만 해당.
  - 제안: 115행을 "대화가 끝나 성공적으로 종결된 경우, AI 노드 다음에 연결된
    노드가…" 식으로 조건을 명시하거나, 107~111행 블록에 흡수 통합. 코드 스코프
    위반은 아니며 documentation/user_guide_sync 리뷰어와 중복 지적일 수 있다.

## 커밋/파일 대조 요약

| 파일 | 16_42_36(HEAD=`1838c6fec`)→HEAD(`3c306d593`) 신규 변경 | origin/main→HEAD 누적 변경 | 스코프 판정 |
|---|---|---|---|
| `state/state-machine.ts` | 없음 | opt-in 대상 확장(WAITING_FOR_INPUT 추가) | 1:1 대응, 위반 없음 |
| `execution-engine.service.ts` | 없음 | `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 신설 + opts 전파 3곳 | 1:1 대응, 위반 없음 |
| `ai-turn-orchestrator.service.ts` | 없음 | `reparkAiResumeTurn`/`tryLock…` 호출부 opts 전파 | 1:1 대응, 위반 없음 |
| `engine-driver.interface.ts` | JSDoc 6줄 추가(W7) | 시그니처 opts 파라미터 1줄 + 위 JSDoc | 1:1 대응, 위반 없음 |
| `retry-turn.service.ts` | 없음 | `RETRY_STATE_KEY` 상수화 + 2차 원자 claim(`claimSpawnedRetryRow`) | 이전 라운드 검증 완료분과 동일 |
| `*.spec.ts`/`CHANGELOG.md`/`plan/*.md`/`spec/*.md`/`continuation-execution.processor.ts`/`run-results*.mdx`(목록 밖) | 테스트 1건 + 문서 5종 | — | 커밋 명시 의도(W6~W9)와 1:1 대응, ko 문서 1건 경미한 문맥 중복(INFO) |

## 요약

이번 라운드가 리뷰 대상으로 받은 5개 프로덕션 파일 중 직전 스코프 라운드
(16_42_36, HEAD=`1838c6fec`) 이후 실제로 변경된 곳은 `engine-driver.interface.ts`
의 6줄 JSDoc 추가 단 1건이며, 이는 이미 도입된 `allowRetryReentry` opt-in
파라미터의 계약을 설명하는 순수 문서화로 커밋이 명시한 의도(W7)와 정확히
일치한다. 5개 파일의 origin/main 대비 전체 누적 diff 를 다시 독립적으로 hunk
단위 대조해도 "짝 전이 DB 가드에 opts 전파 + 2차 원자 claim"이라는 단일 의도를
벗어난 불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 뒤섞임·불필요한
주석·미사용 임포트·설정 변경은 발견되지 않았다(import 변경 0건, 공백-전용 hunk
0건, 함수 시그니처 변경은 결함과 직결된 3곳으로 한정). 같은 커밋이 건드린
목록 밖 파일 6종(회귀 테스트·CHANGELOG·plan·spec 오타 정정·주석 정정·사용자
가이드 2개 언어)도 전부 커밋이 명시한 부수 조치(W6~W9)와 1:1 대응한다 — 다만
`run-results.mdx`(ko) 신규 문단이 몇 줄 뒤 기존 무조건문과 다소 문맥이
겹치는 경미한 사항을 참고용 INFO 로 남긴다(코드 스코프 위반 아님, 목록 밖
파일, documentation/user_guide_sync 중복 지적 가능).

## 위험도

NONE — 리뷰 대상 5개 파일 자체의 스코프 위반 0건. 참고로 남긴 out-of-list
문서 관측(INFO)은 코드 스코프와 무관하고 차단 사유가 아니다.
