# 정식 규약 준수 검토 — convention_compliance

## 진단 메모 (알려진 결함 감안)

prompt_file 의 `## 구현 변경 사항` diff 섹션은 실측대로 **부재**했다(번들이 예산을 채워 diff 가
밀려남). 대신 워킹트리 절대경로에서 `git diff origin/main...HEAD` 를 직접 뽑아 실제 변경분을
근거로 썼다:

- `spec/conventions/spec-impl-evidence.md` (frontmatter `code:` 1건 추가 + §4.2 표 1행 정정)
- `.claude/docs/plan-lifecycle.md` (§4 규칙 2개 신설 + §5 체크리스트 2항목)
- `codebase/frontend/src/lib/docs/__tests__/{plan-frontmatter.test.ts, plan-scan.ts, plan-scan.test.ts, spec-links.ts, spec-links.test.ts}` (판정 로직 신설·통합)
- `plan/complete/**` 15건 `status` 필드 정정 + `plan/in-progress/**` 9건 상대링크 정정
- `plan/in-progress/harness-env-value-subpattern-dedup.md` 에 후속 항목 22줄 추가

빌드 가드 재실행으로 실측 검증: `plan-frontmatter.test.ts` + `plan-scan.test.ts` +
`spec-links.test.ts` = **171 tests PASS**, `spec-code-paths`/`spec-frontmatter`/
`spec-link-integrity` = **792 tests PASS** (frontmatter 편집이 다른 가드를 깨지 않음).

## 발견사항

- **[WARNING] `PROJECT.md` §자동 가드 표의 `plan-frontmatter.test.ts` 행이 신설 검사 2종을 반영하지 않음**
  - target 위치: `PROJECT.md:277` (§자동 가드 (build-time 차단))
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §6` 4번 ("PROJECT.md §자동 가드 표에 해당 row 추가") — 신규뿐 아니라 기존 가드의 서술도 실제 동작과 동기 유지가 전제. 또한 CLAUDE.md "정보 저장 위치" 의 단일 진실 원칙(같은 가드를 두 문서가 설명하면 서로 어긋나지 않아야 함)
  - 상세: 이번 PR 이 `plan-frontmatter.test.ts` 에 검사 2종을 추가하면서 `spec/conventions/spec-impl-evidence.md §4.2` 표(131행)와 `.claude/docs/plan-lifecycle.md §4`(80–91행)는 정확히 갱신됐다. 그런데 같은 가드를 설명하는 세 번째 위치인 `PROJECT.md:277` 은 손대지 않아 여전히 "top-level `plan/in-progress/*.md` 의 `worktree`/`started`/`owner` frontmatter 강제" 만 서술한다 — `plan/complete/**` 의 `status` 종료값 검사·살아있는 plan 상대링크 검사는 이 행에서 보이지 않는다. `.claude/tests/test_doc_sync_matrix.py` 는 참조된 테스트 파일의 **실존**만 검증하고 서술의 정확성은 검증하지 않으므로(§`test_referenced_guard_tests_exist` 확인), 이 drift 는 어떤 게이트도 잡지 못한다 — 이번 PR 스스로가 경계하는 "손으로 유지되는 SoT 가 조용히 stale 해진다" 패턴의 재현이다.
  - 제안: `PROJECT.md:277` 을 spec-impl-evidence.md §4.2 표의 최신 서술(3검사 요약)로 갱신. 예: "top-level `plan/in-progress/*.md` 의 `worktree`/`started`/`owner` frontmatter 강제 + `plan/complete/**` 의 `status` 종료값 검사 + 살아있는 plan 상대링크 무결성 검사"로 확장하고 SoT 링크는 그대로 유지.

- **[INFO] `spec-links.ts` JSDoc 의 "8건, 전부 이동형" 서술이 최종 상태(9건, 1건은 stale anchor)와 불일치**
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:271-275` (`findBrokenPlanLinks` JSDoc)
  - 위반 규약: 명시적 `spec/conventions/**` 규약 조항은 아니며, 이 프로젝트가 반복 강조하는 "실측 서술은 최종 상태와 일치해야 한다"는 문화적 관행에 대한 사소한 이탈(문서 정확성)
  - 상세: 이 JSDoc은 "Measured 2026-08-09: 8 broken links in the live plans, every one a plan that had moved to `complete/`." 라고 적는다. 그러나 같은 브랜치의 이후 커밋(`f4a1723be`, "링크 스캐너를 공유 구현으로")이 스코프를 공유 스캐너로 교체하자마자 9번째 위반(`cafe24-backlog-residual.md` 의 `#92-주요-api` stale anchor, 스펙 §9.2→§9.1 재편)을 추가로 발견했고 이 PR 최종 diff 에서 함께 고쳤다(`git diff origin/main...HEAD -- plan/in-progress/cafe24-backlog-residual.md` 로 확인). 또한 `spec-fix-swagger-forbidden-response.md` 의 1건(`../5-system/1-auth.md` → `../../spec/5-system/1-auth.md`)도 "plan 이 이동해서 깨진" 유형이 아니라 애초부터 상대경로 단수가 틀렸던 링크다. 즉 최종 수정 건수는 9건이고 그중 최소 2건은 "전부 이동형" 이라는 서술과 다른 유형이다. `.claude/docs/plan-lifecycle.md:91` 의 "실측상 그쪽 깨진 링크 135건" 등 다른 실측 수치는 `plan/complete/spec-draft-secret-store-verification-footnote.md`(선행 PR #1116) 의 실측 기록과 대조해 정확함을 확인했다 — 이 JSDoc 한 곳만 최종 코드 상태를 안 따라간 것으로 보인다.
  - 제안: 코멘트를 "9 broken links ... 7 were dangling `complete/`-move targets, 1 a stale spec anchor, 1 a pre-existing bad relative path" 식으로 갱신하거나, 숫자·유형 서술을 아예 빼고 정성적 설명만 남긴다. 게이트 동작 자체에는 영향 없음(코드 로직은 정확), 순수 주석 정확도 이슈.

- **[INFO] Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 가 신설 `plan-scan.ts` 의 `collectCompletePlanMarkdown` 과 별개 구현으로 남음**
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59-83` vs `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:52-77`
  - 위반 규약: 강한 의미의 규약 위반은 아님 — `plan-scan.ts` 헤더 코멘트가 스스로 "Gate C 와 같은 면제 규칙을 쓴다"고만 주장하고(코드 재사용까지는 주장하지 않음) 실제로 두 구현의 필터(0-/_ 제외, `archive/` 제외, 재귀)는 동일함을 확인했다. `spec/conventions/spec-impl-evidence.md §4.2` 표에서도 Gate C 행은 `plan-scan.ts` 를 언급하지 않으므로 표 자체의 허위 서술은 아니다
  - 상세: 다만 이 PR 이 문제 삼는 "손 재구현 walker 가 저장소에 네 벌 있었다" 는 지적이 이번 PR로 4벌→3벌(plan-frontmatter 쪽 2개 통합)이 됐을 뿐, Gate C 몫은 여전히 독립 구현이라 잠재적 재발 조건(같은 클래스의 결함이 또 나올 수 있는 지점)이 하나 남는다. 다만 이는 이미 `plan/in-progress/harness-env-value-subpattern-dedup.md` "함께 볼 것" 절(2026-08-10 이관)에 "Gate C 재사용은 별건... 값은 현재 일치 — 실측" 으로 명시적으로 인지·추적되고 있어 규약 상 문제(무단 방치)는 아니다
  - 제안: 조치 불요 — 이미 올바르게 후속 plan 에 등재됨. 참고용 기록으로만 남김.

## 요약

이번 변경은 `spec/conventions/spec-impl-evidence.md §4.2` 표·`.claude/docs/plan-lifecycle.md §4/§5`·실제 판정 코드(`plan-scan.ts`/`spec-links.ts`/`plan-frontmatter.test.ts`) 세 층이 서로 line-level 로 정합했고, `#1108`·`#1117` 두 실제 과거 실패 인용도 `git log` 대조로 사실임을 확인했다(실측 문화가 코드 코멘트에도 반영됨). `plan/complete/**` 15건 status 정정과 `plan/in-progress/**` 9건 링크 정정도 각각 실제로 깨져 있던 값·경로였음을 diff 로 직접 검증했다. 유일하게 실질적인 결함은 **PROJECT.md 의 병렬 SoT 행이 갱신되지 않아 세 문서 중 하나가 stale** 해진 것(WARNING) — 이 PR 이 스스로 경계하는 "손으로 유지되는 SoT 의 조용한 drift" 패턴이 자신의 범위 밖(PROJECT.md)에서 재현된 사례다. 나머지는 코드 코멘트 정확도(INFO)·이미 추적된 잔여 리팩터(INFO) 수준이라 CI 차단이나 정식 규약의 구조적 위반에는 이르지 않는다.

## 위험도

LOW

STATUS=success
