# 테스트(Testing) 코드 리뷰 — error-code-emission-axis (라운드 4)

## 검토 범위·방법

이 배치는 `origin/main` 대비 79개 파일이 바뀌지만 실질 코드는 두 파일로 좁혀진다 —
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 정규식 3종 +
공용 수집기 `collectMatches` + `GUIDE_NON_EMITTED_VOCABULARY`)와
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(그 축의 단언
전체 + 진리표/경계 대조군). 나머지는 문서(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`)와
`plan/**`, 그리고 라운드 1~3 `/ai-review`·`--impl-done` 세션의 산출물(`review/**`)이라
테스트 관점의 코드 대상이 아니다.

이 축은 이미 3라운드의 `/ai-review`(19_23_22 → 19_51_33 → 20_13_13)를 거치며 매 라운드
testing 리뷰어가 WARNING을 냈고, 그때마다 합성 판별 fixture·진리표·뮤테이션이 채워졌다
(궤적 W7→W4→W2). 이번 라운드가 보는 것은 **라운드 3 리뷰(`20_13_13`)의 WARNING#2를 고친
fix 커밋(`5778885ce`)** 하나다 — `git show 5778885ce`로 실제 코드 diff를 직접 확인했다.

### 독립 재현 (저장소 뮤테이션, 완료 후 `cp`로 원복·`git status --short`로 확인)

- `codebase/frontend`에서 `guide-identifier-existence.test.ts` 단독 실행 → **71 passed
  (71)**. RESOLUTION.md(`20_34_19`, 커밋 메시지)이 주장한 "68 → 71"과 일치한다(신규
  `describe("staleEntries — 판별 대조군")` 3건 증가).
- `staleEntries`의 필터 방향을 원본 파일에서 직접 반전(`!cited.has(e.token)` →
  `cited.has(e.token)`)한 뒤 재실행 → **4건 FAIL**(신규 대조군 2건 + `GUIDE_NON_EMITTED_
  VOCABULARY`/`GUIDE_EXTERNAL_VOCABULARY` 호출부 2건). 라운드 3 fix 커밋이 주장한 뮤테이션
  결과와 정확히 일치한다. 원본을 `cp`로 즉시 복원했고 `git status --short`로 저장소가
  세션 시작 시점과 동일함을 확인했다(잔여는 이 리뷰 세션 자신의 출력 디렉터리뿐).

## 발견사항

새로 지적할 CRITICAL/WARNING은 찾지 못했다.

- **[INFO]** (회귀 아님, 확인 후 유지) `where` 필드의 `hits.length !== 1` 분기(파일 0건·
  2건 이상)를 겨눈 합성 fixture가 여전히 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:246`
    (`if (hits.length !== 1) { broken.push(...) }`)
  - 상세: 라운드 3 testing 리뷰(`review/code/2026/09/13/20_13_13/testing.md` INFO#2)가
    이미 지적했고, 같은 라운드 RESOLUTION(`review/code/2026/09/13/20_13_13/RESOLUTION.md`
    INFO#11)이 "순수 함수 분리 시 함께" 처리하기로 명시적으로 유예했다. 이번 라운드의
    fix 커밋은 `staleEntries`만 겨눴고 이 항목은 손대지 않았다 — 계획대로다. 새로운 결함이
    아니라 기존에 문서화된 유예 항목이 그대로 남아 있음을 확인한 것으로만 기록한다.
  - 제안: 조치 불요(기존 유예 유지). 향후 이 검증 로직을 `guide-identifier-scan.ts`의
    순수 함수로 뽑을 때 0건·2건 이상 분기를 합성으로 고정할 것.

- **[INFO]** 라운드 3 fix가 새로 추가한 `staleEntries` 대조군 자체의 품질 확인 — 문제 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:520-539`
    (`describe("staleEntries — 판별 대조군")`)
  - 상세: 세 케이스(인용 안 됨 → 값 유지, 인용됨 → 제거, 빈 목록 → vacuous 경계 명시)가
    "두 판정이 갈리는 값"을 정확히 고른다. `[경계]` 케이스가 "이 자리는 상한/하한 강제가
    따로 막는다"고 vacuity의 소재를 명시적으로 인정한 것도 이 파일의 기존 규율(다른
    `[vacuity]` 라벨 케이스들)과 일관된다. 위 뮤테이션 재현으로 실제 판별력도 확인했다.
  - 제안: 조치 불요.

## 요약

라운드 3까지 축적된 강한 테스트 관례(진리표 대조군·판별 fixture·vacuity floor·뮤테이션
검증 기록)가 이번 fix 커밋(`5778885ce`)에도 그대로 이어진다. 유일한 변경 대상이었던
`staleEntries` 1줄 헬퍼에 "두 판정이 갈리는 값"을 고정한 합성 대조군 3건이 추가됐고,
필터 방향 반전 뮤테이션을 직접 재현해 4건 RED로 걸리는 것을 확인했다(claim과 일치).
남은 갭은 `where` 검증의 0건/2건 이상 분기 — 이는 새로 발견한 것이 아니라 라운드 3에서
이미 INFO로 지적되고 명시적으로 유예된 항목이 그대로 남아 있는 것이다. 새로 보고할
CRITICAL/WARNING은 없다.

## 위험도
NONE
