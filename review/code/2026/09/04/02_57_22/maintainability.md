# 유지보수성(Maintainability) 리뷰

## 사전 확인

이 변경분(`repo-guards/__tests__/` walker 통합 + `widenedEntityFields`/`findStaleSpecCasts` 신설
+ `plan/in-progress/entity-nullable-column-type-mismatch.md` 갱신)은 이미 이전 3개 라운드
(01:48~01:49 / 02:12 / 02:35, 각 라운드 `RESOLUTION.md` 확인)에서 maintainability 관점의
WARNING 4건(임시 픽스처 헬퍼 중복 `withFiles`/`withFixture` · JSDoc 삽입 위치로 인한 orphan ·
`stripLiterals` 테스트 부재 · "원리적으로 불가능" 오판)이 전부 지적·조치됐다. 현재 `HEAD`
(`df552e4c8`)의 실제 소스를 직접 열어 그 조치가 반영돼 있는지 재확인했다(문서 인용이 아니라
`Read` 로 직접 대조):

- `source-scan.ts`: `stripLiterals` 의 JSDoc 이 자신의 선언 바로 위에 붙고, `countCalls` 도
  자신의 JSDoc(57~62줄 상당)을 되찾았다 — orphan 해소 확인.
- `nullable-type-lie-cast.spec.ts`: `withFiles` 하나로 합쳐졌고 `withFixture` 는 그 위의 얇은
  래퍼(3줄)로만 존재 — 중복 해소 확인.
- `source-scan.spec.ts`: `stripLiterals` 전용 `describe` 블록에 7개 테스트(따옴표 보존·멀티라인·
  이스케이프·리터럴 밖 불변·다중 리터럴·알려진 한계 캐너리) 확인 — 비대칭 해소 확인.
- `nullable-type-lie-cast.spec.ts` `collectTsFiles` 정렬 분기: `nested-sibling.ts` 픽스처로
  DFS 순서와 정렬 순서가 실제로 갈리는 것을 코드로 확인 — "원리적으로 불가능" 오판 정정 확인.

따라서 아래는 그 조치들을 재론하지 않고, **이번 라운드에서 새로 본 관점**만 기록한다.

## 발견사항

- **[INFO]** `collectTsFiles` 로 위임하는 1줄 래퍼가 4개의 서로 다른 이름으로 남아 있다(신규
  발견 아님 — 2R/3R 에서 이미 지적·유예 확정된 항목을 재확인)
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` 의
    `collectSourceFiles` (게이트 46~48), `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    의 `listSourceFiles` (게이트 47~51), `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`
    의 `collectScanTargets` (게이트 38~40), `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts`
    의 `listProductionSources`(diff 상 게이트 94, 구현은 `return collectTsFiles(srcDir);` 한 줄) —
    그리고 `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:157`
    는 래퍼 없이 `collectTsFiles(root)` 를 직접 호출한다.
  - 상세: 지금은 전부 `collectTsFiles` 를 그대로 전달하는 동의어인데 이름은 제각각이라,
    다음에 이 코드를 처음 보는 사람은 네 함수가 서로 다른 필터 로직을 가진다고 오인하기
    쉽다(리팩터 전에는 실제로 미묘하게 달랐다 — `plan/in-progress/entity-nullable-column-type-mismatch.md`
    의 "다섯 사본" 표가 그 이력을 남겨 두고 있다). 다만 이건 2R(`review/code/2026/09/04/02_12_38/RESOLUTION.md`
    INFO#3)과 3R(`review/code/2026/09/04/02_35_22/RESOLUTION.md` INFO#7)에서 두 번 검토된 뒤
    "지금 통일하면 5개 가드의 공개 표면을 동시에 바꾸는 별건이 된다" 는 이유로 명시적으로 유예된
    항목이다 — 각 가드의 `.spec.ts` 가 이미 그 이름을 참조하고 있어 이번 diff 범위에서 이름을
    맞추지 않은 것은 합리적이다.
  - 제안: 이번 라운드에서 추가 조치는 불필요(이미 근거를 남기고 유예된 결정). 다음에 이 5개
    가드 파일 중 하나라도 다시 만질 일이 있으면 그때 `collectSourceFiles` 한 이름으로 통일하는
    것을 함께 고려.

## 요약

이 diff 는 `repo-guards/__tests__/` 5곳에 흩어져 있던 재귀 디렉터리 walker(`readdirSync` 기반)를
`common/__test-utils__/source-scan.ts` 의 `collectTsFiles(root, { includeSpec })` 하나로 통합하고,
그 위에 "넓혀진(nullable 화된) 엔티티 필드를 겨눈 낡은 `.spec.ts` 캐스트" 를 잡는 신규 가드
(`widenedEntityFields`/`findStaleSpecCasts`)를 추가한 것이다. 이미 3개 리뷰 라운드를 거치며
동작(정렬 커버리지 오판) → 구조(픽스처 헬퍼 중복·이름 매칭 오탐) → 문서(JSDoc 배치·검증 안 되는
숫자 기재)의 순서로 발견된 문제가 전부 소스에 반영돼 있는 것을 직접 파일을 열어 확인했다. 함수
길이·중첩 깊이·순환 복잡도 모두 낮게 유지된다(`collectTsFiles`·`widenedEntityFields`·
`findStaleSpecCasts` 전부 20줄 안팎, 중첩 2~3단 이내). 각 정규식·필터 축마다 "왜 필요한가"와
"한계"를 다루는 JSDoc 을 갖추는 이 파일군의 확립된 관례도 신규 함수 전체에 일관되게 적용돼 있다.
유일하게 남은 항목은 통합된 `collectTsFiles` 위에 남은 4개의 서로 다른 이름의 1줄 래퍼인데, 이는
이미 두 차례 리뷰에서 검토돼 근거와 함께 명시적으로 유예된 결정이라 이번 라운드의 새로운 결함으로
보지 않는다. 이번 라운드에서 새로 발견된 CRITICAL/WARNING 급 유지보수성 결함은 없다.

## 위험도

NONE
