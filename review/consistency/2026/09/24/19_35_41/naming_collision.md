# 신규 식별자 충돌 검토 — `pending-plan-is-plan`

## 스코프 확인

`--impl-prep spec/conventions` 로 번들된 target 은 `spec/conventions/**` 전체 + 다수의
`plan/in-progress/*.md` 컨텍스트지만, `origin/main..HEAD` 실제 diff 는 아래 세 파일에
한정된다 (`git diff --stat origin/main..HEAD -- spec/ codebase/` 로 확인, `spec/` 변경 0건 —
plan frontmatter `spec_impact: none` 과 일치):

- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` (+18)
- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts` (+49)
- `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` (+25/-5)

이 diff 가 도입하는 신규 식별자는 함수 `isPendingPlanPath` 와 모듈-내부 상수
`PENDING_PLAN_DIRS` 둘뿐이다. 아래는 이 둘에 대한 충돌 검토다.

## 발견사항

없음.

- **`isPendingPlanPath(relPath)`** (신규 export, `spec-frontmatter-parse.ts:97`)
  — 저장소 전체(`codebase/`, `spec/`, `plan/`)에서 `grep -rn "isPendingPlanPath"` 한
  결과 정의 1곳 + 소비 2곳(`spec-pending-plan-existence.test.ts`,
  `spec-frontmatter-parse.test.ts`)뿐이다. 기존에 같은 이름으로 다른 의미의
  식별자가 쓰이던 자리는 없다. 명명도 같은 파일의 기존 술어 `isApplicable`
  (line 75)과 대칭적이라 혼동 소지가 적다.
- **`PENDING_PLAN_DIRS`** (모듈 스코프 `const`, export 안 됨, `spec-frontmatter-parse.ts:95`)
  — 같은 파일의 `INCLUDE_PREFIXES`/`EXCLUDE_BASENAMES`/`CATALOG_FIELD_FILE`,
  `plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES` 등 인접 상수군과 이름이 겹치지 않고,
  저장소 전체에서 이 파일 밖에 나타나지 않는다.
- 이번 변경은 `spec/**` frontmatter 스키마·엔티티·API endpoint·이벤트명·ENV
  var·spec 파일 경로 중 어느 것도 새로 도입하지 않는다 (`spec_impact: none` 이
  diff 와 일치). 따라서 §1(요구사항 ID)·§3(API endpoint)·§4(이벤트/메시지명)·
  §5(환경변수)·§6(파일 경로) 관점은 이 diff 에 대해 해당사항이 없다.
- 번들에 포함된 `spec/conventions/**` 나머지 파일들(`spec-impl-evidence.md`,
  `audit-actions.md`, cafe24/makeshop API 카탈로그 등)은 이번 작업이 새로
  쓴 것이 아니라 impl-prep 컨텍스트로 딸려 온 기존 문서이며, 이번 diff 와
  무관하다 — 새 식별자를 도입하지 않으므로 별도 충돌 검토 대상이 아니다.

## 요약

이번 target 의 실질 변경분은 `isPendingPlanPath` 술어 함수와 그 내부 헬퍼 상수
`PENDING_PLAN_DIRS` 도입뿐이며, 둘 다 저장소 전역에서 유일한 이름이고 기존
`isApplicable`/`INCLUDE_PREFIXES` 계열과 명명 패턴이 일관돼 혼동 여지가 없다.
`spec/` 문서·ID·엔티티·API·이벤트·ENV·파일 경로 층위의 신규 식별자는 이번
변경에 존재하지 않는다(`spec_impact: none` 과 diff 가 일치). 신규 식별자
충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
