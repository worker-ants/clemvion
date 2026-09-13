# 부작용(Side Effect) 코드 리뷰 — error-code-emission-axis (라운드 3, `20_13_13`)

## 검토 범위 · 방법

이 배치는 3개 커밋(`65256a109` feat → `a397ccc55` fix 라운드1 → `a4b98eda8` fix 라운드2)의 누적분이다. 실질 코드는 여전히 두 파일뿐이다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기·`isMessagePrefixOnly`·`GUIDE_NON_EMITTED_VOCABULARY`)와 `guide-identifier-existence.test.ts`(그 축의 단언·대조군). 나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서/프로세스 산출물이라 코드 실행 경로가 없다.

이전 두 라운드(`review/code/2026/09/13/19_23_22/side_effect.md`, `review/code/2026/09/13/19_51_33/side_effect.md`)가 이미 위험도 NONE으로 판정했고, 그 판정이 겨눈 코드(수집기 3종·`collectMatches`·순수 함수 여부·`matchAll`의 `lastIndex` 회피)는 이번 라운드 사이에 로직이 바뀌지 않았다. 이번 라운드는 **라운드 2 fix(`a4b98eda8`)가 새로 들여온 것만** 독립적으로 재검증했다 — `git diff a397ccc55..a4b98eda8 -- <두 파일>`로 증분을 직접 추출해 대조했다:

1. `isMessagePrefixOnly`가 테스트 파일의 지역 클로저에서 `guide-identifier-scan.ts`의 **신규 export**로 승격됨(인자 1개 → 3개, `messagePrefixes`/`quotedLiterals`를 분리 인자로 받음).
2. 신규 로컬 함수 `parseWhereRefs`(`where` 문자열에서 `파일:줄` 전부를 파싱) · `staleEntries`(두 목록의 "여전히 인용되는가" 판정 공유).
3. `describe("isMessagePrefixOnly — 진리표 대조군", …)` 4개 테스트 신규 추가.

## 발견사항

- **확인 후 문제 없음(참고)**: `isMessagePrefixOnly`가 `guide-identifier-scan.ts`의 신규 export가 됐지만 **기존 export 어느 것의 시그니처도 변경하지 않았다** — 순수 추가다. `grep -rn "guide-identifier-scan" codebase/frontend/src`로 재확인한 결과 이 모듈을 import하는 곳은 `guide-identifier-existence.test.ts` 하나뿐이라(직전 두 라운드와 동일 결론), 새 export가 기존 호출자에 미치는 영향은 없다.
- **확인 후 문제 없음(참고)**: `parseWhereRefs`의 정규식(`/([\w./-]+\.ts):(\d+(?:·\d+)*)/g`)은 함수 호출부에 **인라인 리터럴**로 쓰인다(모듈 전역 상수가 아니다) — 매 호출마다 새 `RegExp` 객체가 평가되므로 `guide-identifier-scan.ts`가 회피하려 애쓴 것과 같은 종류의 공유 `lastIndex` 오염 문제 자체가 성립하지 않는다. `isMessagePrefixOnly`·`staleEntries`도 인자만 읽어 값을 반환하는 순수 함수이고, 전역 상태·모듈 스코프 가변 변수를 새로 만들지 않는다.
- **확인 후 문제 없음(참고)**: `where` 검증 로직이 단일 매치(`.exec()`)에서 `parseWhereRefs`의 다중 매치로 바뀌면서, 항목당 여러 위치가 있으면 `walkTree(root, ["codebase/backend/src"], …)`가 이제 위치 수만큼 반복 호출된다(예: `CONTAINER_MISSING_EMIT`은 2회). `walkTree`는 읽기 전용(`fs.existsSync`/`fs.readdirSync`, 쓰기 없음)이라 상태 변경·부작용은 없다 — 반복 호출로 인한 비용 증가는 성능/유지보수성 관점(이미 같은 세션의 `maintainability.md`가 별도 INFO로 기록)이지 부작용은 아니다.
- **확인 후 문제 없음(참고)**: 나머지 파일(`CHANGELOG.md`, `PROJECT.md`, `logic.mdx`/`logic.en.mdx`, `plan/in-progress/*.md`, `review/code/2026/09/13/{19_23_22,19_51_33}/**`, `review/consistency/2026/09/13/{18_40_54,19_23_31,19_51_39}/**`)는 문서·plan·이전 리뷰 세션 산출물의 신규 생성/추가일 뿐이다. 전부 `new file mode` 신규 파일이거나 기존 문서의 특정 절 추가이며, 코드 실행의 부산물로 생긴 예기치 못한 파일이 아니다 — `review/`·`plan/`에 세션 산출물을 커밋하는 것은 이 저장소의 정착된 관례(CLAUDE.md)와 일치한다.
- **재확인**: 이번 diff 범위 전체에서 `process.env` 신규 읽기/쓰기, 네트워크 호출, 이벤트 발행/구독, 파일 삭제·덮어쓰기는 관측되지 않았다. 백엔드 런타임 코드(`execution-engine.service.ts` 등)는 이번 diff에 포함되지 않았다 — 가이드 문장이 그 코드의 기존 동작(메시지 접두, 구조화 코드 미방출)을 서술만 정정했을 뿐 엔진 동작 자체는 바뀌지 않았다.

## 참고 (다른 관점이 이미 등재 — 부작용 관점 재조치 불요)

- 카탈로그 SoT(`spec/5-system/3-error-handling.md`) 하드 리드가 존재 가드 없이 이뤄지는 것은 라운드 1·2 side_effect 리뷰가 이미 "기존 관행과 일치 — 조치 불요"로 처분했고 이번 라운드에서도 변경되지 않았다.
- `where` 검증이 위치 수만큼 `walkTree`를 반복 호출하는 성능·구조 관점은 이번 세션 `maintainability.md`(INFO)·`performance.md`가 다루는 영역이라 여기서는 중복 기재하지 않는다.

## 요약

라운드 2 fix가 새로 들여온 것(`isMessagePrefixOnly` export 승격, `parseWhereRefs`/`staleEntries` 헬퍼, 진리표 대조군 4종)은 전부 순수 함수·읽기 전용 파일시스템 재사용·인라인 정규식으로 구성돼 있어, 점검 관점 8가지(의도치 않은 상태 변경/전역 변수/파일시스템 부작용/시그니처 변경/인터페이스 변경/환경 변수/네트워크 호출/이벤트·콜백) 중 어느 것도 CRITICAL/WARNING급 결함으로 이어지지 않았다. `isMessagePrefixOnly`가 모듈 export로 승격되며 인자 수가 1→3으로 바뀌었지만 이전에는 테스트 파일 내부 클로저였을 뿐 공개 인터페이스가 아니었고, 새 export의 유일한 소비자도 같은 테스트 파일이라 하위 호환성 리스크가 없다. `where` 다중 위치 파싱이 `walkTree` 호출 횟수를 늘리지만 읽기 전용이라 부작용이 아니다. 라운드 1·2가 이미 NONE으로 판정한 나머지 코드(수집기 3종·`collectMatches`·`matchAll`의 `lastIndex` 회피)는 이번 라운드에서 로직 변경이 없어 판정을 유지한다.

## 위험도
NONE
