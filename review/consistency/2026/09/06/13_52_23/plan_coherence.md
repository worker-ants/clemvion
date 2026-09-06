# Plan 정합성 검토 — `spec/conventions/` (impl-done, diff-base=origin/main)

## 검토 방법

- 프롬프트 번들의 "구현 변경 사항" diff 는 예산으로 절단됐고, `plan/in-progress/` 번들도
  `spec-draft-nullable-notation-followups.md` 1개만 전문이 실리고 나머지 64개(2개 관련
  plan 포함)는 헤더만 남았다. 두 문서 모두 워킹트리를 **절대경로**로 직접 열어 대조했다.
- 대조 대상: `git diff origin/main...HEAD -- spec/conventions/review-citations.md
  spec/conventions/spec-impl-evidence.md` (커밋된 변경) + `git diff HEAD --
  <같은 두 파일>` (커밋 후 워킹트리에 남은 **미커밋** 추가 수정, `git status --short` 로
  확인) + `plan/in-progress/spec-draft-review-citations-enforcement.md`,
  `plan/in-progress/spec-draft-api-convention-verifier-registration.md`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 전문.
- 직전 인접 라운드 두 건(`review/code/2026/09/06/13_39_20` 코드 리뷰,
  `review/consistency/2026/09/06/13_39_25` plan_coherence — scope `spec/5-system/`)도 함께
  읽어 "이미 알려진 것" 과 "이번 스코프(`spec/conventions/`)에서 새로 봐야 하는 것" 을
  구분했다.

## 발견사항

- **[INFO]** 직전 Critical(YAML 주석 파서 버그)이 **워킹트리에서 이미 해소돼 있다** — 커밋만 남았다
  - target 위치: `spec/conventions/review-citations.md` `## Rationale` 첫 소절,
    `spec/conventions/spec-impl-evidence.md` §2.1 `code` 행
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 396~419행(표
    1행 아래 새 blockquote), 1081~1095행("2026-09-06 — 하루 만에 재발했다. 우선순위를
    올린다")
  - 상세: 마지막 커밋(`0f689bb7e`)이 커밋한 `review-citations.md` 의 `code:` 블록은
    항목 사이에 `# 준수 예시 …` / `# 시행 코드 …` 인라인 YAML 주석을 넣었다(`--spec`
    checker 의 INFO#2 제안을 그대로 채택). 이것이 정확히 `spec-draft-api-convention
    -verifier-registration.md` 가 **하루 전** 발견해 등재해 둔 harness 결함
    (`review_guard._parse_frontmatter_code` 의 블록 리스트 루프가 `- ` 로 시작하지
    않는 첫 줄에서 `break` — 주석 뒤 항목이 전부 사라짐)을 재현한다. 이번엔 파싱 결과가
    2개→0개로 떨어져 신규 등재 실패는 물론 **기존에 걸려 있던 `sanitize-loader-error.ts`
    까지 spec-linkage 감사망에서 이탈**하는 회귀였다 — 코드 리뷰
    (`review/code/2026/09/06/13_39_20` Critical 1, 게이트 직접 실행으로 확인)가 잡았다.
    **현재 워킹트리**(`git diff HEAD` 로 확인한 미커밋 상태)는 이미 이 Critical 을
    고쳐 두었다 — `code:` 인라인 주석을 제거하고 표로 대체했으며, `review-citations.md`
    Rationale 과 `spec-impl-evidence.md §2.1` 양쪽에 "범주를 YAML 주석으로 적지 않는다"
    는 정정 문장과 사고 경위(`review/code/2026/09/06/13_39_20` 인용)를 남겼다. plan
    문서(`spec-draft-nullable-notation-followups.md`)도 같은 사고를 "하루 만에 재발 —
    우선순위를 올린다" 로 동기화해 두었다. 즉 target·plan·harness 결함 트래커 세 곳이
    지금은 서로 모순 없이 정합하다 — 다만 이 수정 자체가 **아직 커밋되지 않은 워킹
    디렉토리 상태**라는 점이 유일한 잔여 리스크다.
  - 제안: 이 수정을 별도 커밋(또는 같은 정리 커밋)으로 반드시 반영할 것. 반영되면
    `spec-draft-review-citations-enforcement.md` 134행의 마지막 체크박스(`- [ ]
    --impl-done 재실행으로 Critical 해소 확인`)를 **본 라운드**(scope 가 정확히
    `spec/conventions/` 라 직접 검증 가능)를 근거로 닫을 것 — 직전 13:39:25 라운드는
    scope 가 `spec/5-system/` 이라 이 근거를 자기 번들로 재현할 수 없다고 스스로
    명시했었다(그 라운드 INFO#5).

- **[INFO]** 남은 두 열린 항목(§5.4 구조·이름 축 등재, `User` 7컬럼 노출 금지 규범 문장)은
  이번 스코프 밖으로 정확히 좁혀져 있어 충돌 없음
  - target 위치: (참고, 이번 diff 에 없음) `spec/5-system/2-api-convention.md §5.4`,
    `spec/1-data-model.md §2.1`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 375~424행,
    426~436행(제목 3축 중 "이 항목에 남은 것은 §5.4 쪽 두 축" 이라고 스스로 명시)
  - 상세: 이번 target(`spec/conventions/review-citations.md`,
    `spec-impl-evidence.md`)은 JSDoc 축(`dto-jsdoc-citation*.ts`)만 등재하고 구조 축
    (`user-entity-exposure*.ts`)·이름 축(`user-secret-absence*.ts`)은 건드리지 않는다.
    plan 본문도 그 두 축의 등재처를 `2-api-convention.md`/`swagger.md` 로 명시하고
    "이 draft(JSDoc 축)가 선행 집행했다" 고 축 단위로 갈라 적어 두어, 남은 두 축을
    이번 커밋이 놓친 것이 아니라 **다음 planner 턴으로 의도적으로 이월**한 것임이
    문서 자체에서 확인된다. 미해결 결정 우회나 후속 항목 누락이 아니다.
  - 제안: 없음(다음 planner 턴에서 두 항목 함께 집행 권장 — 이미 등재돼 있음).

- **[INFO]** `spec-draft-api-convention-verifier-registration.md` → `plan/complete/`
  이동 미집행 — 비구속, 이번 target 과 무관
  - target 위치: 없음(참고)
  - 관련 plan: `plan/in-progress/spec-draft-review-citations-enforcement.md`
    113~123행 「함께 처리할 것」 3번, `plan/in-progress/spec-draft-api-convention
    -verifier-registration.md`(worktree: `spec-api-convention-code-and-overview-d81cd6`)
  - 상세: 해당 draft 는 열린 체크박스 0건이고 PR #1289 로 머지됐다고 plan 자신이
    적어 두었다. 그러나 그 draft 의 `spec_impact`(`spec/5-system/2-api-convention.md`,
    `spec/conventions/swagger.md`)는 이번 target(`spec/conventions/review-citations.md`
    / `spec-impl-evidence.md`)와 겹치지 않고, 소유 plan(`spec-draft-review-citations
    -enforcement.md`) 자신도 이 이동을 "종결 조건이 아니라 권고" 라고 명시한다. 이동은
    다른 worktree/세션의 정리 작업 영역이라 본 검토 대상(동시 작업 충돌)이 아니다.
  - 제안: 없음.

## 확인했으나 충돌 없음으로 판정한 항목

- **미해결 결정 우회 여부**: target 두 파일의 변경은 모두 `--spec` 게이트
  BLOCK:NO(`review/consistency/2026/09/06/13_18_59`)를 거친 뒤 반영됐고, 이후 발견된
  harness 버그도 절차대로(코드 리뷰 → plan 동기화 → target 수정) 처리됐다 — planner
  권한을 우회하거나 developer 자기-반증형 소정정 예외를 오용한 흔적이 없다.
- **선행 plan 미해소 여부**: `spec-draft-nullable-notation-followups.md` 의 다른 열린
  항목(스윕 헬퍼 추출, Flyway 관련 항목 등)은 이번 target 변경 범위와 겹치지 않아
  전제 훼손이 없다.
- **후속 항목 누락 여부**: `plan/in-progress/` 전체를 `review-citations.md` /
  `spec-impl-evidence.md` / `dto-jsdoc-citation` 키워드로 훑었을 때, 위에 언급한
  세 plan 외에 이번 변경을 참조하거나 이번 변경으로 무효화되는 다른 plan 파일은
  없다.

## 요약

이번 target(`spec/conventions/review-citations.md`, `spec-impl-evidence.md`)의 커밋된
변경은 그것을 관리하는 plan(`spec-draft-review-citations-enforcement.md`)의 처방(A/B/C)과
정확히 일치한다. 다만 그 커밋(`0f689bb7e`)이 채택한 "인라인 YAML 주석으로 code: 범주를
가른다" 는 방식이 **하루 전 자매 plan 이 이미 등재해 둔 harness 결함**
(`_parse_frontmatter_code` 가 주석에서 파싱을 끊는 문제)을 재현해 코드 리뷰에서 Critical
로 잡혔다 — 이는 **plan 이 이미 경고한 함정을 target 이 밟은 사례**다. 다행히 워킹트리를
직접 대조한 결과 이 Critical 은 **이미 수정돼 있고**(주석 제거 + 표 치환 + 사고 경위를
양쪽 문서와 plan 에 동기화), 다만 그 수정이 아직 커밋되지 않았다. 남은 두 개의 열린 plan
항목(§5.4 구조·이름 축, User 7컬럼 규범 문장)은 이번 스코프 밖으로 plan 이 스스로 명확히
좁혀 두어 신규 결함이 아니다. 미해결 결정을 우회한 사례, 선행 plan 전제를 무너뜨린 사례,
다른 plan 의 후속 항목을 무효화한 사례는 발견되지 않았다.

## 위험도

LOW — 구조적 충돌은 없으나, Critical 을 고친 변경이 아직 커밋되지 않은 상태로 남아 있어
그 커밋이 누락되면 즉시 이전 라운드가 잡은 회귀(spec-linkage 0건)가 재발한다. 커밋 반영을
확인 조건으로 남긴다.
