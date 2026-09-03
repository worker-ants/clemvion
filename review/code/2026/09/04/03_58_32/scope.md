# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff origin/main..HEAD` 전체(83개 파일, 9개 커밋)를 대조했다. 실질 코드 변경분
(`codebase/`, `plan/`)과 리뷰 세션 산출물(`review/code/2026/09/04/{01_48_39..03_37_37}/**`,
이번 라운드 이전에 이미 커밋됨)을 분리해서 각각 살폈다. 특히 직전 라운드(`03_37_37`) 이후
새로 추가된 커밋(`d44a8b637`, 리뷰 6R 조치)을 `git show`로 단독 검토해 이번 라운드에서
새로 유입된 변경이 있는지 확인했다.

## 발견사항

- **[INFO]** `collectTsFiles` 통합이 `masked-reject-callers-guard.ts`의 `listSourceFiles`에는
  `.d.ts` 배제·정렬을 부수적으로 새로 얹는다 (재확인, 위반 아님)
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (`export function listSourceFiles`, 원본 walker 삭제분 대비 `return collectTsFiles(rootDir, { includeSpec: true });`로 교체된 지점)
  - 상세: 원래 이 walker는 `.ts`로 끝나기만 하면 담았다(`.d.ts` 배제·`sort()` 없음). `collectTsFiles`로 교체되며 두 필터가 덤으로 붙는다. 이전 라운드(`review/code/2026/09/04/01_49_18/scope.md`)에서 이미 같은 지점을 지적했고, 하위 호출부가 결과를 다시 정렬하고(`.d.ts` 0개 실측) 저자가 `source-scan.ts`의 "다섯 사본의 차이" 표에서 이 축을 명시적으로 근거 남긴 것도 확인했다. 새로 추가된 지점 아님 — 재확인 목적으로만 기록.
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 세션 산출물(`review/code/2026/09/04/01_48_39/` ~ `03_37_37/`, 7개 라운드분)이 코드 변경과 같은 브랜치에 누적 커밋됨
  - 위치: `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38,02_35_22,02_57_22,03_17_44,03_37_37}/**`
  - 상세: `review/`는 이 저장소에서 gitignore 대상이 아니고, "구현 완료 후 리뷰 → fix → 재리뷰" 루프의 각 라운드 산출물을 커밋하는 것이 확립된 관례다(developer SKILL §REVIEW WORKFLOW). 7라운드가 누적되며 diff 크기가 커졌지만(83개 파일 중 74개가 review 산출물), 이는 반복 fix-review 루프의 정상적 부산물이지 의도 밖 수정이 아니다. 실질 코드 변경(9개 파일)은 전부 plan 문서의 두 후속 항목(walker 통합·낡은 spec 캐스트 가드)에 직접 결속돼 있다.
  - 제안: 조치 불필요. 병합 전 `plan/in-progress/entity-nullable-column-type-mismatch.md`의 두 체크박스가 `[x]`로 반영돼 있음을 확인(실제로 반영됨, `git diff` 확인).

## 라운드 6R(직전 라운드 이후 신규 커밋 `d44a8b637`) 개별 확인

`d44a8b637`(리뷰 6R 조치)의 실질 diff는 다음 두 곳뿐이다:

1. `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` — 직전 라운드가 지적한 "옵션 배선 미검증"(`includeSpec: true` 삭제 뮤테이션에도 15/15 GREEN)에 대한 배선 검증 테스트 2건 추가. 리뷰 지적에 대한 직접 대응이며 범위 이탈 없음.
2. `plan/in-progress/entity-nullable-column-type-mismatch.md` — "한 자리만 고치는 버릇" 표의 헤딩("네 번"→"여섯 번")·깨진 표 구조(삽입된 빈 줄)·누락된 6번째 행을 정정. 이 역시 직전 라운드가 지적한 항목의 직접 수정이다.

두 변경 모두 커밋 메시지가 명시한 리뷰 지적(W1·W2·W3)에 정확히 대응하며, 그 외 파일·로직에는 손대지 않았다. 무관한 리팩토링·포맷팅·주석·임포트·설정 변경 없음.

## 요약

이 브랜치는 `plan/in-progress/entity-nullable-column-type-mismatch.md`에 명시된 두 후속 항목 — ① `repo-guards/__tests__/` 5개 가드에 중복된 디렉터리 walker를 `common/__test-utils__/source-scan.ts`의 `collectTsFiles`로 추출·통합, ② `.spec.ts`에 남은 "넓혀진(nullable화된) 엔티티 필드를 겨눈 낡은 `null as unknown as` 캐스트"를 잡는 신규 가드(`widenedEntityFields`/`findStaleSpecCasts`) 추가 — 를 그대로 수행하며, 이후 6라운드의 리뷰-수정 루프를 거쳤다. 실질 코드 변경은 core 유틸(`source-scan.ts`/`.spec.ts`), 그 유틸을 소비하는 4개 가드, 신규 가드가 붙은 파일, plan 문서로 국한되고 전부 두 항목에 직접 결속된다. import 정리(불필요해진 `fs` 제거·필요해진 `collectTsFiles` 추가)도 실제 사용 여부와 일치한다. 이번 라운드에서 새로 유입된 커밋(`d44a8b637`)도 직전 라운드 리뷰 지적에 대한 좁은 대응(테스트 2건 + plan 문서 정정)으로, 별도 스코프 이탈이 없다. 이전 라운드들이 반복적으로 지적·확인한 유일한 경계 지점(`masked-reject-callers-guard`의 `.d.ts`/정렬 부수 적용)은 저자가 실측 근거를 남긴 의도적 결정으로 재확인됐다. 무관한 파일·포맷팅·주석·설정 변경은 발견되지 않았다.

## 위험도

NONE
