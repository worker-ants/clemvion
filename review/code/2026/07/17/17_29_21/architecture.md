# 아키텍처(Architecture) Review

대상: `codebase/frontend/eslint.config.mjs` (레이어 가드 확장), `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (신규 회귀 테스트)

## 검증 방법

정적 diff 리뷰에 더해 다음을 실측했다 (grep/카운트가 아닌 실제 실행 — MEMORY 지침 준수):

- `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` → 16 tests 전원 pass.
- `npx eslint` 를 `src/lib/` 하위 임시 probe 파일(`import type { Foo } from "@/components/..."`)에 실제 전체 flat config(= `nextVitals`+`nextTs`+레이어 가드 병합)로 직접 실행 → 정상적으로 `no-restricted-imports` 에러로 잡힘 확인.
- `grep -rn "@/components"` / `grep -rnE "from ['\"](\.\./)+components"` 를 `src/lib/**` 전체에 실행 → 현재 위반 0건 확인 (가드 도입 시점에 breaking change 없음).
- `grep -rln "@/lib" src/components` → 255개 파일이 반대 방향(`components → lib`)으로 정상 의존. 레이어 방향 판단의 근거.

## 발견사항

- **[INFO]** 레이어 경계 정의(`lib → components` 금지) 자체는 아키텍처적으로 타당하고 실측으로 뒷받침됨
  - 위치: `codebase/frontend/eslint.config.mjs:53-100`
  - 상세: `src/lib/conversation/rag-types.ts`, `src/components/editor/run-results/conversation-utils.ts` 의 배경 주석이 설명하듯, `src/lib/websocket/` 이 conversation 유틸/타입을 소비해야 하는데 그 원본이 `components/` 에 있으면 순수 로직 계층이 프레젠테이션 계층에 의존하는 역전이 발생한다. 실측 결과 현재 `src/lib/**` 어디에도 `@/components` 의존이 없고(0건), 반대로 `components → lib` 는 255개 파일에서 정상적으로 이뤄지고 있어 "lib 는 하위 계층, components 는 상위 계층" 이라는 판단이 코드베이스 실태와 일치한다. Clean-Architecture 류 Dependency Rule 을 ESLint 로 강제하는 정석적 접근이며, `eslint-layering-guard.test.ts` 는 이 가드 자체가 fail-open 되는 것을 막는 "architecture fitness function" 패턴으로 적절하다.
  - 제안: (문제 없음 — 유지)

- **[WARNING]** 레이어 경계 규약이 `spec/conventions/` 에 정식 문서화되지 않고 코드 주석(3개 파일)에만 분산 존재
  - 위치: `codebase/frontend/eslint.config.mjs:54-56` (배경 주석), `src/lib/conversation/rag-types.ts:1-9`, `src/components/editor/run-results/conversation-utils.ts:1-4`, `src/lib/__tests__/eslint-layering-guard.test.ts` docstring
  - 상세: 프로젝트 CLAUDE.md 는 "정식 규약 → `spec/conventions/<name>.md`" 를 단일 진실 원칙으로 명시한다. `spec/conventions/` 전체를 검색해도 이 레이어 경계 규약을 다루는 문서가 없고(`grep -rli "레이어\|layer" spec/conventions/` 결과 무관 문서만 매칭), `plan/complete/rag-tool-row-distinct-ui.md:16,187-189` 에 "후속 백로그: `lib/`→`components/` ESLint 가드" 라는 계획 언급만 있을 뿐이다. 지금은 이 커밋으로 그 백로그가 실행됐지만, 근거는 여전히 `eslint.config.mjs` 인라인 주석 + 두 소스 파일 주석 + 테스트 docstring 에 흩어져 있다. CI 가 강제하는 아키텍처 규칙의 "왜" 가 spec 이 아니라 코드 주석에만 있으면, 향후 새 하위 디렉터리(`src/types/` 등, 아래 참조)를 만들 때 이 원칙을 적용해야 하는지 판단할 근거를 찾기 어렵다.
  - 제안: `spec/conventions/frontend-layering.md`(가칭)를 신설해 "lib(비즈니스 로직/유틸/상태) 는 components(프레젠테이션) 를 import 할 수 없다" 는 규약과 근거·예외(테스트 파일 포함 여부 등)를 SoT 로 명시하고, `eslint.config.mjs` 주석·`rag-types.ts`·`conversation-utils.ts` 주석은 그 문서를 가리키는 짧은 참조로 축약한다.

- **[WARNING]** 가드 스코프(`files: ["src/lib/**"]`)가 동일한 계층적 지위를 가진 sibling 디렉터리를 누락
  - 위치: `codebase/frontend/eslint.config.mjs:62` (`files: ["src/lib/**"]`)
  - 상세: `src/` 최상위에는 `lib` 외에도 `src/types/`(현재 `transform.ts` 1개 파일, `ConditionOperator` 등 순수 타입 정의) 라는 동일한 성격의 "하위 계층" 디렉터리가 별도로 존재한다(`src/lib/types/` 와는 다른, `src/` 바로 아래의 top-level 디렉터리). 이 파일은 `src/lib/transform/apply-operation.ts` 등이 소비할 가능성이 높은 순수 타입 모듈로, `rag-types.ts` 가 말하는 "타입이 `@/components/` 에 있으면 레이어 역전" 논리가 그대로 적용되는 위치다. 그러나 현재 가드는 `src/lib/**` 만 커버하므로 `src/types/**` 에서 `@/components/**` 를 import 해도 아무 것도 잡히지 않는다. 지금 당장 위반은 0건(실측 확인)이라 즉각적 결함은 아니지만, "레이어 역전 금지" 라는 아키텍처 의도가 `src/lib` 라는 하나의 디렉터리 이름에 우연히 국소화된 것이라면, 의도(비즈니스/유틸 계층은 프레젠테이션에 의존하지 않는다)와 스코프(`src/lib/**` 라는 glob) 사이에 괴리가 생길 수 있다.
  - 제안: `src/types/**` 도 같은 규칙을 적용할지(대상 계층 명시적으로 확장) 여부를 위 spec/conventions 문서에서 결정하고, 필요하면 `files` glob 에 추가한다. 동시에 향후 유사 디렉터리(예: 새 top-level 유틸 폴더)가 생길 때 재검토가 필요함을 문서에 남긴다.

- **[INFO]** 회귀 테스트가 실제 프리셋 합성 경로를 우회해 "eslint-config-next 업그레이드로 인한 병합 동작 변화" 방어 범위를 커밋 메시지 주장보다 좁게 커버
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:322-342`
  - 상세: 테스트는 `eslint.config.mjs` 배열에서 `files.includes("src/lib/**")` 인 블록 하나만 찾아 그 `rules` 객체만 별도의 최소 `verifyConfig`(자체 `languageOptions`, `nextVitals`/`nextTs` 미포함)에 재조립해 검증한다. 이 방식은 "규칙 자체가 삭제/약화/glob 오타로 무력화" 되는 것은 확실히 잡지만, 커밋 메시지가 명시한 방어 대상 중 하나인 "`eslint-config-next` 업그레이드로 인한 병합 동작 변화"(예: 향후 프리셋이 `src/lib/**` 를 매칭하는 자신의 `no-restricted-imports`/`no-restricted-syntax` 를 도입해 flat-config 배열 순서상 이 레이어 가드보다 뒤에 위치하며 규칙을 override 하는 시나리오)는 이 테스트 구조상 원리적으로 탐지 불가능하다 — 실제 배열 병합을 거치지 않고 `rules` 객체만 발췌하기 때문이다. 실제 프로덕션 경로(`npx eslint`, 전체 flat config 병합)는 이번 실측(`import type` 케이스)에서 정상 동작을 확인했으므로 현재는 문제가 없지만, 테스트가 커버한다고 주장하는 범위와 실제로 커버하는 범위 사이에 차이가 있다.
  - 제안: 필수는 아니나, 여유가 있다면 전체 `eslintConfig` 배열을 그대로 `Linter#verify` 에 먹이는 별도 (더 무거운/느린) 테스트를 하나 추가해 실제 병합 순서까지 회귀 고정하거나, 최소한 테스트 docstring 에서 "병합 동작 변화" 방어는 이 테스트가 아니라 실제 `npx eslint` 실행(CI lint step)에 의존한다는 점을 명시해 커버리지 주장을 실제 범위에 맞춘다.

- **[INFO]** 정규식 기반 2-rule 조합은 현재 규모에는 적절하나 경계가 늘어나면 선형으로 증식할 소지
  - 위치: `codebase/frontend/eslint.config.mjs:82-98` (`no-restricted-syntax` selector 2개)
  - 상세: `no-restricted-imports`(정적) + `no-restricted-syntax`(동적 `import()`/`require()`) 조합은 "한 방향(lib→components) 경계 하나" 를 표현하기 위해 이미 정규식 셀렉터 2개 + import 패턴 4개가 필요하다. 방향/디렉터리 쌍이 하나 더 늘어나면(예: 위 `src/types/**` 확장, 혹은 `src/lib/web-chat` 처럼 서로 다른 하위 도메인 간 경계 추가) 동일한 정규식 패턴이 반복·변주되며 유지보수 비용이 커질 수 있다. `eslint-plugin-import` 의 `no-restricted-paths`(zone 기반, 정적+동적 import 동시 커버) 같은 선언적 레이어 경계 전용 도구를 쓰면 "허용되지 않는 (from, target) 디렉터리 쌍" 을 데이터로 나열하는 형태로 확장성을 높일 수 있다. 다만 해당 플러그인은 현재 devDependency 로 존재하지 않아(`node_modules/eslint-plugin-import` 부재 확인) 신규 의존성 추가 비용이 든다.
  - 제안: 지금 규모(경계 1쌍)에서는 과설계이므로 즉시 조치 불필요. 경계 쌍이 2개 이상으로 늘어나는 시점에 재평가.

## 순환 의존성 점검

`src/lib/**` → `@/components/**` 방향의 실제 import 는 (테스트 픽스처 제외) 0건이며, `components → lib` 는 255개 파일에서 이뤄지고 있어 현재 순환 의존은 없다. 이번 변경은 기존 순환을 "고치는" 것이 아니라 향후 순환이 생기는 것을 원천 차단하는 예방적 가드다.

## 요약

이번 변경은 `src/lib/**`(비즈니스 로직/유틸 계층)이 `@/components/**`(프레젠테이션 계층)를 정적·동적 import 어느 경로로도 참조할 수 없도록 ESLint 로 강제하고, 그 강제가 config 병합 과정에서 조용히 무력화되지 않는지 회귀 테스트로 고정한 것이다. 레이어 방향 판단(lib 은 하위, components 는 상위) 은 실측(255 대 0)과 일치하고, 실제 프로덕션 경로(전체 flat config 병합 후 `npx eslint`)에서 TS 타입 전용 import 케이스까지 정상 차단됨을 직접 실행해 확인했다 — 안티패턴 없이 정석적인 "Dependency Rule as CI fitness function" 패턴이다. 다만 이 규약의 근거가 `spec/conventions/` 가 아니라 3곳의 코드 주석에만 흩어져 있고, 가드 스코프(`src/lib/**`)가 동일한 계층적 지위를 갖는 `src/types/**` 같은 sibling 디렉터리를 포함하지 않아 "레이어 역전 금지" 라는 아키텍처 의도 전체를 커버하지는 못한다는 점, 그리고 회귀 테스트가 주장하는 방어 범위(프리셋 업그레이드로 인한 병합 동작 변화)와 실제 테스트 구조가 검증하는 범위 사이에 미세한 간극이 있다는 점은 문서화/스코프 정합성 관점에서 보완 여지가 있다. 코드 자체의 정합성·정확성 문제는 아니다.

## 위험도

LOW
