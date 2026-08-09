# 변경 범위(Scope) 리뷰

## 발견사항

발견 없음.

두 파일 모두 이번 브랜치(`plan-lifecycle-gates`)의 핵심 변경 — plan frontmatter `status` 필드를
build 가드(`plan-frontmatter.test.ts`)가 검증하게 되고 `plan-scan.ts`(`TERMINAL_PLAN_STATUSES`)가
그 판정 로직의 SoT 가 된 것 — 에 직접 종속된 문서/산출물이며, 그 범위를 벗어나는 추가 수정·리팩토링·
포맷팅·주석·임포트·설정 변경은 발견되지 않았다.

- `spec/conventions/spec-impl-evidence.md` 의 3개 hunk(`git diff origin/main...HEAD` 로 실측 대조,
  프롬프트 diff 와 일치 확인) 는 각각:
  1. `code:` frontmatter 에 신규 SoT 파일 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 등재
     (line 15) — 실제 가드 로직 파일 추가에 대한 필수 동기화, 스코프 내.
  2. §2.2 에 plan `status` vs spec `status` 의미 도메인 구분 문단 신설 (line 87) — 같은 PR 이 만든
     새 겹침(`implemented` 값 공유)을 설명하는 필수 문서화, 스코프 내.
  3. §4.2 표의 `plan-frontmatter.test.ts` 행을 "필드 존재만 검사" → "필드+status 값+링크 3종 검사"로
     갱신 (line 132) — 실제 가드 동작 변경을 정확히 반영, 스코프 내.
  이 세 변경 외에 무관한 절 편집·재배치·서식 정리는 없다.
- `review/consistency/2026/08/10/01_37_01/rationale_continuity.md` (신규 파일) 는 위 spec 편집
  직전에 의무화된 `consistency-check --spec` 산출물(CLAUDE.md: "project-planner 는 spec/ 쓰기
  직전 consistency-check --spec 의무")로, 이번 spec 변경의 Rationale 연속성만 다룬다. 같은 세션
  디렉토리의 다른 리포트(`cross_spec.md`, `convention_compliance.md` 등)도 동일하게 말미에
  `위험도` + `STATUS=` 라인으로 끝나는 것을 확인했으므로, 본 파일 끝의 `STATUS=success` 삽입은
  이 리포지토리의 리뷰 산출물 관례이며 이번 diff 에 국한된 이상 현상이 아니다.

## 요약

리뷰 대상 2개 파일 모두 plan-lifecycle-gates 작업이 실제로 만든 코드/가드 변경(plan frontmatter
`status` 검증 추가, `plan-scan.ts` SoT 화)을 문서화하거나 그 문서화 직전 의무 절차(consistency-check)
의 산출물일 뿐이며, 의도 이상의 변경·불필요한 리팩토링·무관한 파일 수정·포맷팅/주석/임포트/설정
잡음은 확인되지 않았다.

## 위험도

NONE
