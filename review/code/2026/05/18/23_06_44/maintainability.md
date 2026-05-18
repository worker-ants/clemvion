# 유지보수성(Maintainability) 리뷰

## 발견사항

### backend-labels.test.ts

- **[WARNING]** `repoRoot` 경로 계산에 `".."` 인자 6개를 나열하는 방식 사용
  - 위치: `backend-labels.test.ts` L529–536 / `nodes-coverage.test.ts` L266–274
  - 상세: `path.resolve(__dirname, "..", "..", "..", "..", "..", "..")` 형태로 6단계 상위 디렉토리를 구하고 있다. 두 파일 모두 동일한 `repoRoot` 계산 로직을 중복 작성했으며, hop 수가 틀릴 경우 묵시적으로 잘못된 경로를 반환한다. 현재는 주석(`// 6 hops back lands at the repo root`)으로 의도를 설명하지만, 구조 변경 시 유지보수 실수를 유발하기 쉽다.
  - 제안: `__dirname`에서 패키지 루트까지 올라가는 공통 헬퍼(`findRepoRoot(startDir)`)를 `__tests__` 혹은 상위 레벨에 한 번만 정의하고 두 파일에서 import하거나, `package.json`을 탐색해 repo root를 결정하는 방식으로 변경한다.

- **[WARNING]** `backend-labels.test.ts`와 `nodes-coverage.test.ts`에 `hasBackend` 존재 확인 패턴이 중복
  - 위치: `backend-labels.test.ts` L546 / `nodes-coverage.test.ts` L285
  - 상세: 두 파일이 독립적으로 `fs.existsSync(backendNodesRoot)`를 호출하고 `hasBackend` 변수를 선언한다. `backendNodesRoot` 경로 구성 코드도 동일하다. 파일이 늘어날수록 중복이 증가한다.
  - 제안: 공통 test helper 모듈(`__tests__/helpers/backend-paths.ts` 등)에서 `backendNodesRoot`, `hasBackend`를 한 번만 계산해 export한다.

- **[WARNING]** `collectTopLevelStringFields` 함수가 수동 파서 구현으로 복잡도가 높음
  - 위치: `backend-labels.test.ts` L618–662
  - 상세: 직접 문자 단위 순회로 중괄호 깊이 추적, 문자열 스킵, 주석 제거, 필드 추출을 한 함수(약 45줄)에서 모두 처리한다. `skipString`, `unescape`, `collectTopLevelStringFields`, `extractNodeMetadataTopFields`, `extractWarningMessages` 함수들이 서로 다른 수준의 파싱 책임을 갖지만 경계가 모호하다. 유사한 depth-tracking 루프가 `extractWarningMessages`(L566–583)와 `extractNodeMetadataTopFields`(L598–616) 두 곳에 각각 존재한다.
  - 제안: depth-tracking 블록 추출 로직을 `extractBlock(source, openBracket, closeBracket, startIndex): string` 형태의 단일 유틸로 추출하고 두 함수에서 재사용한다.

- **[INFO]** `unescape` 함수명이 전역 deprecated `unescape()`와 충돌 가능
  - 위치: `backend-labels.test.ts` L674, `nodes-coverage.test.ts`에는 없음
  - 상세: 함수 이름 `unescape`는 브라우저/Node.js 전역의 deprecated `unescape` 함수와 동명이다. TypeScript 환경에서는 로컬 선언이 우선되어 실제 동작에는 문제가 없으나, 코드 리딩 시 혼란을 줄 수 있다.
  - 제안: `unescapeString` 또는 `resolveEscapes`처럼 명확한 이름을 사용한다.

- **[INFO]** `writeBaseline` 함수 내 이중 `writeFileSync` 호출
  - 위치: `hardcoded-korean-ratchet.test.ts` L1411–1417
  - 상세: JSON 파일을 한 번 쓰고(`// total: ${total}\n` 주석 포함), 즉시 다시 덮어쓴다(주석 제거 목적). 의도는 주석이 달린 상태로 JSON.stringify를 호출하기 전에 total을 계산하는 것이지만, 실제로 첫 번째 `writeFileSync`의 내용은 곧바로 두 번째로 덮어써진다. 코드만 보면 첫 번째 쓰기가 왜 있는지 불명확하고, 불필요한 I/O가 발생한다.
  - 제안: 첫 번째 `writeFileSync` 호출을 제거하고 두 번째만 남기거나, total을 별도 로그에 출력하는 의도라면 `console.log`로 대체한다.

### hardcoded-korean-ratchet.test.ts

- **[WARNING]** `describe` 블록 최상위에서 사이드이펙트(파일 I/O) 수행
  - 위치: `hardcoded-korean-ratchet.test.ts` L1189–1202
  - 상세: `describe(...)` 콜백 최상위에서 `buildCurrentCounts()`(파일 시스템 전체 스캔)를 호출하고, `BASELINE_UPDATE=1`이면 즉시 `writeBaseline()`(파일 쓰기)을 호출한 뒤 `return`으로 나머지 테스트 등록을 생략한다. vitest의 `describe` 콜백은 동기 수집 단계에서 실행되므로 이 패턴 자체는 동작하지만, `return`으로 조기 탈출하는 방식이 비직관적이고 다른 테스트 프레임워크나 병렬 실행 설정에서 예상치 못한 동작을 유발할 수 있다.
  - 제안: `BASELINE_UPDATE` 분기를 별도 `describe.skipIf` / `describe.runIf` 블록으로 분리하거나, baseline 갱신 전용 스크립트로 분리한다.

- **[INFO]** 매직 넘버 `10`이 두 파일에 분산
  - 위치: `backend-labels.test.ts` L731 (`>= 10`) / `nodes-coverage.test.ts` L354 (`>= 10`)
  - 상세: sanity 최솟값 10이 두 파일에 하드코딩되어 있다. 프로젝트의 실제 노드 수가 변경될 때 두 곳을 동시에 갱신해야 한다.
  - 제안: 공통 상수 파일 또는 인라인 named constant(`const MIN_EXPECTED_NODES = 10`)로 의미를 명시하고 관련 파일에서 import한다.

### nodes-coverage.test.ts

- **[INFO]** 반환 타입 인라인 중복 선언
  - 위치: `nodes-coverage.test.ts` L293–297 (함수 시그니처)와 L298 (지역 변수 `out` 타입)
  - 상세: `collectNodeSchemaFiles`의 반환 타입을 함수 시그니처와 `out` 변수 선언 양쪽에 모두 명시했다. TypeScript가 반환 타입에서 `out`의 타입을 추론할 수 있어 하나는 중복이다.
  - 제안: `out` 변수 선언에서 타입 어노테이션을 제거하고 반환 타입 시그니처만 유지한다.

### backend-labels.ts

- **[INFO]** `NODE_CATEGORY_KO`에 대소문자 중복 키 관리
  - 위치: `backend-labels.ts` L1923–1938
  - 상세: 동일한 카테고리를 `"AI"`/`"ai"`, `"Data"`/`"data"` 등 대소문자 두 가지 형태로 각각 등록한다. 이 패턴은 카테고리 추가 시 항상 두 줄씩 추가해야 한다는 묵시적 규약이지만 코드에 명시적 설명이 없다.
  - 제안: 주석에 "대소문자 양쪽 키를 등록해야 하는 이유"(display label vs. id)를 명확히 기술하거나, lookup 함수에서 `.toLowerCase()`로 정규화한 뒤 소문자 키만 유지하는 방식을 검토한다.

### PROJECT.md

- **[INFO]** 테스트 파일 목록이 두 위치에 분산 기술
  - 위치: `PROJECT.md` diff L44–48 (새 테스트 파일 목록) vs 기존 `## 자동 가드` 섹션
  - 상세: 신규 테스트 3개가 bullet 목록에 추가되었으나 문서 내 다른 위치에도 동일 목록이 있어, 추후 변경 시 두 위치를 함께 갱신해야 한다. 현재 PR에서는 두 위치 모두 일치되어 있어 즉각적인 문제는 없다.
  - 제안: 단일 위치만 유지하고 나머지는 참조(링크)로 대체하거나, 중복임을 명시적으로 표시한다.

---

## 요약

전반적으로 새로 추가된 테스트 파일들은 목적이 명확하고 JSDoc 주석이 충실하게 작성되어 있으며, 기존 코드베이스의 `describe.runIf` / `loadDocsIndex` 패턴을 잘 따르고 있다. 주요 유지보수성 우려는 두 테스트 파일이 동일한 `repoRoot` 계산 코드와 `hasBackend` 확인 로직을 각각 독립적으로 중복 작성하는 점이다. 노드 수가 늘거나 디렉토리 구조가 바뀔 때 두 파일을 동시에 수정해야 하는 부담이 생긴다. `backend-labels.test.ts`의 수동 파서 함수들은 책임 분리가 불완전하여 depth-tracking 루프가 두 곳에 중복되어 있다. `writeBaseline`의 이중 파일 쓰기는 불필요한 I/O로 제거 대상이다. `backend-labels.ts` 자체는 `export` 추가 외 변경이 최소화되어 기존 패턴을 잘 유지했으며, 번역 테이블 구조도 일관성 있게 관리되고 있다.

## 위험도

LOW
