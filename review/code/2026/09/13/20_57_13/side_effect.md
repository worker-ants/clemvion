# 부작용(Side Effect) 코드 리뷰 — error-code-emission-axis (라운드 5, `20_57_13`)

## 검토 범위 · 방법

이 배치는 5개 커밋(`65256a109` feat → `a397ccc55`→`a4b98eda8`→`5778885ce`→`57288e47f` fix 라운드 1~4)의 누적분이다. 실질 코드는 여전히 두 파일뿐이다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기 3종·`collectMatches`·`isMessagePrefixOnly`·`GUIDE_NON_EMITTED_VOCABULARY`)와 `guide-identifier-existence.test.ts`(그 축의 단언·대조군). 나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서/프로세스 산출물이라 코드 실행 경로가 없다.

이전 4라운드(`review/code/2026/09/13/{19_23_22,19_51_33,20_13_13,20_34_32}/side_effect.md`)가 이미 위험도 NONE으로 판정했고, 그 판정이 겨눈 코드(수집기 3종·순수 함수 여부·`matchAll`의 `lastIndex` 회피·`isMessagePrefixOnly` export 승격·`parseWhereRefs`/`staleEntries` 헬퍼)는 이번 라운드 사이에 로직이 바뀌지 않았다. 이번 라운드는 **라운드 4 fix(`57288e47f`)가 새로 들여온 것만** 독립적으로 재검증했다 — `git diff 5778885ce..57288e47f -- <두 파일>`로 증분을 직접 추출해 대조했다. 증분은 두 가지뿐이다:

1. 테스트 파일 지역 함수 `staleEntries` → `staleGuideEntries` **개명** (export 아님, 시그니처·로직 불변)
2. 두 라운드에 걸쳐 표류한 JSDoc 블록(*"발행 축 수집기 3종의 합성 경계 대조군"*)을 `describe("staleEntries/staleGuideEntries — 판별 대조군", …)` 위에서 원래 대상인 `describe("발행 축 수집기 — 경계 대조군", …)` 바로 위로 **이동** (코드 자체는 변경 없음)

`guide-identifier-scan.ts`는 라운드 3 이후 변경이 없다(`git diff 5778885ce..57288e47f`에 등장하지 않음).

## 발견사항

- **확인 후 문제 없음(참고)**: 개명이 새 이름 충돌을 만들지 않았다 — `grep -rn "staleGuideEntries\b" codebase` 결과 정의 1곳(`guide-identifier-existence.test.ts:73`, 비-export)과 호출부 5곳뿐이다. 개명 사유로 지목된 실제 충돌 대상(`codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:129`의 `export function staleEntries(internal: string[], knownNames: string[]): string[]`)을 직접 열어 확인했다 — 그 함수는 여전히 `staleEntries`라는 이름을 그대로 쓰고 있고, 시그니처가 다르며(문자열 배열 2개 vs 여기의 `{token}[]`+`Set`), 이 diff가 그 파일을 건드리지 않았다. 즉 개명은 **일방향으로 이 테스트 파일의 로컬 식별자만** 옮겼고, 그 함수의 8곳 기존 소비자(`internal-package-registration.test.ts`)에는 영향이 없다.
- **확인 후 문제 없음(참고)**: 개명된 함수는 이 파일 안에서만 쓰이는 비-export 로컬 함수라 시그니처·인터페이스 변경의 "호출자 영향" 범주에 애초에 해당하지 않는다 — 호출부 5곳(정의부 제외) 전부 같은 파일 안에서 함께 바뀌었다(`grep -n "staleGuideEntries" guide-identifier-existence.test.ts`로 재확인, 잔여 `staleEntries` 참조 0건).
- **확인 후 문제 없음(참고)**: JSDoc 블록 이동은 텍스트(주석)만 옮긴 것이고 그 사이의 실행 코드(`describe`/`it` 블록들)는 라운드 3과 바이트 단위로 동일하다 — 부작용 관점에서 논할 실행 경로 변경이 없다.
- 그 외 이번 라운드에서 diff에 새로 나타난 파일시스템 읽기·쓰기, `process.env` 접근, 네트워크 호출, 이벤트/콜백 변경, 전역 상태 변경은 없다 — 라운드 1~4가 이미 검증한 순수 함수·읽기 전용 `fs.readFileSync`·모듈 전역 정규식 상수의 `matchAll` 기반 무상태 사용 구조가 그대로 유지된다.

## 참고 (다른 관점이 이미 등재 — 부작용 관점 재조치 불요)

- 개명 자체(이름 충돌 회피)는 이 라운드 `--impl-done`(`review/consistency/2026/09/13/20_34_48` naming_collision WARNING#5)이 지적하고 이번 커밋이 고친 사안이며, 부작용 관점에서는 "재도입된 충돌 없음"만 확인하면 된다 — 위에서 확인했다.
- JSDoc 표류는 documentation/maintainability 관점의 사안(orphan 주석)이라 이 축에서는 "옮긴 결과가 실행 코드에 영향 없음"만 확인 대상이다.

## 요약

라운드 4 fix가 새로 들여온 것(로컬 함수 개명, JSDoc 재배치)은 둘 다 실행 코드 변경이 없는 순수 리팩터다. 개명된 `staleGuideEntries`는 비-export 로컬 함수라 시그니처·인터페이스 변경의 호출자 영향이 원천적으로 없고, 실제 충돌 대상이었던 `internal-package-registration-guard.ts`의 동명 export 함수는 이번 diff의 영향을 받지 않은 채 그대로 유지된다. 라운드 1~3이 이미 NONE으로 판정한 나머지 코드(수집기 3종·`collectMatches`·`isMessagePrefixOnly`·`parseWhereRefs`·`matchAll`의 `lastIndex` 회피)는 이번 라운드에서 로직 변경이 없어 판정을 유지한다. 점검 관점 8가지(의도치 않은 상태 변경/전역 변수/파일시스템 부작용/시그니처 변경/인터페이스 변경/환경 변수/네트워크 호출/이벤트·콜백) 중 어느 것도 CRITICAL/WARNING급 결함으로 이어지지 않았다.

## 위험도
NONE
