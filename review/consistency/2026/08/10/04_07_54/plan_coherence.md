# Plan 정합성 검토 — `spec/conventions/` (impl-done, 04_07_54)

## 참고 — 번들 결함

prompt 번들에 `## 구현 변경 사항` diff 섹션이 없었다(알려진 결함, 이미
`plan/in-progress/harness-review-gate-followups.md` "원 plan 에서 함께 넘어온 미해결 조사 1건"
에 등재됨). 워킹트리 절대경로에서 `git diff origin/main...HEAD` 를 직접 실행하고, 코드는
`git -C <워킹트리>` 및 절대경로 `Read` 로 재구성해 검토했다.

## 점검 1 — 삭제한 `docs-guard-legacy-fixture-coverage.md` 의 항목이 정말 전부 해소됐는가

**결론: 해소됨.** 이 파일은 이번 브랜치 안에서 생성(`f09b21893`)되고 같은 브랜치 안에서
삭제(`bc10e215e`)됐다 — `origin/main` 에는 애초에 존재한 적이 없어 `git diff origin/main...HEAD`
에는 추가/삭제 어느 쪽도 나타나지 않는다(순감 0). 삭제 커밋 메시지가 사유를 명시한다: rationale
checker 가 "TEST·REVIEW WORKFLOW 에서 발견된 사항은 기존부터 있던 것이라도 조치" 라는
`developer/SKILL.md §ISSUE FIX 정책` 과의 충돌을 지적했고(동일 클래스 3회 반복), 등재 대신
즉시 fix 로 전환했다.

원 plan 이 요구한 항목을 코드로 실측:

- **판정 로직의 순수 함수 추출** — `checkPlanFrontmatter(raw, relPath)` 와 `isIsoDate(text)` 가
  `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:192, 228` 에 실존. 문자열 입력을 받는
  순수 함수라 fixture 가 파일시스템 없이 각 분기를 겨눈다(원 plan이 요구한 형태 그대로).
- **negative-path fixture** — `plan-scan.test.ts` `describe("checkPlanFrontmatter", …)` (219줄~)
  가 원 plan 이 예시로 든 placeholder 전부(`TBD`·`미정`·`pending`·`assigned at impl-start`·
  `착수 시 지정`)를 개별 단언하고, `worktree`/`owner` 누락·빈 문자열, 비-ISO `started` 를
  각각 검증한다. **"위반 3건을 심고 정확히 그 3건만 잡히는지"** 도 283~286줄에
  `{worktree:"TBD", started:'"nope"', owner:'""'}` 조합으로 `["worktree-placeholder",
  "started-invalid", "owner-missing"]` 를 정확히 단언한다.
- **ISO 달력 유효성** (원 plan의 "함께 볼 것" 축) — `isIsoDate` 가 형태 검사 뒤 UTC 라운드트립
  비교까지 수행해 `2026-13-32`·`2026-00-10`·`2026-02-30`·`2026-04-31`·`2027-02-29`(비-윤년)를
  전부 거부하고, `2028-02-29`(윤년)는 허용한다 — `plan-scan.test.ts:255-279` 에서 확인. 종전
  `/^\d{4}-\d{2}-\d{2}$/` 형태-only 검사가 놓치던 정확히 그 결함이 닫혔다.
- **뮤테이션 확인** — 코드 주석(`plan-scan.ts:199-204`)과 커밋 `e64b1218b`("isIsoDate
  라운드트립 비교를 하나로 — 나머지 둘은 관측 불가 분기였다")가 뮤테이션 라운드를 거쳐
  중복 분기를 제거한 이력을 남긴다.

네 항목 모두 코드에 반영되어 있어 등재 삭제가 "사라진 것" 이 아니라 정당한 종결이다.
`spec/**`·`plan/**` 전수 grep 결과 삭제된 파일명에 대한 dangling 참조는 `review/**` 시점
기록물(정상, `plan-lifecycle.md §3` "인입 참조" 규칙)뿐이고 그 외에는 없다.

## 점검 2 — 신규 등재 항목이 다른 in-progress plan 과 중복되지 않는가

**결론: 중복 없음, 경계가 명시적으로 유지되고 있다.**

- `docs-guard-walker-dedup.md` 의 2026-08-10 절(5건: gray-matter 캐시 우회 관용구 통합,
  `collectCompletePlans`/`collectCompletePlanMarkdown` 동등성 계약, `spec-links.ts` 내부 DFS
  중복, `extractLinks` 성능, `hasValidSpecImpact` fixture 갭)은 전부 **TypeScript 문서 가드
  (`codebase/frontend/src/lib/docs/__tests__/`)** 스코프다.
- `harness-env-value-subpattern-dedup.md` 는 **`.claude/hooks/*.py` 정규식 상수** 중복을
  다룬다 — 코드베이스·언어·실패 모드가 다르다.
- 두 파일이 서로를 명시적으로 상호 링크하며("함께 볼 것 — 같은 'DRY vs 안전성' 축의 다른
  plan"), 한때 walker 항목들이 `harness-env-value-subpattern-dedup.md` 로 이관됐다가 다시
  분리된 이력과 그 근거(코드베이스·언어·실패 모드 상이, `#970` 인용 범위를 좁힌 정정 포함)를
  본문에 남기고 있다 — 이는 과거 plan-coherence 라운드의 WARNING 을 정확히 반영한 결과다.
  `plan/in-progress/*.md` 전수 grep(`parseFrontmatterSafe`·`hasValidSpecImpact`·
  `collectCompletePlans`·`extractLinks`)으로도 이 신규 항목들이 다른 plan 에 중복 등재되지
  않았음을 확인했다.
- "네 벌 → 한 벌" 요약 정정도 코드와 대조해 확인 — `plan-scan.ts:15-21` 헤더 주석이 정확히
  "네 벌 있었고 … 이 파일이 합친 것은 **그중 둘**" 이라고 적고 있어, `docs-guard-walker-dedup.md`
  §"대상 — walker 3벌" 의 정정 서술과 일치한다(문서-코드 불일치가 없다).

## 점검 3 — 상호 참조 링크

전부 실존 확인:

- `docs-guard-walker-dedup.md` → `harness-env-value-subpattern-dedup.md` (같은 디렉터리) — 존재.
- `harness-env-value-subpattern-dedup.md` → `docs-guard-walker-dedup.md`, →
  `../complete/harness-push-gate-did-not-fire.md` — 둘 다 존재.
- `harness-review-gate-followups.md` → `../complete/harness-review-gate-ci-backstop.md` — 존재.
- `spec-impl-evidence.md` 의 `code:` 프론트매터에 `plan-scan.ts` 가 신규 등재돼 §4.2 표
  서술("판정 로직은 `plan-scan.ts`(수집·frontmatter·status)와 `spec-links.ts`(링크) 소관")과
  실제 코드가 line-level 로 일치한다.

## 추가 확인 — `harness-review-gate-followups.md` 신규 등재(2026-08-10, orchestrator changeset
결함 두 번째 형태)

측정치를 재현·대조했다: 커밋 `bc10e215e`(03:07:38)·`e64b1218b`(03:10:27) 시각이 인용과
일치하고, 뒤이은 리뷰 세션 `review/code/2026/08/10/03_12_29/meta.json` 은 27개 파일을
changeset 으로 잡았는데 그 안에 `plan-scan.ts`/`plan-scan.test.ts`/`plan-frontmatter.test.ts`
가 **0건**이며(직접 grep 확인), `agents_forced: ["documentation", "requirement"]` 로 강제 2명만
실행되고 나머지가 router 판정으로 skip 된 것도 메타데이터와 일치한다. 서술이 과장되지 않았고
같은 결함의 "배치 분할" 형태(1차, `backend-lint-gate-broken-on-main.md` 가 정확히 이 문서로
cross-link)와 명확히 구분해 적었다.

## 발견사항

없음. 세 점검 항목 모두 코드/메타데이터 실측으로 확인됐고, CRITICAL/WARNING 급 불일치를
발견하지 못했다.

## 요약

이번 라운드의 plan 트리 변화 셋 — `docs-guard-legacy-fixture-coverage.md` 삭제,
`docs-guard-walker-dedup.md` 신규 5건 추가 + 요약 정정, `harness-review-gate-followups.md` 의
두 번째 changeset 결함 등재 — 은 모두 target(`spec/conventions/`, 특히
`spec-impl-evidence.md`)과 정합하고, 상호 링크가 살아 있으며, 삭제된 plan 의 항목은 코드
(`plan-scan.ts`/`plan-scan.test.ts`)로 전부 실측 확인됐다. 과거 plan-coherence 라운드가 지적한
`harness-env-value-subpattern-dedup.md` 와의 경계 문제도 이번 라운드에서 명시적 근거와 상호
링크로 해소됐다. 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 어느 유형의 문제도
발견되지 않았다.

## 위험도

NONE

STATUS=success
