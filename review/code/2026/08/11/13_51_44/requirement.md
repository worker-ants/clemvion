# 요구사항(Requirement) Review

대상 plan: `plan/in-progress/docs-guard-walker-dedup.md` (`착수 전 필수` 3항목 + 후속 항목 다수)

## 검증 방법

`origin/main`(`da078a63f`) 대비 이 브랜치의 4개 커밋(`75f2e2af9`·`f2b4cdd1e`·`6002603e1`·`bf0dfc98c`)을
`git show`로 함수 단위 byte-diff 하고, `codebase/frontend`에서 `vitest run src/lib/docs/__tests__`를
직접 실행해 plan이 주장하는 수치(2893 passed)를 재현했다.

## 발견사항

- **[WARNING]** "착수 전 필수" 3번째 항목("각 가드의 대상 파일 집합이 통합 전후로 동일한지를
  **테스트로 고정**할 것")이 문자 그대로는 이행되지 않았다 — 실제로 고정된 것은 **일회성 수작업
  대조**이고, 커밋 가능한 재현 아티팩트가 없다.
  - 위치: `plan/in-progress/docs-guard-walker-dedup.md` "### 조용한 스코프 변경 0 — 집합으로
    증명" 절(파일 컨텍스트 159-165행) — "통합 전 7개 집합을 파일로 찍고 통합 후와 원소·순서까지
    대조했다"는 서술이 유일한 근거다. `codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts`
    의 `describe("수집기 필터 배선 — 합성 트리", ...)`(파일 컨텍스트 111-188행)가 새로 추가한
    테스트는 **합성 fixture 위에서 각 수집기(`collectSpecMarkdown`/`collectApplicableSpecs`/
    `collectCodebaseSources`/`collectMdxFiles`)가 개발자가 재구성한 "기대 규칙"과 일치하는지**를
    고정할 뿐, **삭제된 옛 손수-DFS 구현의 실제 출력과 diff** 하지 않는다 — 옛 구현은 이미 지워졌고
    비교 대상 스냅샷(예: 실저장소 전체 파일 목록 dump)도 저장소 어디에도 남아있지 않다
    (`git log origin/main..HEAD --name-status` 로 4커밋 전수 확인 — 그런 아티팩트 파일이 없다).
    "2075 → 2076", `collectMdxFiles` 정렬 기준 변경(절대경로 `sort()` → 상대경로
    `localeCompare`) 동일성도 같은 절 안의 산문 서술로만 남아 있다.
  - 상세: 이 gap 자체가 실제 스코프 회귀를 낳지는 않았다 — 리뷰어가 독립적으로 `origin/main`의
    옛 구현(`walkPlanMarkdown`·`collectSpecMarkdown`·`collectCodebaseSources`·`collectApplicableSpecs`
    ·`collectMdxFiles`·Gate C 5함수)을 하나씩 byte-diff 해 필터 로직이 전부 동등하게
    이전됐음을 확인했고(`collectApplicableSpecs`의 `path.relative` → `/` 정규화 한 곳만 POSIX 상
    무해한 의도적 수정), `vitest run src/lib/docs/__tests__`도 **2893 passed**로 plan의 주장과
    일치했다. 다만 이 review 세션이 한 수작업 검증을 이 PR 은 테스트로 남기지 않았다 — 다음
    사람이 (a) 옛 구현이 삭제된 상태에서 (b) 이 PR의 "동일함" 주장을 재현할 방법이 plan 문서의
    산문 신뢰뿐이다. plan의 문구("테스트로 고정")와 실제로 landed 된 것("새 구현의 합성-fixture
    회귀 테스트" + "일회성 수작업 dump-diff") 사이에 괴리가 있다.
  - 제안: 최소한 실저장소 전체 스캔 결과의 개수(`collectCodebaseSources(root).length` 등)를
    `toBeGreaterThan`류가 아니라 정확한 스냅샷/카운트로 pin 하는 테스트 한 줄이라도 남기면
    "다음 변경이 조용히 집합을 바꾸는지"를 실데이터 위에서 계속 검증할 수 있다(현재는 실데이터
    경로에서의 집합 동일성 검증이 `spec-plan-completion.test.ts`류 sibling guard의 간접 통과
    여부에만 의존한다). 이미 지나간 "이전 구현과의 동등성"은 재현 불가하므로 plan 서술의
    표현을 "테스트로 고정"에서 "실측 후 합성 fixture로 forward 고정"으로 정정하는 것도 대안.

- **확인 (문제 없음)** — "PR이 주장하는 '선재 차이 보존'"은 사실이다. `collectSpecMarkdown`
  (카탈로그 전체 `-api-catalog/` 포함 시 제외)과 `collectApplicableSpecs`/`isApplicable`
  (`INCLUDE_PREFIXES` 미스매치로 `spec/` 루트 파일 제외, `CATALOG_FIELD_FILE`은 중첩 파일만
  제외해 카탈로그 최상위 인덱스는 남김)의 비대칭은 `git show da078a63f:...spec-links.ts`·
  `git show da078a63f:...spec-frontmatter-parse.ts`로 직접 대조한 결과 이 PR 이전부터
  **문자 그대로 동일한 로직**으로 존재했다. `walkTree` 전환은 두 함수의 필터 조건을 그대로
  옮겼을 뿐이다 — 조용한 스코프 변경이 아니다.

- **확인 (문제 없음)** — Gate C 게이트 자체 동작은 판정 함수 이동으로 바뀌지 않았다.
  `git show da078a63f:...spec-plan-completion.test.ts`의 `isGateCEnforced`·
  `hasMalformedStarted`·`hasValidSpecImpact`·`danglingSpecImpact`·`makeSpecExists`·
  `GATE_C_CUTOFF`·`NONE_VALUES` 를 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`
  (파일 컨텍스트 345-448행)로 이동한 결과와 byte 단위로 대조 — `danglingSpecImpact` →
  `findDanglingSpecImpact` 개명 외 로직 변경 0. `describe`(게이트)는 여전히
  `spec-plan-completion.test.ts`에 남아 있고, import 배선만 바뀌었다(`spec-plan-completion.test.ts`
  diff 4-16행). `.claude/docs/plan-lifecycle.md:131-132`의 갱신 문구("판정은 `plan-scan.ts`,
  게이트 자체는 `spec-plan-completion.test.ts`")도 이와 정확히 일치한다.

- **확인 (문제 없음)** — `.claude/docs/plan-lifecycle.md` 갱신에 대한 stale pointer 전수
  grep(`hasValidSpecImpact`·`isGateCEnforced`·`hasMalformedStarted`·`makeSpecExists`·
  `GATE_C_CUTOFF`·`NONE_VALUES`·`danglingSpecImpact`, `*.md`+`*.ts` 전체) 결과 다른 살아있는
  문서(`spec/conventions/spec-impl-evidence.md`·PROJECT.md·`.claude/skills/**`)에는 이 위치를
  다르게 서술하는 곳이 없다. `spec-impl-evidence.md`의 `code:` frontmatter 는 이미
  `plan-scan.ts`·`spec-links.ts`를 등재하고 있어 정합적이다(구 이름 `danglingSpecImpact`를
  참조하는 곳은 전부 `plan/complete/**`·`review/**`의 시점 기록 문서뿐 — plan-lifecycle §3의
  "인입 참조" 예외 대상이라 갱신 불요).

- **[INFO]** 신규 공유 구현 파일 `tree-walk.ts`(및 `tree-walk.test.ts`)가
  `spec/conventions/spec-impl-evidence.md`의 `code:` frontmatter 리스트에 없다.
  - 위치: `spec/conventions/spec-impl-evidence.md:4-16` (frontmatter `code:` 목록).
  - 상세: `spec-code-paths.test.ts`는 "`code:`에 등재된 glob이 실존하는지"만 검사하고 "폴더 내
    모든 파일이 어딘가에 등재됐는지" 완전성은 강제하지 않으므로(직접 확인:
    `codebase/frontend/src/lib/docs/__tests__/spec-code-paths.test.ts`) 빌드 가드를 깨지는
    않는다. `plan-scan.ts`·`spec-links.ts`는 이미 등재돼 있는데 이번에 새로 만든 공유 헬퍼만
    빠진 것이라 일관성 관점의 사소한 누락이다.
  - 제안: 다음 그 문서를 손댈 때 `code:`에 `tree-walk.ts`(+ `tree-walk.test.ts`) 추가.

- **[INFO]** (plan 라이프사이클 절차, 차단 아님) `plan/in-progress/docs-guard-walker-dedup.md`는
  이 PR에서 13개 체크박스 전부 `[x]`로 갱신됐고 미해결 항목이 grep 상 0건인데, frontmatter
  `status: in-progress`가 그대로이고 `plan/complete/`로 이동되지 않았다. `.claude/docs/
  plan-lifecycle.md` §3 규칙("이동은 마지막 작업 PR 안에서")대로면 이 PR이 마지막 작업 PR일
  경우 함께 이동해야 하나, 이 PR이 review 사이클(현재 이 리뷰 자체) 진행 중이라 review 이후
  fix 커밋에서 항목이 재오픈될 가능성이 있어 의도적으로 보류했을 수 있다 — push 게이트를
  막는 사항은 아니다(plan이 갱신은 됐으므로 `guard_review_before_push.py`는 통과, Stop hook
  nudge만 해당).

## 요약

핵심 3가지 질문에 대한 답: (1) plan의 "테스트로 고정" 요구는 **문자 그대로는 미이행** —
새 구현의 필터 배선을 합성 fixture로 고정하는 테스트(`tree-walk.test.ts`)는 확보됐지만, 옛
구현과의 진짜 전후 동등성은 일회성 수작업 대조로만 확인됐고 재현 가능한 아티팩트가 없다(다만
리뷰어가 독립적으로 `origin/main` 대비 byte-diff 검증한 결과 실제 회귀는 없었다). (2) "선재
차이 보존" 주장은 `origin/main` 대조로 **사실**임을 확인했다. (3) Gate C 게이트 동작은
판정 함수 이동으로 **바뀌지 않았다**(byte-diff 확인). (4) `plan-lifecycle.md` 갱신은 정확하고
다른 곳에 stale pointer가 남아있지 않다(전수 grep 확인). 전체적으로 구현은 plan이 요구한
의도(파라미터화 통합 + 조용한 스코프 변경 방지)를 실질적으로 충족하지만, "테스트로 고정"이라는
plan 자신의 문구와 실제로 landed된 검증 수준 사이에 괴리가 있다는 점이 유일한 실질적 발견이다.

## 위험도

LOW

STATUS: OK
