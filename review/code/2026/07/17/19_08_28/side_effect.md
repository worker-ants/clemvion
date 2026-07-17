# 부작용(Side Effect) 리뷰

리뷰 대상: `git diff origin/main..HEAD`
실질 코드 변경은 2개 파일로 국한됨 — `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`. 나머지는 `review/code/2026/07/17/{18_06_36,18_43_17}/**` 신규 산출물(선행 리뷰 라운드의 SUMMARY/RESOLUTION/에이전트 리포트 등)로, 코드 리뷰 하네스가 관례(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 따라 생성한 정상 출력이며 애플리케이션 코드·런타임에 영향을 주지 않으므로 side effect 관점에서 별도 항목화하지 않음.

## 점검 절차 (실측)

- `grep -rn "COMPONENTS_PATH_RE\|literalSpecifier\|backtickSpecifier\|REQUIRE_CALL"  codebase/frontend/eslint.config.mjs` → 전부 동일 파일, 동일 `files: ["src/lib/**"]` 블록 내부에서만 참조됨을 확인.
- `grep -rln "eslint.config.mjs" codebase/frontend --include=*.ts --include=*.tsx --include=*.mjs --include=*.js` → 소비자는 `eslint-layering-guard.test.ts` 단 하나. config 의 default export 형태(flat config 배열)를 소비하는 다른 코드 없음.
- `grep -rn 'import(\`|require(\`' codebase/frontend/src/lib/` (테스트 제외) → 매치 없음. 즉 `src/lib/**` 안에 새 backtick selector 가 실제로 새로 잡아낼 기존 코드 자체가 존재하지 않음.
- `cd codebase/frontend && npx eslint .` → `0 errors, 12 warnings` (경고 목록도 변경 전과 동일한 12건, `src/lib` 관련 신규 항목 없음). 프롬프트에 명시된 baseline 과 일치.
- `cd codebase/frontend && npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` → `34 passed (34)`.

## 발견사항

- **[INFO]** selector 확장의 스코프는 `files: ["src/lib/**"]` 블록 내부로 유지됨 — 외부 영향 없음
  - 위치: `codebase/frontend/eslint.config.mjs:43,55` (files 선언), `:73-89` (4개 selector)
  - 상세: `COMPONENTS_PATH_RE`/`literalSpecifier`/`backtickSpecifier`/`REQUIRE_CALL` 모두 이 한 블록에서만 참조된다(grep 실측). `no-restricted-syntax` 배열이 2개 → 4개 엔트리로 늘었지만 소속 블록의 `files` glob 은 변경되지 않았으므로, `src/lib/**` 바깥 파일에는 애초에 이 규칙이 적용되지 않는다. 백틱 매칭 추가는 "같은 스코프 안에서 이전에 놓치던 AST 형태(TemplateLiteral)를 추가로 잡는" 것이지, 스코프 자체를 넓히는 변경이 아니다.
  - 제안: 조치 불요.

- **[NONE]** 인터폴레이션 백틱(``import(`@/components/${x}`)``)에 대한 오탐 없음
  - 위치: `codebase/frontend/eslint.config.mjs:16-17` (`backtickSpecifier`), 대응 테스트 `eslint-layering-guard.test.ts` "인터폴레이션이 섞인 백틱은 계산 경로라 잡지 않는다"
  - 상세: selector 가 `[path.expressions.length=0]` 프레디킷을 앞에 걸어, `TemplateLiteral.expressions` 가 1개 이상(즉 `${...}` 삽입이 있는 경우)이면 매칭 자체가 실패하도록 설계되어 있다. `quasis[0].value.raw` 비교는 `expressions.length=0` 조건이 통과한 뒤에만 평가되므로, 계산된 경로 문자열은 정규식 검사 대상에 아예 들어가지 않는다. 신규 테스트 케이스(`import(\`@/components/${n}\`)` → 위반 0건)로 이 동작이 고정되어 있고 34/34 pass 로 실측 확인.
  - 제안: 조치 불요.

- **[NONE]** 실제 회귀 없음 — lint/test 실측 재현
  - 위치: N/A (환경 검증)
  - 상세: `npx eslint .` 결과 `0 errors, 12 warnings`(경고 목록도 변경 전 baseline 과 항목·개수 동일), `src/lib/**` 안에 백틱 동적 import/require 사용례 자체가 없어(grep 매치 0건) 새 selector 가 기존 코드에서 신규 위반을 만들어낼 여지가 없었다. `eslint-layering-guard.test.ts` 34/34 pass.
  - 제안: 조치 불요.

- **[INFO]** 테스트 헬퍼의 `mergedRules` 는 원본 config 객체를 얕은 복사만 함 — 현재는 read-only 라 무해
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (`mergedRules = Object.assign({}, ...layeringBlocks.map((c) => c.rules ?? {}))`)
  - 상세: `Object.assign` 은 top-level 키만 새 객체로 옮기고, 각 규칙 값(`["error", {...}]` 배열 등)은 import 된 `eslintConfig` 모듈의 원본 참조를 그대로 공유한다. 현재 diff 범위 내에서는 `ruleSeverity()` 를 포함해 모든 사용처가 읽기 전용이라 실질적 위험은 없다. 다만 향후 이 헬퍼를 이용해 mutation 을 in-place 로 가하는 테스트 코드가 추가되면(예: `mergedRules["no-restricted-imports"][0] = "warn"`), 동일 vitest worker 안에서 같은 모듈 캐시를 공유하는 다른 테스트에 상태가 전이될 수 있다. ESLint CLI 는 별도 프로세스에서 `eslint.config.mjs` 를 새로 로드하므로 실제 lint 실행에는 영향이 없다 — 오직 같은 vitest 프로세스 내 테스트 간 격리에 한정된 이론적 리스크다.
  - 제안: 현재 조치 불요. 향후 이 헬퍼로 mutation 테스트를 작성할 경우 `structuredClone(mergedRules)` 등으로 깊은 복사 후 다루도록 주석/컨벤션을 남겨두면 좋다.

- **[NONE]** 시그니처/인터페이스 변경 영향 없음
  - 위치: `eslint.config.mjs` default export, 테스트 내부 `layeringErrors()` 헬퍼
  - 상세: `eslint.config.mjs` 의 default export 형태(`defineConfig([...])` 로 만든 flat config 배열)는 변경 전후 동일하며, 소비자는 테스트 파일 하나뿐임을 grep 으로 확인했다. `layeringErrors()` 는 비공개 테스트 헬퍼(export 없음)로, fatal 파싱 에러 시 throw 하도록 동작이 강화됐지만 이는 테스트 파일 내부에서만 소비되고 외부 호출자가 없어 하위 호환성 문제가 없다.
  - 제안: 조치 불요.

- **[NONE]** 전역 변수·환경 변수·파일시스템·네트워크·이벤트/콜백
  - 위치: N/A
  - 상세: 신규 상수(`COMPONENTS_PATH_RE` 등)는 ES 모듈 스코프에 국한되며 `globalThis`/`process.env` 등에 대한 읽기·쓰기가 없다. 파일 생성/삭제, 네트워크 호출, 이벤트 발행 코드는 diff 어디에도 없다.
  - 제안: 조치 불요.

## 요약

`eslint.config.mjs` 의 selector 확장(백틱 TemplateLiteral 매칭 추가)은 기존 `files: ["src/lib/**"]` 블록 내부에 스코프가 그대로 유지되어 다른 파일·다른 규칙에 영향을 주지 않으며, `expressions.length=0` 프레디킷이 인터폴레이션 백틱(계산 경로)을 명시적으로 배제해 오탐을 만들지 않는다는 것을 코드 구조·grep·신규 테스트 케이스·실측 lint/vitest 실행으로 교차 확인했다. `npx eslint .` 는 `0 errors, 12 warnings` 로 변경 전 baseline 과 동일했고, `src/lib/**` 안에 백틱 동적 import/require 사용례 자체가 없어 새 selector 가 기존 코드에서 신규 위반을 만들 여지도 없었다. 테스트 파일의 `mergedRules` 가 원본 config 객체를 얕은 복사해 참조를 공유하는 점은 현재는 read-only 사용이라 무해하지만 향후 mutation 기반 테스트 확장 시 유의할 잠재 포인트로 INFO 처리했다. 그 외 전역 변수·환경 변수·파일시스템·네트워크·시그니처/인터페이스 파급 효과는 발견되지 않았다.

## 위험도

NONE
