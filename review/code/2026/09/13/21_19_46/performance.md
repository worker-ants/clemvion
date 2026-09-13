# 성능(Performance) 리뷰 — error-code-emission-axis

## 범위 요약

이번 변경 세트에서 런타임/알고리즘 관점의 실질 코드는 두 파일뿐이다:

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — 발행 축 수집기 3종(`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`) + 판정 함수(`isMessagePrefixOnly`/`computeNonEmittedOffenders`) 신규 추가
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 위 함수들을 소비하는 신규 `describe` 블록 + `parseWhereRefs`/`staleGuideEntries` 헬퍼

나머지(`CHANGELOG.md`·`PROJECT.md`·`logic.mdx`/`logic.en.mdx`·`plan/**`·`review/**`)는 문서/plan/리뷰 산출물이라 성능 관점에서 검토 대상이 아니다. 두 코드 파일 모두 **테스트/CI 시점에만 실행되는 dev-tooling**이고 프로덕션 런타임 경로가 아니므로, 여기서 발견한 항목들은 등급을 그에 맞게 낮췄다.

## 발견사항

- **[WARNING]** `where` 검증 테스트가 **같은 파일**에 대해 동일한 전체 트리 스캔을 줄(line) 참조 개수만큼 반복한다 — 파일 단위가 아니라 참조 단위로 캐시 없이 `walkTree` 를 호출
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:253-267` (`it("where 의 파일:줄 이 실제로 그 토큰을 담는다...")`, 특히 258번째 줄 `for (const { file, line: lineNo } of refs)` 및 259번째 줄 `walkTree(root, ["codebase/backend/src"], {...})` 호출부)
  - 상세: `parseWhereRefs`(`:55-62`)는 `where` 문자열 안의 `파일:줄` 참조를 **전부** 펼쳐서 리스트로 낸다. 그런데 이후 루프는 `refs` 를 **참조 단위**로 순회하며 매 참조마다 `walkTree(root, ["codebase/backend/src"], { includeFile: (n) => n === path.basename(file) })` 를 호출한다. `walkTree` 는 캐시 없이 `codebase/backend/src` 전체(현재 1,304개 파일·246개 디렉터리, `find codebase/backend/src -type f | wc -l` 로 실측)를 스택 기반 DFS 로 매번 새로 순회한다(`tree-walk.ts:80-102`, `fs.readdirSync` 반복 호출).
    현재 등록된 `GUIDE_NON_EMITTED_VOCABULARY` 3건을 실측하면:
    - `MAKESHOP_UNRESOLVED_PATH_PARAM` → `makeshop.handler.ts` 1건
    - `CONTAINER_MISSING_EMIT` → `where: "execution-engine.service.ts:7121·7125"` — **같은 파일**을 가리키는 참조가 2개(`parseWhereRefs` 가 `·` 로 분리한 결과)
    - `CONTAINER_MULTIPLE_EMIT` → `execution-engine.service.ts:7130` — 위와 **동일 파일**
    즉 이 한 번의 `it()` 실행에서 `walkTree` 가 4번 호출되고, 그중 **3번이 정확히 같은 파일**(`execution-engine.service.ts`)을 찾기 위해 246개 디렉터리를 처음부터 다시 훑는다. 상한(`NON_EMITTED_VOCABULARY_CAP = 5`)이 채워지고 각 항목이 여러 줄을 인용하면 최악의 경우 최대 15회 가까이 전체 트리 스캔이 반복될 수 있다.
  - 제안: `walkTree` 결과를 파일명(`path.basename`) 단위로 한 번만 계산해 재사용하거나(예: 루프 시작 전에 `refs` 를 `file` 기준으로 `Set`/`Map` 으로 중복 제거한 뒤 그 결과만 순회), 아예 이 테스트 진입 시 `codebase/backend/src` 를 한 번만 순회해 `basename → absPath[]` 맵을 만들어 두고 각 참조는 그 맵을 조회하도록 바꾸면 3번의 중복 스캔이 사라진다. 다만 이 저장소는 같은 항목(RESOLUTION.md `#5`)을 이미 "상한 5건이라 실질 비용 낮음"으로 낮은 우선순위 처리해 두었으므로, 새 지적이라기보다 **그 판단을 뒷받침하는 구체적 배율(3/4 호출이 중복)**로 참고할 값이다. 오늘 규모에선 CI 체감 지연은 미미하지만, 등록 항목이 늘어나는 방향(이 목록의 존재 이유 자체)이라 배율이 함께 커진다.

- **[INFO]** 발행 축 수집기 2종이 기존과 동일한 `sourceTexts` 코퍼스에 대해 정규식 전체 스캔을 2회 추가
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:118-119` (`collectQuotedLiterals(sourceTexts)`, `collectMessagePrefixes(sourceTexts)`), 정의부는 `guide-identifier-scan.ts` `collectMatches`(`:239-266` 부근, `matchAll` 기반)
  - 상세: `sourceTexts`(백엔드+packages `.ts` 파일 전체 텍스트 배열)는 이미 `collectSourceTokens`/`scanIdentifierCitations` 등 기존 축이 읽어 온 것을 **재사용**하므로 파일 I/O 재발생은 없다. 다만 새로 추가된 두 수집기가 각각 전체 코퍼스를 처음부터 끝까지 정규식으로 다시 훑으므로(`matchAll` 은 내부적으로 정규식을 복제해 순회) 기존 대비 정규식 패스가 2회 늘었다. `describe` 콜백 본문(모듈 로드 시 1회 실행)에서 일어나므로 테스트 개수와 무관하게 고정 비용이고, 텍스트가 이미 메모리에 있어 증분 비용은 CPU 시간(문자열 스캔)뿐이다.
  - 제안: 오늘 규모(테스트 스위트 1회 실행)에서는 조치 불필요. 코퍼스가 크게 늘어나거나 이런 축이 더 추가되면 `collectMatches` 호출을 한 번에 여러 정규식을 받아 단일 패스로 도는 형태로 통합하는 것을 고려할 수 있다(지금은 세 정규식이 경계 조건이 서로 달라 억지로 합치면 `guide-identifier-scan.ts` 자체 주석이 경계한 "정본 판정 로직 분산" 문제를 재현할 수 있어 권장하지 않는다 — 트레이드오프로 남긴다).

- **[INFO]** `computeNonEmittedOffenders` 의 4단 `.filter()` 체인 — 규모상 문제 없음, 참고 기록
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` `computeNonEmittedOffenders` 함수 본문(`[...new Set(citedTokens)].filter(...).filter(...).filter(...)`)
  - 상세: MDX 가이드가 인용하는 UPPER_SNAKE 토큰 수는 실측 기준 수백 종 이하(백틱 전수 스캔 대상)라 O(n) 필터 3회 연쇄는 무시할 수 있는 비용이다. 알고리즘 자체는 명확하고 각 항이 진리표 대조군으로 검증돼 있어 조치 불필요.

## 요약

이번 변경은 문서 가드 테스트 스위트(dev-tooling, CI 전용)에 "발행 축" 판정 로직을 추가한 것으로, 프로덕션 런타임 경로에는 성능 영향이 전혀 없다. 유일하게 실측으로 확인한 개선 여지는 `where` 필드의 `파일:줄` 참조를 검증하는 테스트가 **같은 파일**을 가리키는 여러 줄 참조에 대해 `codebase/backend/src`(1,304 파일) 전체 트리 스캔을 중복 실행한다는 점이다(현재 데이터로 4회 호출 중 3회가 동일 파일 재스캔). 상한이 5건으로 낮게 고정돼 있어 오늘 체감 비용은 작지만, 이 목록이 늘어나는 방향으로 설계돼 있어 배율이 함께 커질 수 있다. 그 외 신규 정규식 수집기들은 이미 메모리에 있는 코퍼스를 재사용하고 필터 체인 규모도 작아 실질적 성능 리스크는 없다.

## 위험도

LOW
