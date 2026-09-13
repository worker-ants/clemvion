# Cross-Spec 일관성 검토 — error-code-emission-axis (round 6)

## 검토 방법 메모

`_prompts/cross_spec.md` 번들은 예산 절단으로 `spec/conventions/error-codes.md` ·
`spec/conventions/user-guide-evidence.md` · 실제 코드 diff 본문 등을 누락했다 (알려진 결함 —
`plan/in-progress/spec-draft-nullable-notation-followups.md` "consistency `--spec` 기본
예산이 conventions 를 통째로 떨군다" 항목과 동형, 직전 라운드들에서도 반복 재현). 프롬프트
지시대로 워킹트리를 **절대경로**로 직접 열어 우회했다:

- `git -C <worktree> diff origin/main...HEAD --stat`로 실제 코드 diff 확인 — scope
  (`spec/conventions/`) 델타는 **0 파일**, 실제 코드 diff 는 4 파일: `logic.mdx` ·
  `logic.en.mdx` · `guide-identifier-existence.test.ts` · `guide-identifier-scan.ts`.
- `git -C <worktree> log --oneline -8` / `git show --stat 2931d921f` 로 직전 라운드
  (`20_57_15`) 이후 추가된 커밋(`2931d921f` "라운드 5")이 test/scan/plan 파일만 건드리고
  `spec/**`·가이드 mdx 를 건드리지 않았음을 확인 — 아래 발견사항은 `20_57_15` 라운드와
  **상태 불변**이다.
- `Read`/`grep` 로 `spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md`,
  `spec/3-workflow-editor/{0-canvas,2-edge}.md`, `spec/4-nodes/1-logic/{0-common,3-loop,7-map,9-foreach}.md`,
  `spec/5-system/4-execution-engine.md`, `codebase/backend/.../execution-engine.service.ts`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 직접 확인.

## 발견사항

### [WARNING] `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` — 가이드는 "코드 아님"으로 정정됐는데 spec 6파일은 여전히 에러 코드로 서술 (known-open, 이 PR 비차단)

- **target 위치**: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114` /
  `logic.en.mdx:103` (이번 diff 의 정정) — *"실패 메시지 앞에 `CONTAINER_MISSING_EMIT` 또는
  `CONTAINER_MULTIPLE_EMIT` 가 붙어요 — 전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야
  해요."* + `guide-identifier-scan.ts` 의 `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건.
  실측 근거: `execution-engine.service.ts:7121·7125·7130` 은 일반 `throw new Error(...)` 로
  이 토큰을 **메시지 접두**로만 쓰고, `execution-engine.service.ts:8016` 은
  `nodeExec.error = { message }` 로 기록해 구조화된 `code` 필드가 아예 없다.
- **충돌 대상** (같은 두 토큰을 인라인 코드로 표기해 구조화 에러 코드처럼 서술하는 6개
  spec 파일):
  - `spec/5-system/4-execution-engine.md:332-333` §3.0 — *"emit 포트에 연결된 body 노드가
    0개 → `CONTAINER_MISSING_EMIT` **에러로 실행 실패**."* (가장 강한 형태)
  - `spec/3-workflow-editor/2-edge.md:202` §6.1 — *"검증 | emit 없음 → `CONTAINER_MISSING_EMIT`,
    2개 이상 → `CONTAINER_MULTIPLE_EMIT`."*
  - `spec/3-workflow-editor/0-canvas.md:636` §11.2.2 — 같은 표의 다른 행(`CONTAINER_INVALID_CHILD`
    에러로 실패 · `CONTAINER_CYCLE` 에러로 거부)과 동형으로 나열 — 그 둘도 같은 파일
    (`execution-engine.service.ts:7053·7084`)의 일반 `Error` 메시지 접두일 뿐이라 같은
    결함 계열이다.
  - `spec/4-nodes/1-logic/0-common.md:83` — 괄호 안 코드 표기.
  - `spec/4-nodes/1-logic/7-map.md:179-180` §6 — 열 헤더가 "메시지" 인데 값은 전체 메시지가
    아니라 접두 토큰만 있어 그 자체가 메시지 전체인 것처럼 읽힌다.
  - `spec/4-nodes/1-logic/9-foreach.md:209-210` §6 — 열 헤더가 "메시지 / 코드" 로 두 개념을
    합쳐 표기해 코드로 오독하기 더 쉽다.
  - (대조군: `spec/4-nodes/1-logic/3-loop.md:189-191` §6 은 열 헤더 "메시지" + **발행
    문자열 전문**(`` CONTAINER_MISSING_EMIT: Container "<label>" has no body node wired to … ``)을
    그대로 실어 target 의 새 서술과 이미 정합한다.)
- **상세**: `spec/conventions/error-codes.md`(적용 범위: 프로젝트 전체 에러 코드 문자열)와
  `spec/5-system/3-error-handling.md §1.4`(카탈로그 SoT) 어느 쪽에도 `CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT`(및 형제 `CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE`)가 등재돼
  있지 않다 — 이번 PR 이 `GUIDE_NON_EMITTED_VOCABULARY` 등록으로 그 사실을 코드 레벨로
  고정했다. 그런데 위 6개 spec 파일은 같은 두 토큰을 "…에러로 실행 실패/거부" 또는 표의
  "코드" 열 값으로 적어 구조화된 에러 식별자처럼 서술한다 — 가이드에서 방금 고친 바로 그
  오독을 spec 영역이 아직 반복한다.
- **CRITICAL 이 아니라 WARNING 인 이유**: 런타임 계약은 어느 쪽이든 결국 `Error.message`
  로만 전파되므로 작동 불가를 유발하지 않는다. 순수 서술(문서) 층위 불일치이며, 다음에 이
  6개 파일 중 하나를 근거로 "이 토큰은 `output.error.code`/`error.code` 값이다" 라고
  판단하면(예: 클라이언트 분기 코드 작성, §1.4 카탈로그에 그대로 추가) 실측과 충돌한다.
- **제안**: 재등록 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
  planner 소유 항목 *"spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다"* 가 이 6개 파일 전부를
  정확히 열거하고 있고 아직 미체크(`[ ]`) 상태다. 처분 형태는 `3-loop.md §6` 이미 쓰는 패턴
  (열 헤더 "메시지" + 발행 문자열 전문 인용)으로 통일 권장. `spec/` 쓰기는 planner 권한이라
  이 PR(`developer`)의 `spec_impact: none` 범위는 타당하다.

### [WARNING] `3-error-handling.md §1.4` "앵커 없는 코드" 축이 "메시지 접두 전용"과 "정상 앵커 없음"을 구분하지 않는다 (known-open, 이 PR 비차단)

- **target 위치**: `guide-identifier-scan.ts` 의 `collectQuotedLiterals`/`collectMessagePrefixes`/
  `isMessagePrefixOnly`(및 그 사용처 JSDoc) — 이 PR 이 카탈로그를 "요구 조건이 아니라
  탈출구"로 쓰도록 §1.4 서술에 의존해 설계했다.
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` 머리말(*"나머지 7종은 앵커 없는
  맨 문자열"*)과 표 — `RECURSION_DEPTH_EXCEEDED`/`MAX_ITERATIONS_EXCEEDED`/`CYCLE_DETECTED`
  등 7종을 앵커 없이도 정식 카탈로그 항목으로 등재.
- **상세**: 실측하면 `MAX_ITERATIONS_EXCEEDED`(`loop-executor.ts:64·85` 의
  `throw new Error('MAX_ITERATIONS_EXCEEDED: …')`)와 `CONTAINER_MISSING_EMIT` 은 발행
  형태가 **구조적으로 동일**(둘 다 일반 `Error` 의 메시지 접두)한데, 전자만 §1.4 카탈로그에
  있고 후자는 없다. §1.4 는 "앵커 없음"과 "카탈로그 등재 여부"만 구분할 뿐 "메시지 접두로만
  발행"이라는 세 번째 축을 spec 본문에서 명시하지 않는다 — 그래서 §1.4 의 7종과
  `CONTAINER_*` 의 차이가 spec 상으로는 설명되지 않고, 이 PR 의 하네스가 실측으로 그 구분을
  임시 봉합한다(카탈로그를 "탈출구"로 씀 — `MAX_ITERATIONS_EXCEEDED` 는 카탈로그 등재 덕에
  통과, `CONTAINER_MISSING_EMIT` 는 신규 등록 목록 덕에 통과).
- **제안**: 위 항목과 **같은** planner 트래커 항목(*"§1.4 의 «앵커 없는 코드» 7종이 실제로는
  메시지 접두다"*, 미체크)이 이미 이 갈림을 다루며 택일 (a) `CONTAINER_*` 를 §1.4 에
  backfill, (b) §1.4 앵커-없는 행에 "메시지 접두" 표기 추가를 제시하고 있다 — 재등록 불요.
  어느 쪽을 택하든 이 PR 의 `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건이 불필요해질 수 있음을
  plan 이 이미 적어 두었다.

### [INFO] `PROJECT.md:300` 의 SoT 꼬리표가 여전히 `user-guide-evidence.md §2` 를 가리키지만 그 절은 이 가드를 나열하지 않음 (pre-existing, 이 PR 무관)

- **target 위치**: `PROJECT.md:300` — `guide-identifier-existence.test.ts` 서술 끝에
  *"SoT: `spec/conventions/user-guide-evidence.md §2`"*.
- **충돌 대상**: `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (**3건**)" —
  `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` /
  `triggers-coverage.test.ts` 3건만 등재, `guide-identifier-existence.test.ts` 는 없음.
- **상세**: `git show origin/main:PROJECT.md` 대조 결과 이 SoT 불일치는 이 PR 이전부터 있던
  상태다(직전 라운드 `19_23_31`에서도 동일 확인). 이번 diff 도 같은 줄의 다른 부분(발행 축
  서술)만 갱신했을 뿐 SoT 꼬리표는 건드리지 않았다 — 새로 만든 충돌은 아니다.
- **제안**: 이 PR 범위 밖. 다음에 `user-guide-evidence.md §2` 를 편집하는 세션이 표에 4번째
  행을 추가하거나 `PROJECT.md` 의 SoT 꼬리표를 조정.

## 요약

이번 라운드(round 6)는 `spec/**` 을 전혀 건드리지 않았고(scope 델타 0, `spec_impact: none`
과 일치), 직전 라운드(`20_57_15`) 이후 추가된 커밋(`2931d921f`, "라운드 5" fix)도 test/scan/
plan 파일만 수정해 cross-spec 상태를 바꾸지 않았다. 코드 변경은 유저 가이드 문구 정정 2건 +
그 가이드를 검증하는 프론트엔드 하네스(발행 축) 뿐이라 데이터 모델·API 계약·요구사항 ID·
상태 전이·RBAC·계층 책임의 **정면 충돌(CRITICAL)은 없다**. 이 PR 이 실측대로 정확히 고친
"`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 는 구조화 코드가 아니라 메시지 접두"
라는 사실이, `5-system/4-execution-engine.md`·`3-workflow-editor/{0-canvas,2-edge}.md`·
`4-nodes/1-logic/{0-common,7-map,9-foreach}.md` 6개 spec 문서의 "…에러로 실행 실패/거부"
류 서술 및 `3-error-handling.md §1.4` 카탈로그의 "메시지 접두" 미구분과 계속 어긋난다 — 다만
둘 다 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로
정확히 등재돼 미체크 상태로 이월 중이며, `spec/` 쓰기는 developer 권한 밖이므로 이 PR 의
`spec_impact: none` 스코프는 타당하다. 새 backlog 재등록은 불요.

## 위험도

LOW
