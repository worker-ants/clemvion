# 부작용(Side Effect) 코드 리뷰 — error-code-emission-axis (라운드 8, `22_38_36`)

## 검토 범위·방법

이 배치는 9개 커밋(`65256a109` feat → `a397ccc55`→`a4b98eda8`→`5778885ce`→`57288e47f`→
`2931d921f`→`eb53aba1c`→`53d29a6f4`→`061f5153f` fix 라운드 1~8)의 누적분이다. 실질 코드는
여전히 두 파일뿐이다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`와
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`. 나머지
(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서·plan·리뷰
산출물이라 코드 실행 경로가 없다.

이전 7라운드(`review/code/2026/09/13/{19_23_22,19_51_33,20_13_13,20_34_32,20_57_13,
21_19_46,21_41_23}/side_effect.md` — 21_41_23 이후는 22_06_10 라운드7)가 이미 이 두 파일을
반복 검토해 매 라운드 위험도 NONE으로 판정했다. 이번 라운드는 **라운드 8 fix(`061f5153f`)가
새로 들여온 증분만** 독립적으로 재검증했다 — `git show 061f5153f -- <두 파일>`로 diff를 직접
추출해 대조했다. 증분은 다음과 같다:

1. `guide-identifier-scan.ts`: **주석 전용 변경** — 예고문(`"방출 위치를 AST 로 특정하는 축이
   트래커에 등재돼 있다"`)을 취소선 처리하고 정정 문단 추가, SoT 헤더 범위 표기를 라운드 7
   교체 전 문구로 되돌림. 실행 코드(함수·정규식·export) 변경 없음 — `git show`에서 `//` 로
   시작하는 라인만 바뀌었음을 확인했다.
2. `guide-identifier-existence.test.ts`: 로컬(비-export) 헬퍼 3종 추가/변경
   - `SOURCE_ROOTS`(모듈 스코프 `const` 배열)·`skipBuildDirs`(모듈 스코프 `const` 함수) 신규
     — 기존에 두 곳(`sourceTexts`, `resolveSourceLines`)에 중복돼 있던 리터럴을 추출한 것.
   - `parseWhereRefs` 반환 타입을 `{file,line}[]` → `{refs, residue}` 로 변경(시그니처 변경).
   - `resolveSourceLines`의 탐색 루트를 `["codebase/backend/src"]` → `SOURCE_ROOTS`
     (`backend/src ∪ packages`)로 확장.
   - 신규 테스트 케이스 다수(대조군·판별 fixture).

## 발견사항

- **[INFO]** `parseWhereRefs` 시그니처 변경(breaking-looking) — 호출자 영향 없음, 확인 완료
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:83`
    (선언), 호출부 `:309`·`:344`·`:348`·`:355`·`:362`·`:368`·`:374`·`:381`
  - 상세: 반환 타입이 배열에서 `{refs, residue}` 객체로 바뀌어 형태상 "시그니처 변경"에
    해당하지만, `grep -rn "parseWhereRefs" codebase/ --include="*.ts"`로 저장소 전체를
    확인한 결과 정의·호출부 전부가 **이 파일 안에서만** 등장하고(`export` 키워드 없음),
    파일 안의 7개 호출부가 이 커밋에서 함께 반환 형태에 맞춰 갱신됐다. 외부 소비자가
    존재하지 않는 로컬 테스트 헬퍼라 실질적인 호출자 영향은 없다.
  - 제안: 조치 불요.
- **[INFO]** `resolveSourceLines` 탐색 범위 확장(`backend/src` → `backend/src ∪ packages`)은
  읽기 전용 파일시스템 스캔의 범위 확장이며 쓰기·삭제 부작용 아님
  - 위치: `guide-identifier-existence.test.ts:125-128` (`resolveSourceLines` 본문), 신규
    테스트 `:659-683`(`[루트 통일] packages 에만 있는 파일도 특정된다`)
  - 상세: `fs.readFileSync`만 수반하는 읽기 전용 `walkTree` 호출의 대상 디렉터리가 넓어진
    것으로, 파일 생성·수정·삭제 등 부작용에는 해당하지 않는다. 확장으로 인해 동명
    `basename`이 늘어날 가능성(커밋 메시지가 실측한 `index.ts` 46→55건)은 이미 같은 파일의
    `resolveSourceLines`의 `found.length === 1` 유일성 가드가 흡수하며, 이번 라운드가 그
    가드를 회귀시키지 않았음을 커밋에 기록된 뮤테이션표(`found.length === 1 → >= 1` ⇒
    RED)로 확인했다.
  - 제안: 조치 불요.
- **[INFO]** 모듈 스코프 `sourceLinesCache`(`Map`, 라운드 6 도입)는 이번 라운드에서 무변경 —
  회귀 없음 확인
  - 위치: `guide-identifier-existence.test.ts:120` (`const sourceLinesCache = new Map...`)
  - 상세: 유일한 모듈 레벨 가변 상태(공유 캐시)이며, `git show 061f5153f`에서 이 라인과
    `resolveSourceLines`의 캐시 히트/미스 로직 자체는 변경되지 않았다(변경된 것은 캐시가
    소비하는 `walkTree` 호출의 `roots`/`skipDir` 인자뿐). 이 파일 밖에서 import 되지 않는
    비-export 상수라 다른 테스트 파일·다른 모듈로 전역 상태가 새어 나가지 않는다.
  - 제안: 조치 불요.
- 그 외 이번 라운드 diff에서 신규 `process.env` 읽기/쓰기, 네트워크 호출, 파일 쓰기·삭제,
  이벤트/콜백 등록·발행, 공개 API(export) 변경은 발견되지 않았다 — `grep -n "fs\.\|process\.
  env\|writeFileSync\|unlinkSync\|mkdirSync\|rmSync"` 로 두 파일을 전수 확인한 결과 신규
  쓰기 계열 호출이 0건이다.

## 참고 (다른 관점이 이미 등재 — 부작용 관점 재조치 불요)

- `guide-identifier-scan.ts`의 예고문 취소선 정정(코드 주석이 완료된 작업을 미착수로
  잘못 서술)은 documentation/maintainability 관점의 사안(라운드 7 리뷰가 CRITICAL로 지적,
  이번 커밋이 고침)이며, 부작용 축에서는 "실행 코드 변경 없음"만 확인 대상이다 — 위에서
  확인했다.
- SoT 헤더 표기를 라운드 7 교체 이전으로 되돌린 것(convention_compliance/documentation·
  scope 관점의 사안)도 순수 주석 되돌리기라 실행 경로에 영향 없다.

## 요약

라운드 8 fix가 새로 들여온 것은 (1) `guide-identifier-scan.ts`의 주석 전용 정정과
(2) `guide-identifier-existence.test.ts`의 로컬 비-export 헬퍼(`SOURCE_ROOTS`·
`skipBuildDirs`·`parseWhereRefs` 반환 형태 변경·`resolveSourceLines` 탐색 루트 확장) 및
그에 따른 신규 대조군 테스트다. `parseWhereRefs`의 반환 타입 변경은 시그니처 변경이지만
전부 파일 내부 전용(export 없음)이라 외부 호출자 영향이 없고, 파일 안의 모든 호출부가
같은 커밋에서 동기화됐다. 탐색 루트 확장은 읽기 전용 스캔 범위의 확장일 뿐 쓰기 부작용이
아니며, 유일성 가드가 그 결과 늘어난 동명 파일 충돌 가능성을 계속 흡수한다. 라운드 1~7이
이미 NONE으로 판정한 나머지 코드(수집기 3종·`collectMatches`·`isMessagePrefixOnly`·
`matchAll`의 `lastIndex` 회피·모듈 스코프 캐시)는 이번 라운드에서 로직 변경이 없어 판정을
유지한다. 저장소 파일에 대한 뮤테이션 없이(읽기 전용 검증만 수행) 리뷰를 완료했다 —
`git status --short` 결과 이 리뷰 세션 자신의 출력 디렉터리 외 잔여 변경 없음. 점검 관점
8가지(의도치 않은 상태 변경/전역 변수/파일시스템 부작용/시그니처 변경/인터페이스 변경/
환경 변수/네트워크 호출/이벤트·콜백) 중 어느 것도 CRITICAL/WARNING급 결함으로 이어지지
않았다.

## 위험도

NONE
