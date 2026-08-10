# RESOLUTION — 2026-08-09 23:43:28

SUMMARY: Critical 0 · WARNING 2 · risk LOW (reviewer 7/7 디스크 실측, unfinished 0).

## WARNING 2/2 조치

### W1 — 링크 스캐너를 공유 구현으로 교체 (maintainability)

**지적**: 신규 `relativeLinkTargets` 정규식이 같은 디렉터리의 더 견고한
`spec-links.ts` 스캐너를 재사용하지 않았다. 코드펜스 안의 링크까지 실제 검증 대상으로
취급해, plan 문서 예시 스니펫에 없는 경로를 적으면 거짓 양성으로 push 가 막힌다.

**실측 확인**: `spec-links.ts` 의 `findBrokenLinksInFiles` 는 module-private 이고 공개
진입점 두 개(`findBrokenLinks`·`findBrokenSpecLinksInSources`)가 "파일 집합과 옵션 두 개만
다르다" 는 구조다. 세 번째 진입점 `findBrokenPlanLinks(root)` 를 그 자리에 추가하고
`plan-frontmatter.test.ts` 는 그것을 호출하도록 바꿨다. 약한 사본은 삭제.

> **교체하자마자 9번째 위반이 드러났다.** `cafe24-backlog-residual.md:20` 의
> `../../spec/2-navigation/4-integration.md#92-주요-api` 는 **앵커가 stale** 이었다 —
> 스펙이 재편돼 §9.2 는 이제 "인증 / 회전 / Scope" 다. 내 정규식은 `#fragment` 를 떼고
> 경로만 확인해서 통과시켰고, 공유 스캐너는 앵커를 heading slug 와 대조한다.
>
> 정본은 **§9.1 목록·CRUD** 다. 그 절(795행)이 바로 C-6 `buildIntegrationMeta` derived
> 필드 일반화를 서술하고 이 plan 을 역참조하고 있다 — 추측이 아니라 본문 대조로 확정했다.

이로써 이 PR 이 고친 살아있는 plan 링크는 8건 → **9건**이다.

### W2 — 이동 체크리스트(§5)에 신설 규칙 반영 (documentation)

**지적**: 두 게이트 규칙이 `plan-lifecycle.md §4` 에만 들어가고, 사람이 직접 보는
§5 "이동 commit 자가 점검" 체크리스트에는 없었다. 테스트가 사후에 잡지만 체크리스트만
보고 이동하는 사람은 **실패한 뒤에야** 안다.

§5 에 두 항목 추가(`status` 종료값 갱신 · 형제/인입 상대링크 정정) + 왜 테스트가 있는데도
체크리스트에 적는지 근거 1줄. INFO 5 도 함께 반영해 §2.1 의 "강제범위" 서술에 스코프를
명시했다(3-필드 스키마는 top-level in-progress 한정이나, 신설 두 검사는 스코프가 다르다).

## INFO — 이번 턴 미조치

`plan-frontmatter.test.ts` 안에 후속 주석으로 남기지 않고 여기에만 적는다. 전부 현재
데이터에서 0건이고 실질 위험이 없어 plan 등재도 하지 않는다 — 등재 자체가 비용이다.

| # | 내용 | 판단 |
|---|---|---|
| 1 | `in-progress/` 에 종료 status 선언(거울상)은 미검사 | 실측 0건. 대칭 가드는 값보다 표면을 늘린다 |
| 2 | `status` 가 비-문자열이면 조용히 skip | 실측 0건 |
| 3 | 루트-상대 링크(`](/spec/...)`) 해석 | **공유 스캐너로 교체하며 자동 해소** |
| 4 | 신규 헬퍼의 fixture 격리 테스트 부재 | vacuity 하한 단언으로 방어 중 |
| 6 | `merged_pr` 필드가 §4 스키마에 미등재 | `status` 는 순수 리터럴이어야 한다는 규칙이 §4 에 이미 생겼고, 부가 필드는 스키마상 허용(`priority`/`title` 등과 동급) |
| 7 | reference-style 링크 미스캔 | **공유 스캐너 소관**으로 이동 — 그쪽 한계이고 실측 0건 |

## 검증

- 문서 가드 **18파일 / 2823 tests PASS** (교체 후 재실행)
- harness **995 tests OK**
- TEST WORKFLOW (fix 전 본체 기준) — lint PASS(50s) · unit PASS(80s) · build PASS(111s) ·
  **e2e PASS(288s, 264)**
- fix 후 변경 set 은 `codebase/frontend/src/lib/docs/__tests__/**` + `.claude/docs/**` +
  `plan/**` 이다. `codebase/**` 가 포함되므로 **e2e 면제 아님** — 아래 재수행 줄 참조.

## e2e

통과 — 본체 e2e PASS(288s, tests=264) 이후 fix 가 **테스트 파일과 문서만** 건드렸으나,
`codebase/frontend/**` 가 변경 set 에 있어 PROJECT.md §e2e 면제 화이트리스트의 부분집합이
아니다. 마지막 코드 commit 다음에 e2e 통과 줄이 있어야 한다는 규칙에 따라 재수행했다.
