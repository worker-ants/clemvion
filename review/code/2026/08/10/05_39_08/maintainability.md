# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** Gate C 정책 함수(`isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`danglingSpecImpact`/`makeSpecExists`/`GATE_C_CUTOFF`/`NONE_VALUES`)가 `*.test.ts` 파일 안에 상주한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:30-31, 57-134`
  - 상세: 같은 PR 이 `plan-scan.ts`("테스트 밖에서 부를 수 있는 순수 함수" 를 위한 별도 모듈)를 신설해 status/frontmatter 판정 로직을 그쪽으로 옮겼는데, 동일 성격(재사용 가능한 순수 판정 로직)인 Gate C 정책 함수들만 여전히 `spec-plan-completion.test.ts` 라는 `.test.ts` 파일 안에서 정의·export 되고 있다. 다른 스크립트(예: pre-commit hook, CLI)가 이 판정을 재사용하려면 테스트 파일을 import 해야 하는 구조라 `plan-scan.ts` 신설 원칙과 어긋난다. 실제로 밖에서 이 export 를 쓰는 소비처는 현재 없음(grep 확인) — 지금은 동작 결함이 아니라 배치 위치의 아키텍처적 비일관성이다.
  - 제안: 정책 함수들을 `plan-scan.ts` 로 이동. 단, 이미 `plan/in-progress/docs-guard-walker-dedup.md` 에 "Gate C 판정 함수들이 `*.test.ts` 안에 산다"(ai-review WARNING 3회 관측, 선재 배치로 판정되어 별도 plan 으로 분리됨)로 등재돼 있으므로 이번 PR 범위에서 새로 처리할 필요는 없고, 해당 plan 으로 계속 forwarding.

- **[WARNING]** `danglingSpecImpact` 네이밍이 모듈의 확립된 컨벤션(`find*` 접두 = 필터링된 위반 배열 반환)과 어긋난다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:96-101` (함수 선언)
  - 상세: 같은 카테고리("걸러진 위반 목록을 배열로 반환") 함수들은 전부 `find*` 접두를 쓴다 — `findUnparseablePlans`/`findNonTerminalCompletedPlans`/`findFrontmatterViolations`(`plan-scan.ts`), `findBrokenPlanLinks`(`spec-links.ts`). `danglingSpecImpact` 만 형용사형 이름이라 boolean predicate 나 속성처럼 읽히는데 실제로는 `unknown[]` 필터 결과를 반환한다. 호출부(`spec-plan-completion.test.ts:225`)에서 `const dangling = danglingSpecImpact(impact, specExists);` 로 배열을 받는다는 것을 이름만으로는 알기 어렵다.
  - 제안: `findDanglingSpecImpact` 로 개명해 모듈 전역 네이밍 패턴에 맞춘다.

- **[WARNING]** 동일 파일 안에 frontmatter 블록을 생성하는 헬퍼가 두 개(`fm`, `frontmatter`) 존재 — 사실상 중복.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:31-32`(`fm`), `:217-218`(`frontmatter`)
  - 상세: `fm(status?)` 는 `title: t` 고정 + 선택적 `status` 필드만 지원하고, `frontmatter(fields)` 는 임의 필드 record 를 받는 더 일반적인 버전이다. `fm` 은 `frontmatter({ title: "t", ...(status ? { status } : {}) })` 로 완전히 대체 가능해 보이며, 두 헬퍼가 "---\n...\n---\n\n# Doc\n" 을 만드는 동일 관용구를 각자 손으로 반복하고 있다. 이 파일 자체가 서두 주석에서 "손수 순회하는 walker 넉 벌이 조용히 갈렸다" 를 반복 경계하는데, 정작 자신의 fixture 빌더가 두 벌이 된 형태다.
  - 제안: `fm` 을 제거하고 `frontmatter` 로 통일(또는 `frontmatter` 에 `title` 기본값을 주는 얇은 래퍼로 재정의).

- **[INFO]** 매직넘버 `toBeGreaterThan(10)` 의 임계값 선택 근거가 설명되지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:172`
  - 상세: 같은 성격의 sanity 체크(discovery 가 살아있는지 확인하는 하한값)를 쓰는 자매 파일 `plan-frontmatter.test.ts:59-62` 는 "하한을 왜 낮게 잡는지, `>20` 이 실제로 grooming 후 정확히 20이 되어 발화했던 전례" 까지 주석으로 남겨 놓았다. 이 파일의 `toBeGreaterThan(10)` 은 존재 이유(vacuous pass 방지)는 설명하지만 "왜 하필 10인지" 는 설명이 없어, 향후 `plan/complete/` 개수가 grooming 으로 줄어들 때 같은 종류의 오탐 이력이 반복될 수 있다.
  - 제안: 자매 파일과 동일한 수준의 근거 한 줄을 덧붙이거나, 상수로 추출해 주석을 한 곳에 모은다.

- **[INFO]** `startedDate` 와 `hasMalformedStarted` 가 `rawScalar(block, "started")` 호출 + 유효성 판정 로직을 부분적으로 중복한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:47-51`(`startedDate`), `:63-66`(`hasMalformedStarted`)
  - 상세: 둘 다 `rawScalar(block, "started")` 를 각자 호출하고 `isIsoDate` 로 판정한다. 같은 `block` 에 대해 두 함수가 함께 불리는 실제 경로(예: 244-ish 라인의 `enforced` 필터 + malformed-started 테스트)에서 `rawScalar` 가 중복 실행된다. 로직 자체는 사소하지만(2~3줄) 한쪽만 고치고 다른 쪽을 놓치는 향후 drift 여지가 있다.
  - 제안: `hasMalformedStarted` 가 raw 값을 별도 계산하는 대신 공유 헬퍼(`rawStarted(block)`)를 두 함수가 함께 쓰도록 정리하면 이런 종류의 drift 를 원천 차단한다. 우선순위는 낮음.

- **[INFO]** non-null assertion(`!`)이 필터 이후 반복 사용된다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:208`(`parsed!.data.spec_impact`), `:238`(`p.parsed!.block`)
  - 상세: `enforced` 는 `p.parsed !== null` 로 필터링됐지만(:162) TypeScript 는 클로저를 넘어 이 불변식을 좁혀주지 못해, 소비 지점마다 `!` 로 수동 단언한다. 현재는 인접 주석("enforced 를 통과한 plan 만 오므로 파싱은 이미 성공했다")으로 정당화돼 있어 당장 위험하진 않지만, `!` 는 컴파일러가 강제하지 못하는 신뢰 지점이라 향후 필터 조건이 바뀌면 조용히 틀어질 수 있다.
  - 제안: type predicate(`(p): p is {..., parsed: ParsedFrontmatter} => ...`)로 `enforced` 를 필터링하면 `!` 없이 타입이 좁혀진다. 우선순위는 낮음.

- **[INFO]** `collectCompletePlans`(private, `spec-plan-completion.test.ts`)와 `collectCompletePlanMarkdown`(exported, `plan-scan.ts`) 이름이 한 단어 차이라 혼동 소지가 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:139-141`
  - 상세: 전자는 `absPath` 문자열 배열, 후자는 `PlanMdFile[]` 을 반환하는 얇은 래퍼 관계다. 이미 `plan/in-progress/docs-guard-walker-dedup.md` "Gate C 의 4번째 walker" 절에 후속 과제로 등재돼 있고(`collectCompletePlanMarkdown` 재사용으로 전환 시 이름 충돌도 함께 해소 예정), 이번 PR 은 이미 필터 로직을 `walkPlanMarkdown` 파생으로 통합해 값 자체의 drift 위험은 해소한 상태다. 신규 지적이 아니라 기존 추적 항목의 재확인.

## 요약

전반적으로 코드는 짧고 단일 책임을 지키는 순수 함수 위주로 잘 구성돼 있고, 비직관적인 동작(js-yaml 날짜 롤오버, gray-matter 파싱 캐시 오염, `path.join` 정규화 함정 등)마다 "왜" 를 설명하는 주석이 충실해 가독성 자체는 높다. 다만 두 가지는 짚을 만하다. 첫째, Gate C 정책 함수들이 `.test.ts` 파일 안에 상주하는 구조는 이 PR 이 스스로 세운 "재사용 가능한 순수 로직은 `plan-scan.ts` 로" 원칙과 어긋나며, 이는 이미 별도 plan 문서에 3회 관측 이력으로 추적되고 있어 이번 리뷰에서 새로 막을 필요는 없지만 구조적 채무로 남아 있다는 점은 재확인해 둔다. 둘째, `danglingSpecImpact` 네이밍과 `fm`/`frontmatter` 헬퍼 중복은 이번 PR 이 직접 만든, 비용이 낮은 개선 여지다. 전체적으로 기능적 위험이나 심각한 복잡도 문제는 없다.

## 위험도
LOW
