# 변경 범위(Scope) 리뷰 — repo-guard walker 통합 + 낡은 spec 캐스트 가드 (4R)

## 검증 방법

`git diff --stat origin/main...HEAD` 로 이번 diff 의 파일 목록을 직접 뽑아, 프롬프트가 나열한
45개 파일(파일 1~45)과 **완전히 일치**함을 확인했다(추가·누락 없음). `git diff -w --stat` 을
핵심 소스 8개 파일에 대해 공백-무시로 다시 돌려 일반 `--stat` 과 **바이트 단위로 동일**함을
확인했다 — 포맷팅-only 변경이 실질 변경에 섞여 들어간 곳이 없다. `plan/in-progress/
entity-nullable-column-type-mismatch.md` 의 diff 가 단일 hunk(`@@ -241,10 +241,49 @@`)임을
재확인했다. `nullable-type-lie-cast-guard.ts`/`.spec.ts` 현재 소스를 직접 `Read` 해 3R
RESOLUTION(`02_35_22/RESOLUTION.md`)이 주장한 W1 fix(`widenedEntityFields` docstring 에서
"실측 20건" 하드코딩 수 제거, `isNullableType` 도입)가 실제로 반영돼 있음을 코드에서 확인했다.
저장소 트리에는 아무것도 쓰지 않았다(`git status --short` — untracked 는 이 세션 산출물
`review/code/2026/09/04/02_57_22/` 하나뿐).

## 발견사항

- **[INFO]** 핵심 코드 변경(파일 1~9)은 plan 문서에 사전 등록된 정확히 두 개의 후속 항목에
  1:1 로 대응하며, 3라운드에 걸친 fix 커밋(`6c5b3b74a`·`79bce075e`·`df552e4c8`)도 전부 그
  범위(가드 소스·해당 spec·plan 문서·해당 라운드 리뷰 산출물) 밖으로 번지지 않았다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:244-283` (두 체크박스),
    비교 대상은 `codebase/backend/src/common/__test-utils__/source-scan.ts`(신설
    `collectTsFiles`/`stripLiterals`)와 `codebase/backend/src/repo-guards/__tests__/
    nullable-type-lie-cast-guard.ts`(신설 `widenedEntityFields`/`findStaleSpecCasts`).
  - 상세: ① `repo-guards/__tests__/` 5개 가드에 중복돼 있던 재귀 디렉터리 walker
    (`collectSourceFiles`·`walkTsFiles`·`listSourceFiles`·`collectScanTargets`·
    `listProductionSources`)를 `source-scan.ts` 의 `collectTsFiles(root, { includeSpec })`
    하나로 통합 — 소비처 4개 가드(`audit-action-binding-guard.ts`·
    `engine-error-code-anchor-guard.ts`·`masked-reject-callers-guard.ts`·
    `redis-fail-open-catalog-guard.ts`)는 각각 자체 walker 삭제 후 위임 한 줄로 교체됐을
    뿐, 판정 로직(`importsBaseFn`·`readDeclaredCodes` 등)은 손대지 않았다. ②
    `.spec.ts` 안에 남는 "넓혀진 nullable 필드를 겨눈 낡은 `null as unknown as` 캐스트"를
    잡는 신규 가드(`widenedEntityFields`/`findStaleSpecCasts`)는 plan 문서가 이미
    "배치가 끝날 때마다 손으로 grep 하는 것이 현실적" 이라고 수작업으로 적어 둔 사각지대를
    자동화한 것이다. 3라운드 fix 커밋도 `git show --stat` 기준으로 건드린 파일이 각각의
    지적 대상(가드 소스·spec·plan·그 라운드 리뷰 산출물)에 정확히 국한돼 있어, "리뷰 지적을
    고치다 다른 곳도 정리"하는 드리프트가 관찰되지 않는다.
  - 제안: 조치 불필요. 확인 목적의 기록.

- **[INFO]** `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38,02_35_22}/**` (파일 10~45,
  36개)이 diff 에 포함됨 — 이전 3라운드 리뷰 세션의 산출물이며 스코프 이탈이 아니다.
  - 위치: 파일 10~45 전체.
  - 상세: `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"
    규약대로 생성된 정상 워크플로 부산물이며, 이 저장소 관례상 `review/` 는 gitignore 대상이
    아니라 커밋되는 산출물이다(`feedback_review_guard_push_timestamp.md`: "체크박스·plan
    이동은 마무리 커밋에서"). 내용도 전부 지금 검토 중인 바로 이 두 작업(walker 통합·낡은
    spec 캐스트 가드)에 대한 리뷰이지 무관한 산출물이 아니다. 1R·2R·3R scope 리뷰
    (`01_49_18/scope.md`·`02_12_38/scope.md`·`02_35_22/scope.md`)가 매 라운드 동일 결론을
    냈고, 이번 라운드도 파일 목록을 `git diff --stat` 으로 재검증해 일치를 확인했다.
  - 제안: 조치 불필요.

- **[INFO]** `collectTsFiles` 통합이 "순수 추출"을 살짝 넘어 walker 하나(`masked-reject-callers-guard.ts`
  의 `listSourceFiles`)에는 `.d.ts` 배제·정렬을 부수적으로 새로 적용한다 — 1R 부터 3라운드
  연속으로 관측·추적된 항목, 이번에도 재확인만 하고 신규 지적으로 올리지 않음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:47-52`
    (`listSourceFiles` → `collectTsFiles(rootDir, { includeSpec: true })`).
  - 상세: 원래 이 파일의 walker(diff 삭제분)는 `.ts` 로 끝나기만 하면 담았고 `.d.ts` 배제도
    `sort()` 도 없었다. 통합 후에는 둘 다 덤으로 따라붙는다. `source-scan.ts` docstring 의
    축별 실측 표와 plan 문서 양쪽이 "`src` 하위 `.d.ts` 0개"를 근거로 남겨 오늘은 동작
    불변임을 뒷받침하고, 저자가 이 확장을 의도적으로 결정했다는 근거(주석)도 있다. scope
    위반으로 보지 않는다 — "walker 추출은 순수 동작 불변"이라는 절대적 읽기를 할 경우에만
    오해할 수 있는 지점이라 기록만 유지한다.
  - 제안: 조치 불필요.

## 요약

핵심 변경 9개 파일은 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 사전
등록된 두 후속 항목(공용 walker 추출·낡은 spec 캐스트 가드)에 정확히 결속되며, `git diff
--stat` 으로 뽑은 45개 파일 전체 목록이 프롬프트가 나열한 목록과 완전히 일치해 요청 범위
밖의 파일이 섞여 들어온 흔적이 없다. 3라운드(1R→2R→3R)에 걸친 리뷰-수정 사이클에서도 각
fix 커밋이 지적 대상 파일 밖으로 번지지 않았고(`git show --stat` 확인), 공백-무시 diff 가
일반 diff 와 바이트 단위로 동일해 포맷팅-only 변경이 실질 변경과 섞이지도 않았다.
`review/code/**` 하위 36개 파일은 이 저장소의 확립된 워크플로 관례(리뷰 산출물을 마무리
커밋에 함께 담음)이지 무관한 파일 수정이 아니다. 유일하게 반복 관찰되는 지점은 통합된
`collectTsFiles` 가 walker 하나(`masked-reject-callers-guard.ts`)에 `.d.ts` 배제·정렬을
부수적으로 새로 적용한다는 것인데, 저자가 실측 근거와 함께 의도적으로 결정한 확장이라
이번에도 scope 위반으로 판단하지 않는다. 요청하지 않은 기능 추가·불필요한 리팩터링·무관한
파일 수정·의미 없는 포맷팅 변경은 발견되지 않았다.

## 위험도

NONE
