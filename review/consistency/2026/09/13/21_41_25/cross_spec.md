# Cross-Spec 일관성 검토 — error-code-emission-axis (round 7)

## 검토 방법 메모

`_prompts/cross_spec.md` 번들은 예산 절단으로 `spec/conventions/error-codes.md` 등 다수
파일과 실제 코드 diff 본문을 누락했다 (기지 결함 —
`plan/in-progress/spec-draft-nullable-notation-followups.md` "consistency `--spec` 기본
예산이 conventions 를 통째로 떨군다" 항목과 동형, 직전 라운드 1~6 에서도 반복 재현).
프롬프트 지시대로 워킹트리를 **절대경로**로 직접 열어 우회했다:

- `git diff origin/main --stat` (전체) 및 `-- codebase/` 로 실제 코드 diff 확인 — scope
  (`spec/conventions/`) 델타는 **0 파일**, 실제 codebase diff 는 4 파일: `logic.mdx` ·
  `logic.en.mdx` · `guide-identifier-existence.test.ts` · `guide-identifier-scan.ts`
  (687 insertions / 5 deletions).
- `git log --oneline -20` + `git show --stat eb53aba1c` 로 직전 라운드(`21_19_52`, round 6
  검토) 이후 추가된 커밋(`eb53aba1c` "라운드 6")의 변경 대상을 확인 — guard test/scan 파일의
  **내부 캐싱 리팩터 + 주석 숫자 정정**과 `plan/in-progress/**` 두 파일뿐이고, `spec/**` 도
  `logic{,.en}.mdx` 도 건드리지 않았다. 즉 **cross-spec 상태는 round 6 검토 시점과 불변**이다
  (diff 상세는 `git diff 2931d921f eb53aba1c -- .../guide-identifier-scan.ts
  .../guide-identifier-existence.test.ts` 로 확인 — `resolveSourceLines` basename 캐시 도입 +
  주석 "네 번"→"세 번" 정정뿐).
- `Read`/`grep` 로 `spec/5-system/3-error-handling.md §1.4`,
  `spec/3-workflow-editor/{0-canvas,2-edge}.md`,
  `spec/4-nodes/1-logic/{0-common,3-loop,7-map,9-foreach}.md`,
  `spec/5-system/4-execution-engine.md`, `spec/conventions/user-guide-evidence.md`,
  `codebase/backend/.../execution-engine.service.ts`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 직접 확인.

## 발견사항

### [WARNING] `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` — 가이드는 "코드 아님"으로 정정됐는데 spec 6파일은 여전히 에러 코드로 서술 (known-open, 이 PR 비차단, round 6 대비 불변)

- **target 위치**: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114` /
  `logic.en.mdx:103` — 이번 diff 의 정정: *"실패 메시지 앞에 `CONTAINER_MISSING_EMIT` 또는
  `CONTAINER_MULTIPLE_EMIT` 가 붙어요 — 전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야
  해요."* + `guide-identifier-scan.ts` 의 `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건(실측 확인:
  현재 등록 3항목 — `MAKESHOP_UNRESOLVED_PATH_PARAM` · `CONTAINER_MISSING_EMIT` ·
  `CONTAINER_MULTIPLE_EMIT`).
  실측 근거: `execution-engine.service.ts:7121·7125·7130` 은 일반 `throw new Error(...)` 로
  이 토큰을 **메시지 접두**로만 쓰고, 노드 실행 기록(`8016` 부근)은 `error = { message }` 만
  남겨 구조화된 `code` 필드가 아예 없다.
- **충돌 대상** (같은 두 토큰을 인라인 코드로 표기해 구조화 에러 코드처럼 서술하는 6개
  spec 파일 — grep 으로 재확인):
  - `spec/5-system/4-execution-engine.md:332-333` §3.0 — *"emit 포트에 연결된 body 노드가
    0개 → `CONTAINER_MISSING_EMIT` **에러로 실행 실패**."* (가장 강한 형태)
  - `spec/3-workflow-editor/2-edge.md:202` §6.1 — *"검증 | emit 없음 →
    `CONTAINER_MISSING_EMIT`, 2개 이상 → `CONTAINER_MULTIPLE_EMIT`."*
  - `spec/3-workflow-editor/0-canvas.md:636` §11.2.2 — 같은 표의 형제 행(`CONTAINER_INVALID_CHILD`
    "에러로 실패" · `CONTAINER_CYCLE` "에러로 거부")과 동형으로 나열 — 그 둘도 같은 파일
    (`execution-engine.service.ts` 의 일반 `Error` 메시지 접두)이라 같은 결함 계열이다.
  - `spec/4-nodes/1-logic/0-common.md:83` — 괄호 안 코드 표기.
  - `spec/4-nodes/1-logic/7-map.md:179-180` §6 — 열 헤더가 "메시지" 인데 값은 전체 메시지가
    아니라 접두 토큰만 있어 그 자체가 메시지 전체인 것처럼 읽힌다.
  - `spec/4-nodes/1-logic/9-foreach.md:209-210` §6 — 열 헤더가 "메시지 / 코드" 로 두 개념을
    합쳐 표기해 코드로 오독하기 더 쉽다.
  - (대조군: `spec/4-nodes/1-logic/3-loop.md:189-191` §6 은 열 헤더 "메시지" + **발행
    문자열 전문**을 그대로 실어 target 의 새 서술과 이미 정합한다 — 통일 시 이 패턴을 따르면
    됨.)
- **상세**: `spec/conventions/error-codes.md`·`spec/5-system/3-error-handling.md §1.4`(카탈로그
  SoT) 어느 쪽에도 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가 등재돼 있지 않다 —
  이 PR 이 `GUIDE_NON_EMITTED_VOCABULARY` 등록으로 그 사실을 코드 레벨로 고정했다. 그런데
  위 6개 spec 파일은 같은 두 토큰을 "…에러로 실행 실패/거부" 또는 표의 "코드" 열 값으로 적어
  구조화된 에러 식별자처럼 서술한다 — 가이드에서 방금 고친 바로 그 오독을 spec 영역이 아직
  반복한다.
- **CRITICAL 이 아니라 WARNING 인 이유**: 런타임 계약은 어느 서술이든 결국
  `Error.message` 로만 전파되므로 작동 불가를 유발하지 않는다. 순수 서술(문서) 층위
  불일치이며, 다음에 이 6개 파일 중 하나를 근거로 "이 토큰은 `output.error.code`/
  `error.code` 값이다" 라고 판단하면(예: 클라이언트 분기 코드 작성, §1.4 카탈로그에 그대로
  추가) 실측과 충돌한다.
- **제안 / 재등록 불요**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
  planner 소유 항목 *"spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다"* 가 이 6개 파일 전부를
  정확히 열거하고 있고(round 6 커밋에서 5개 spec_impact 누락분도 보강됨) 아직 미체크(`[ ]`)
  상태다. 처분 형태는 `3-loop.md §6` 이 이미 쓰는 패턴(열 헤더 "메시지" + 발행 문자열 전문
  인용)으로 통일 권장. `spec/` 쓰기는 planner 권한이라 이 PR(`developer`)의
  `spec_impact: none` 스코프는 타당하다.

### [WARNING] `3-error-handling.md §1.4` "앵커 없는 코드" 축이 "메시지 접두 전용"과 "정상 앵커 없음"을 구분하지 않는다 (known-open, 이 PR 비차단, round 6 대비 불변)

- **target 위치**: `guide-identifier-scan.ts` 의 `collectQuotedLiterals` /
  `collectMessagePrefixes` / `isMessagePrefixOnly`(및 그 사용처 JSDoc) — 이 PR 이 카탈로그를
  "요구 조건이 아니라 탈출구"로 쓰도록 §1.4 서술에 의존해 설계했다.
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` 머리말(*"나머지 7종은 앵커 없는
  맨 문자열"*)과 표 — `RECURSION_DEPTH_EXCEEDED`/`MAX_ITERATIONS_EXCEEDED`/`CYCLE_DETECTED`
  등 7종을 앵커 없이도 정식 카탈로그 항목으로 등재.
- **상세**: `MAX_ITERATIONS_EXCEEDED`(`loop-executor.ts` 의
  `throw new Error('MAX_ITERATIONS_EXCEEDED: …')`)와 `CONTAINER_MISSING_EMIT` 은 발행
  형태가 **구조적으로 동일**(둘 다 일반 `Error` 의 메시지 접두)한데, 전자만 §1.4 카탈로그에
  있고 후자는 없다. §1.4 는 "앵커 없음"과 "카탈로그 등재 여부"만 구분할 뿐 "메시지 접두로만
  발행"이라는 세 번째 축을 spec 본문에서 명시하지 않는다 — §1.4 의 7종과 `CONTAINER_*` 의
  차이가 spec 상으로는 설명되지 않고, 이 PR 의 하네스가 실측으로 그 구분을 임시 봉합한다
  (카탈로그를 "탈출구"로 씀 — `MAX_ITERATIONS_EXCEEDED` 는 카탈로그 등재 덕에 통과,
  `CONTAINER_MISSING_EMIT` 는 신규 등록 목록 덕에 통과).
- **제안 / 재등록 불요**: 위 항목과 **같은** planner 트래커 항목(*"§1.4 의 «앵커 없는 코드»
  7종이 실제로는 메시지 접두다"*, 미체크)이 이미 이 갈림을 다루며 택일 (a) `CONTAINER_*` 를
  §1.4 에 backfill, (b) §1.4 앵커-없는 행에 "메시지 접두" 표기 추가를 제시한다. 어느 쪽을
  택하든 이 PR 의 `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건(`CONTAINER_*`)이 불필요해질 수
  있음을 plan 이 이미 조건부로 적어 두었다(round 6 에서 보강 확인).

### [INFO] `PROJECT.md:300` 의 SoT 꼬리표가 여전히 `user-guide-evidence.md §2` 를 가리키지만 그 절은 이 가드를 나열하지 않음 (pre-existing, 이 PR 무관)

- **target 위치**: `PROJECT.md:300` — `guide-identifier-existence.test.ts` 서술 끝에
  *"SoT: `spec/conventions/user-guide-evidence.md §2`"* (이번 diff 는 같은 줄의 "발행 축"
  서술만 갱신했고 SoT 꼬리표는 그대로).
- **충돌 대상**: `spec/conventions/user-guide-evidence.md §2` "Build-time 가드" — grep 재확인
  결과 `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` /
  `triggers-coverage.test.ts` 3건만 등재, `guide-identifier-existence.test.ts` 는 여전히
  없음.
- **상세**: `git show origin/main:PROJECT.md` 대조 결과 이 SoT 불일치는 이 PR 브랜치 시작
  (`afaef5bef`, 2026-09-13 18:24) 이전부터 있던 상태이고, round 1~6 검토 전 기간 동일하게
  유지됐다 — 이번 라운드 diff 가 새로 만든 충돌이 아니다.
- **제안**: 이 PR 범위 밖. 다음에 `user-guide-evidence.md §2` 를 편집하는 세션이 표에 4번째
  행을 추가하거나 `PROJECT.md` 의 SoT 꼬리표를 조정.

## 요약

이번 라운드(round 7)는 직전 라운드(round 6, `21_19_52`) 이후 추가된 유일한 커밋
(`eb53aba1c`)이 guard test/scan 파일의 내부 캐싱 리팩터 + 주석 숫자 정정과
`plan/in-progress/**` 두 파일만 건드렸을 뿐 `spec/**` 도 유저 가이드 mdx 도 변경하지
않았음을 확인했다 — **cross-spec 상태는 round 6 검토 시점과 완전히 불변**이다. 전체 브랜치
기준으로도 scope(`spec/conventions/`) 델타는 0 파일이고 `spec_impact: none` 과 일치하며,
실제 codebase 변경은 유저 가이드 문구 정정 2건 + 그 가이드를 검증하는 프론트엔드 발행-축
하네스뿐이라 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 **정면 충돌
(CRITICAL)은 없다**. 다만 이 PR 이 실측대로 정확히 고친 "`CONTAINER_MISSING_EMIT`/
`CONTAINER_MULTIPLE_EMIT` 는 구조화 코드가 아니라 메시지 접두"라는 사실이, 6개 spec 문서의
"…에러로 실행 실패/거부" 류 서술 및 `3-error-handling.md §1.4` 카탈로그의 "메시지 접두"
미구분과 계속 어긋난다 — 둘 다 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 planner 소유 항목으로 정확히 등재돼 미체크 상태로 이월 중이며(round 6 커밋에서
spec_impact 누락분 5개도 보강됨), `spec/` 쓰기는 developer 권한 밖이므로 이 PR 의
`spec_impact: none` 스코프는 타당하다. 새 backlog 재등록은 불요하며, 이 PR 을 이유로 한
차단 사유도 없다.

## 위험도

LOW
