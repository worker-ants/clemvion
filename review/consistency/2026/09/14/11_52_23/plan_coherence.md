# Plan 정합성 검토 — plan_coherence

## 검토 범위 메모

이번 검토의 실제 diff(`origin/main...HEAD`)는 `spec/conventions/**` 를 전혀 건드리지 않는다 —
6개 변경 파일은 전부 `codebase/backend/**` 테스트(`trigger-secret-columns-{guard,spec}.ts`,
`trigger-workflow-ref.spec.ts`, e2e 3건)와 `plan/in-progress/{trigger-canary-hardening.md,
spec-draft-nullable-notation-followups.md}` 다. 따라서 "target = `spec/conventions/`" 는
**정적 대조 기준**으로 쓰고, 실제 정합성 이슈는 이 브랜치가 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 에 새로 등재한 4개 트래커 항목이 (a) 다른
in-progress plan 이 이미 들고 있는 미해결 결정과 중복/미상호참조하는지, (b) `spec/conventions/`
가 이미 확정한 내용과 충돌하는지를 기준으로 판단했다.

## 발견사항

- **[WARNING]** 신규 항목 "repo-guard 등재 규약 부재"가 이미 존재하는 동일 미해결 결정을
  중복 등재하고 서로를 가리키지 않는다
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목
    "신규 repo-guard 가 spec `code:` 에 미등재 — 다만 «관례» 라 부를 만큼 일관되지 않다"
    (2026-09-14 등재, `--impl-done` `11_27_47` rationale_continuity INFO#2 근거)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` §"관련"
    (114~127행) — 2026-08-31 에 이미 *"repo-guard 3파일 패턴에 소유 규약 문서가 없다.
    `spec/conventions/repo-guards.md` 신설 검토는 이 항목과 독립이며 더 큰 결정이라 여기
    묶지 않는다(포인터만 남긴다)"* 를 등재해 두었고, 2026-09-04 재실측으로 "`*-guard.ts` 7 ·
    `*.spec.ts` 8" 로 갱신까지 해 두었다.
  - 상세: 두 plan 이 **같은 미해결 결정**("repo-guard 를 spec `code:` 에 등재하는 것을 규약으로
    세울 것인가")을 각자 별도 항목으로 들고 있는데 서로를 인용하지 않는다. 게다가 신규 항목의
    실측 표(`masked-reject-callers`·`user-entity-exposure` 등재=2, `redis-fail-open-catalog`·
    `param-uuid-pipe`·`engine-error-code-anchor` 미등재=3, 합계 5)는 실제보다 좁다 — 오늘
    워킹트리에서 `find codebase/backend -path '*repo-guards*' -name '*-guard.ts'` 는 **14개**
    (신규 `trigger-secret-columns-guard.ts` 포함, 기존 13개)를 반환하고, `grep -rl` 로
    `spec/**` 등재 여부를 대조하면 실제 등재는 `masked-reject-callers`·`user-entity-exposure`
    뿐 아니라 `dto-jsdoc-citation-guard`(`review-citations.md`·`spec-impl-evidence.md`)·
    `swagger-dto-contract-guard`(`swagger.md`·`2-api-convention.md`)까지 **4개**다. 신규
    항목이 "형제 5개 중 2개 등재"라 적은 것은 실제 "형제 13개 중 4개 등재"의 부분집합이다.
    두 plan 이 서로 다른 축소된 스냅샷을 근거로 독립적으로 이 결정에 도달하면, 한쪽이 먼저
    resolve 될 때 다른 쪽의 수치·범위가 stale 상태로 남는다.
  - 제안: 신규 항목에 `spec-conventions-engine-error-code-surface.md` §"관련" 포인터를
    상호 인용으로 추가하고, 실측 표를 "13개 중 4개"로 갱신한다. 두 plan 중 어느 쪽이
    이 결정(`spec/conventions/repo-guards.md` 신설 여부)의 정본인지 명시한다.

- **[WARNING]** 신규 harness 항목 "`--impl-prep`/`--spec` 번들이 spec 전체를 절단"이
  `harness-review-gate-followups.md` 에 이미 더 상세히 진단된 동일 결함 클래스를
  상호참조하지 않는다
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목
    "`--impl-prep`/`--spec` 번들이 `spec/` 코퍼스를 통째로 절단한다 — 기록된 범위보다
    넓다" (2026-09-14 등재, harness 소유)
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` §"승격은 됐는데
    굶는다 — tier 안의 거대 파일 하나가 corpus 몫을 다 먹는다" (1091~1197행) 및 §M
    (1199~1239행) — `prioritize_bundle_files`/`truncate_file_bundle` 의 꼬리-드롭 결함을
    실측·근본원인까지 규명했고, 처방 후보 (a)/(b)/(c)/(d) 를 이미 나열했으며 *"어느 쪽이든
    `--spec`/`--impl-prep`/`--impl-done` 세 모드에 같이 걸어야 한다 — 이 결함은 랭킹 층에
    있어 모드와 무관하다"* 라고 명시했다(1191행).
  - 상세: 신규 항목이 관측한 현상(`--impl-prep`, `spec/conventions/` scope, 387개 중 380개
    절단)은 이미 문서화된 "꼬리-드롭 + 생략-알림 비용 경쟁" 메커니즘과 같은 원인일 가능성이
    높다 — 둘 다 corpus 예산 대비 tier 1 파일들의 총합이 커서 뒤쪽이 전멸하는 형태다. 신규
    항목은 이를 처음 발견된 별개 결함처럼 서술하고 독자적인 처방 후보 (a)/(b)/(c) (SUMMARY
    미검증 관점 기록 / related_specs 재정렬 / 관점별 번들 분할)를 제시하는데, 기존 항목의
    처방 후보와 안 겹치는지, 같은 근본원인 수정으로 둘 다 해소되는지가 불명확하다. 두 plan
    이 독립적으로 진행되면 harness 코드에 서로 다른 처방이 중복 적용되거나 한쪽 fix 가
    다른 쪽 캐너리를 무효화할 위험이 있다.
  - 제안: 신규 항목에서 `harness-review-gate-followups.md` §"승격은 됐는데 굶는다" / §M 을
    인용하고, 같은 근본원인인지(꼬리-드롭 vs 다른 경로) 최소 1줄 판정을 추가한다. 두 항목을
    같은 planner 세션에서 함께 검토하도록 owner 를 harness 로 통일해 명시.

- **[WARNING]** 신규 항목 "`cafe24-api-catalog/_overview.md` 에 lifecycle frontmatter 없음"이
  이미 확정된 spec 규칙과 충돌한다 (false-positive 가능성 높음)
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목
    "`spec/conventions/cafe24-api-catalog/_overview.md` 에 lifecycle frontmatter 가 없다"
    (2026-09-14 등재, planner 소유, `--impl-prep` `10_44_37` convention_compliance WARNING#2)
  - 관련 target: `spec/conventions/spec-impl-evidence.md` §1 (제외 목록) — *"`spec/_*.md`
    및 `spec/<영역>/_*.md` (밑줄 prefix — leaf 가 아닌 layout/index 성격, 예: `_layout.md`,
    `_product-overview.md`, **`_overview.md`**)"* 를 이미 명시적으로 예외로 적어 두었다.
    구현(`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` `isApplicable()`)도
    `base.startsWith("_")` 이면 깊이와 무관하게 즉시 제외한다 — 실측: `INCLUDE_PREFIXES`
    에 `spec/conventions/` 가 있고 `cafe24-api-catalog/_overview.md` 의 basename 이 `_` 로
    시작하므로 frontmatter-evidence 가드 대상에서 **이미** 빠져 있다.
  - 상세: 신규 항목은 이 파일을 "형제 18개 `<resource>.md` 는 다 가졌는데 자신만 없다"고
    지적하며 "(a) frontmatter 추가 (b) §7.1 예외 glob 에 `_overview.md` 명시" 중 하나를
    선택해야 하는 **미해결 결정**처럼 등재했다. 그러나 실측하면 이 파일은 spec·코드 양쪽에서
    이미 예외로 확정돼 있어 "결정"이 필요한 사안이 아니다 — 항목 자신도 각주에서
    *"checker 가 `spec-impl-evidence.md` 원문 절단으로 정규식까지는 대조하지 못했다"* 고
    한계를 인정한다(그 원인은 위 §"이 검토가 실제로 다루는 델타" 의 예산 절단과 같은 세션 결과).
    실제로 남는 것은 "`_overview.md §7.1` 이 스스로 `_overview.md` 자신의 제외 근거를
    로컬 재인용하지 않는다"는 훨씬 좁은 문서 명료성 문제뿐이다.
  - 제안: 이 항목을 "frontmatter 추가 여부 결정" 프레이밍에서 "§7.1 에 `_overview.md` 자신이
    §1 예외(밑줄 prefix)에 해당한다는 한 줄 상호참조 추가"로 좁혀 재등재한다. 현재 프레이밍
    그대로 planner 에게 넘기면 이미 답이 정해진 질문에 (a)/(b) 택일 판단을 요구해 불필요한
    작업(frontmatter 추가 시 오히려 §1 예외 규칙과 모순)을 유발할 위험이 있다.

## 요약

이번 diff 자체(트리거 캐너리 테스트 4종 + repo-guard 신설)는 `spec/conventions/` 를 건드리지
않고 다른 in-progress plan 의 전제도 침해하지 않는다 — 비밀 컬럼 목록·시크릿 컬럼명을 동시에
바꾸는 다른 plan 은 없고, 새 repo-guard 는 독립적으로 안전하게 추가됐다. 다만 이 브랜치가
`spec-draft-nullable-notation-followups.md` 트래커에 새로 얹은 4개 파생 항목 중 셋은 plan
생태계의 정합성을 흐린다: 둘은 이미 다른 in-progress plan(`spec-conventions-engine-error-code-
surface.md`, `harness-review-gate-followups.md`)이 더 상세히 들고 있는 미해결 결정을
상호참조 없이 중복·축소 등재했고, 하나는 이미 spec 이 확정한 예외 규칙과 충돌하는 false-positive
프레이밍을 그대로 옮겼다. 셋 다 즉시 스펙/코드 충돌을 일으키진 않지만, 방치하면 서로 다른
세션이 같은 질문에 다른 답을 내리거나 이미 답이 난 질문에 재작업을 낭비하게 된다.

## 위험도
MEDIUM
