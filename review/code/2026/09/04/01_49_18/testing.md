# 테스트(Testing) 리뷰 — `walker 통합`(collectTsFiles) + `findStaleSpecCasts` 배치

## 발견사항

- **[WARNING]** `stripLiterals` 가 "다음 가드의 재사용"을 명시적 존재 이유로 export 됐는데, 직접 단위 테스트가 0개다 — 같은 파일의 자매 함수 `stripComments` 는 6개의 전용 테스트(`describe('source-scan', …)`)를 갖고 있는데, 같은 diff 에서 같은 이유로 export 된 `stripLiterals` 는 `findStaleSpecCasts` 를 통한 간접 커버리지만 있다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:63` (export 이유를 밝힌 docstring), `:83`(`export function stripLiterals`) — 대응하는 직접 테스트는 `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` 어디에도 없음(새 `describe('collectTsFiles', …)` 블록만 추가됨).
  - 상세: docstring 이 스스로 이렇게 적는다 — "> **export 인 이유**: 주석 처리 규칙은 세는 가드만의 것이 아니다. 넓혀진 필드를 겨눈 낡은 캐스트를 찾는 가드도 같은 규칙이 필요한데, 거기서 다시 구현하면 이 모듈이 막으려던 비대칭이 그대로 재발한다." 즉 이 함수는 "다음 사람이 직접 import 해 쓸 것"을 전제로 설계됐다. 그런데 지금은 `nullable-type-lie-cast-guard.ts` 의 `findStaleSpecCasts` 한 소비처를 통해서만, 그것도 `SPEC_CAST` 정규식이 실제로 매치하는 특정 필드명 패턴에 대해서만 간접 검증된다. 이스케이프된 따옴표(`\'`), 템플릿 리터럴 안 중첩 백틱(`${...}` 안의 백틱 — docstring 이 스스로 "한계"로 적어 둔 부분), 여러 줄 문자열 등 `stripLiterals` 고유의 경계 조건은 어떤 테스트도 직접 겨누지 않는다. 다음 가드가 이 함수를 그대로 가져다 쓸 때, 그 가드의 판정 대상 패턴이 `SPEC_CAST` 와 우연히 겹치지 않으면 회귀가 조용히 통과한다.
  - 제안: `source-scan.spec.ts` 에 `stripLiterals` 전용 `describe` 블록을 추가한다 — 최소한 (a) 백틱/작은따옴표/큰따옴표 각각 보존(따옴표 자체는 남는다), (b) 이스케이프된 따옴표를 포함한 문자열이 조기 종료되지 않는지, (c) 문자열 안의 코드 모양 텍스트가 실제로 지워지는지(`stripComments` 의 대응 테스트와 대칭), (d) docstring 이 적어 둔 한계(`${...}` 안 중첩 백틱)를 RED 방향으로 고정하는 테스트를 넣는다.

- **[WARNING]** `sort()` 회귀를 이 개발 환경에서는 "원리적으로" 잡을 수 없다는 docstring 의 단언이 실측으로 반증된다 — 픽스처를 조금만 다르게 짜면 이 환경에서도 `sort()` 뮤턴트가 RED 로 잡힌다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:225-241` (docstring — "픽스처를 아무리 키워도 이 환경에서는 가릴 수 없다(연속성 때문에 원리적으로 그렇다)"), 관련 구현은 `codebase/backend/src/common/__test-utils__/source-scan.ts:270`(`return out.sort();`).
  - 상세: docstring 의 근거는 "이 환경에서 `readdirSync` 가 이미 알파벳순을 반환하고, 깊이 우선 순회는 서브트리를 연속으로 내보내므로 순회 순서 == 정렬 순서가 된다"는 것이다. 이는 **파일명에 디렉터리 경계 문자(`/`, ASCII 0x2F)보다 사전식으로 앞서는 문자(예: `-`, ASCII 0x2D)가 포함된 형제 항목이 없을 때만** 성립한다. 실제로 scratch 에서 기존 픽스처에 `nested-sibling.ts` 파일 하나만 형제로 추가해 재현했다:
    ```
    DFS(무-sort) 순서 : ['a.ts', 'nested/b.ts', 'nested/deep/c.ts', 'nested-sibling.ts']
    Array.sort() 순서 : ['a.ts', 'nested-sibling.ts', 'nested/b.ts', 'nested/deep/c.ts']
    두 순서 동일? false
    ```
    (원본 `beforeEach` 픽스처 그대로 재현하면 docstring 의 주장대로 두 순서가 일치함도 함께 확인했다 — 즉 "이 특정 픽스처에서는 못 잡는다"는 참이지만, "이 환경에서 원리적으로 못 잡는다"는 거짓이다.) `-` < `/` 이므로 "nested" 디렉터리와 사전식으로 인접한 이름의 형제 파일이 있으면 DFS 순서와 전체-경로 문자열 정렬 순서가 갈린다 — 이건 이 저장소가 이미 문서화한 교훈("설계 근거는 쓰기 전에 뮤턴트로 반증해 보라", "거짓 근거는 다음 사람의 판단 기준을 바꾼다")과 정확히 같은 패턴이다. 이 주석을 읽는 다음 사람은 "닫을 수 없는 갭"이라 믿고 더 시도하지 않을 것이다.
  - 제안: `beforeEach` 픽스처에 `mk('nested-sibling.ts')` (또는 동등한, `-`/`.` 등 `/` 보다 사전식으로 앞서는 문자를 포함한 형제 파일명) 한 줄만 추가하면 이 개발 환경에서도 `sort()` 뮤턴트가 RED 로 잡힌다. docstring 의 "원리적으로 이 환경에서 못 잡는다"는 문장을 정정하거나, 픽스처를 보강해 실제로 닫는다.

- **[INFO]** 5개 walker(`collectSourceFiles`/`walkTsFiles`/`listSourceFiles`/`listProductionSources`/`collectScanTargets`)를 `collectTsFiles` 로 통합하며 "동작 불변"을 확인한 507/818/1261/818/818 대조가 plan 문서의 일회성 서술로만 남아 있고, 저장소에 재현 가능한 테스트로 고정되지 않았다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:261-262`.
  - 상세: 이 대조는 리팩터 당시의 실측이라 신뢰할 수 있지만, 향후 누군가 `collectTsFiles` 를 수정했을 때 이 5-way 동등성이 깨져도 자동으로 잡아줄 자리가 없다(각 소비처 spec 이 실제 검출 결과로 간접 검증하긴 하지만, "파일 집합 자체의 동등성"을 직접 겨누는 테스트는 아니다). 다만 `.d.ts`/`node_modules`/`dist` 축은 각각 `collectTsFiles` 자체의 전용 테스트로 이미 하드닝됐으므로 위험도는 낮다.
  - 제안: 굳이 새 테스트를 추가할 필요는 낮지만, 후속 PR 에서 `collectTsFiles` 를 건드릴 때는 이 5개 소비처의 spec 을 함께 돌려 회귀를 확인할 것.

- **[INFO]** `widenedEntityFields` 의 `WIDENED_DECL` 정규식은 데코레이터와 필드 선언 사이에 **정확히 0개 또는 1개**의 추가 데코레이터 줄만 허용한다(`(?:\s*@\w+\((?:[^()]|\([^()]*\))*\)\s*\n)?`). 데코레이터가 2개 이상 겹치는 형태(예: `@ManyToOne() \n @Index() \n @JoinColumn() \n field`)는 이 정규식이 원리적으로 못 본다 — 이런 필드가 생기면 `widenedEntityFields` 가 조용히 그 필드를 누락하고, `findStaleSpecCasts` 는 그 필드를 겨눈 낡은 spec 캐스트를 영원히 못 잡는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:135`(`WIDENED_DECL` 정의).
  - 상세: 저장소 전수 grep 으로 확인한 결과 지금은 이 형태(같은 필드에 2개 이상 스택된 데코레이터)가 실재하지 않는다 — 그래서 "저장소 전수" 테스트(`nullable-type-lie-cast.spec.ts` 의 `describe('저장소 전수', …)`)가 지금은 이 갭을 드러내지 못한다. 오탐(false positive)이 아니라 **위음성(false negative)** 방향이라, "0건 GREEN" 이 이 축의 부재를 증명하지 못한다(이 저장소가 반복해 기록한 "정의를 한 칸 좁게 잡는다" 패턴과 같은 모양).
  - 제안: 급하지 않다(현재 실피해 없음). 다만 데코레이터 스태킹이 2단계 이상인 필드가 나타나면 이 정규식을 넓혀야 한다는 것을 `WIDENED_DECL` 옆에 짧게 적어 두면(이 파일의 다른 함수들이 이미 하는 "알려진 한계" 관례) 다음 사람이 헤매지 않는다.

## 요약

`collectTsFiles`(source-scan.ts)와 그 5개 소비처 리팩터, `widenedEntityFields`/`findStaleSpecCasts` 신규 가드는 전반적으로 테스트가 탄탄하다 — 임시 디렉터리 기반 fixture 로 격리가 잘 되고, "[전제]" 테스트로 vacuous pass 를 막고, 자기 spec 이 자기 fixture 에 걸리는 자기지시 문제(`stripLiterals` 도입 계기)를 뮤테이션으로 실증했다고 plan 에 기록했으며, 대조군(넓혀지지 않은 필드·주석 인용)도 갖췄다. 다만 두 가지 WARNING 이 남는다: (1) `stripLiterals` 가 재사용을 전제로 export 됐음에도 직접 테스트가 없어 자매 함수 `stripComments` 와 커버리지 수준이 비대칭이고, (2) `sort()` 회귀가 "이 환경에서 원리적으로 못 잡힌다"는 docstring 의 단언이 실측(픽스처에 형제 파일 하나 추가)으로 반증됐다 — 이 저장소가 스스로 여러 번 기록한 "설계 근거는 쓰기 전에 뮤테이션으로 반증하라"는 교훈이 이번에도 재발했다. 두 항목 모두 기능 결함은 아니고 코드도 정상 동작하지만, 다음 사람이 이 주석들을 그대로 신뢰하면 실제로 닫을 수 있는 커버리지 갭을 영구히 열어 둔 채로 둘 것이다.

## 위험도

MEDIUM
