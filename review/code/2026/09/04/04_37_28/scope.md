# 변경 범위(Scope) 리뷰

## 검증 방법

`git log --oneline -20`, `git status --short`, `git diff origin/main...HEAD --stat -- codebase/ plan/`
로 브랜치 상태를 확인했다. HEAD(`4d7888625`)는 직전 라운드(`04_18_01`, 8R) 리뷰가 지적한
WARNING 1건("자매 함수 중 하나만 하드닝")에 대한 fix 커밋이며, **이번 라운드가 리뷰하는
실질 코드/문서 diff(9개 코드 파일 + plan 문서, 818 insertions / 92 deletions)는 8R 스코프
리뷰가 이미 NONE 으로 판정한 것과 동일한 범위**다 — 8R 이후 새로 추가된 커밋은
`4d7888625` 하나뿐이라, 그 커밋만 개별로 `git show` 로 재확인했다.

## 이번 라운드에서 새로 추가된 유일한 커밋(`4d7888625`) 개별 확인

- 손댄 실질 파일은 `nullable-type-lie-cast-guard.ts`(+7/-1)와 그 spec(+26)뿐이다.
- 내용은 직전 라운드가 지적한 정확히 그 지점 — `findUntypedNullableColumns` 내부의
  옛 `tsType.includes('| null')` 판정을 이미 존재하던 `isNullableType()` 헬퍼 호출로
  교체 — 에 국한된다. 새 함수·새 파일·새 의존성 없음. `isNullableType` 자체의 정의는
  이동하지 않았고(호이스팅으로 이동 불필요, 커밋 메시지가 이를 명시), 그 위 JSDoc 에
  "소비처가 둘"이라는 한 문단만 추가됐다 — 이번 fix 의 근거를 남기는 문서화로 범위
  안이다.
- spec 추가분은 `widenedEntityFields`(자매 함수)의 기존 `it.each` 캐너리와 대칭되는
  3-케이스 `it.each`(공백 없음/순서 반대/표준 표기)뿐이며, 다른 describe 블록이나
  무관한 테스트를 건드리지 않았다.
- 함께 커밋된 `review/code/2026/09/04/04_18_01/**` 13개 파일은 직전 라운드의 리뷰
  산출물이며, 이 저장소 관례(developer SKILL §REVIEW WORKFLOW)상 라운드마다 커밋되는
  정상 부산물이다.

## 발견사항

- **[INFO]** (누적 재확인, 위반 아님) `collectTsFiles` 통합이 `masked-reject-callers-guard.ts`
  의 `listSourceFiles` 에는 `.d.ts` 배제·정렬을 부수적으로 새로 얹는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` —
    `export function listSourceFiles`, `return collectTsFiles(rootDir, { includeSpec: true });`
  - 상세: 1R(`01_49_18/scope.md`)부터 8R(`04_18_01/scope.md`)까지 매 라운드 반복 재확인된
    지점이다. 원래 walker 는 `.ts` 로 끝나기만 하면 담았고(`.d.ts` 배제·정렬 없음),
    `collectTsFiles` 로 교체되며 두 필터가 덤으로 붙는다. 하위 호출부가 결과를 다시
    정렬하고, `.d.ts` 가 `src` 하위에 0개임을 실측했으며, 저자가 `source-scan.ts` 의
    "다섯 사본의 차이" 표에서 이 축을 명시적으로 근거 남겼다. 이번 라운드에 새로 유입된
    변경이 아니다 — 코드 자체가 8R 이후 이 지점에서 바뀌지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 세션 산출물이 코드 변경과 같은 브랜치에 9라운드분 누적 커밋됨
  - 위치: `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38,02_35_22,02_57_22,03_17_44,03_37_37,03_58_32,04_18_01}/**`
  - 상세: `review/` 는 gitignore 대상이 아니고 "구현 완료 후 리뷰 → fix → 재리뷰" 루프의
    각 라운드 산출물을 커밋하는 것이 확립된 관례다(developer SKILL §REVIEW WORKFLOW).
    라운드가 누적되며 `origin/main` 대비 diff 파일 수는 커지지만(실질 변경은 여전히
    코드 9개 + plan 1개 파일, 818/92줄), 이는 반복 fix-review 루프의 정상 부산물이지
    의도 밖 수정이 아니다.
  - 제안: 조치 불필요.

## 요약

이 브랜치는 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 명시된 두 후속
항목(① `repo-guards/__tests__/` 5개 가드의 중복 walker 를 `collectTsFiles` 로 추출·통합,
② `.spec.ts` 에 남은 낡은 `null as unknown as` 캐스트를 잡는 `widenedEntityFields`/
`findStaleSpecCasts` 신설)을 그대로 수행하며 9라운드째 리뷰-수정 루프를 거치고 있다. 이번
라운드가 실제로 다루는 신규 변경은 8R 리뷰가 지적한 "자매 함수 중 하나만 하드닝했다"
WARNING 에 대한 좁은 fix 커밋(`4d7888625`) 하나뿐이며, 지적된 정확히 그 지점(판정 로직
한 줄 교체 + 대칭 캐너리 3건 + 근거 문서화 한 문단)에 국한돼 있다. 요청 범위 밖의 기능
확장·무관한 리팩토링·의미 없는 포맷팅·불필요한 주석/설정/임포트 변경은 이번 라운드에서도
발견되지 않았다. 반복 기록되는 유일한 경계 지점(`masked-reject-callers-guard` 의
`.d.ts`/정렬 부수 적용)은 코드가 변하지 않았으므로 이번 라운드에도 동일하게 위반 아님으로
재확인한다. 리뷰 산출물이 코드와 같은 브랜치에 누적 커밋되는 것은 이 저장소의 확립된
관례이지 스코프 이탈이 아니다.

## 위험도

NONE
