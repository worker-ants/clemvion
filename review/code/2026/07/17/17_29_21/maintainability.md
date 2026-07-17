# 유지보수성(Maintainability) 리뷰

## 대상
- `codebase/frontend/eslint.config.mjs`
- `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (신규)

## 발견사항

- **[WARNING]** `@/components` 경로 매칭 정규식이 두 selector 에 문자열 그대로 중복되어 있다
  - 위치: `codebase/frontend/eslint.config.mjs:52`, `:59` (`ImportExpression[source.value=/.../]`, `CallExpression[...][arguments.0.value=/.../]`)
  - 상세: `^(@\\/components(\\/.*)?|(\\.\\.\\/)+components(\\/.*)?)$` 라는 동일한 정규식 리터럴이 동적 `import()` selector 와 `require()` selector 에 문자 그대로 복붙되어 있다. 여기에 `no-restricted-imports.patterns[].group` 의 glob 배열(`@/components`, `@/components/**`, `**/../components`, `**/../components/**`)까지 더하면, "components 레이어 경계"라는 동일 개념이 3곳(glob 배열 1 + regex 2)에 서로 다른 문법(glob vs regex)으로 각각 인코딩되어 있다. 이 커밋 자체가 "정적 import 만 막고 동적 import/require 는 못 막던" 부분 업데이트 누락 버그를 고치는 커밋이라는 점을 감안하면, 향후 패턴을 확장(예: `~/components` alias 추가, 새 우회 경로 대응)할 때 3곳 중 일부만 갱신하고 나머지를 빠뜨릴 위험이 구조적으로 남아 있다. 현재 회귀 테스트(`eslint-layering-guard.test.ts`)는 지금 하드코딩된 케이스들만 고정할 뿐, "두 정규식이 항상 동일해야 한다"는 불변조건 자체는 검증하지 않아 drift 를 잡아내지 못한다.
  - 제안: 정규식 본체를 `const COMPONENTS_PATH_RE = "(@\\/components(\\/.*)?|(\\.\\.\\/)+components(\\/.*)?)";` 형태로 파일 상단(또는 해당 config 블록 바로 위)에 한 번만 정의하고, 두 selector 문자열에는 템플릿 리터럴로 보간(`` `ImportExpression[source.value=/^${COMPONENTS_PATH_RE}$/]` ``)해서 단일 소스로 만든다. 여유가 있다면 회귀 테스트에 "두 정규식 문자열이 동일하다"를 직접 assert 하는 케이스를 하나 추가하면 더 견고해진다.

- **[INFO]** 테스트 파일 최상단에서 `throw new Error(...)` 로 setup 검증을 수행
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:19-23` (`layeringBlock?.rules` 부재 시 module-level throw)
  - 상세: `describe`/`it`/`beforeAll` 블록 밖, 모듈 평가 시점에 예외를 던진다. 의도(가드 블록 자체가 사라지면 "즉시, 크게" 실패해야 한다)는 타당하고 파일 상단 주석에도 명시되어 있어 코드를 읽는 사람이 의도를 오해할 가능성은 낮다. 다만 vitest 리포트에서 이런 module-level throw 는 특정 `it` 실패가 아니라 파일 전체 로드 실패로 표시되어, CI 로그만 보고 원인을 파악하기엔 개별 `it("가드 블록이 존재해야 한다", ...)` 형태보다 다소 불친절할 수 있다.
  - 제안: 현재도 충분히 목적을 달성하므로 필수 수정은 아니다. 선호한다면 `beforeAll` 안에서 동일한 assertion 을 수행하도록 옮기면 실패 리포트가 더 명확해진다.

- **[INFO]** 정규식 selector 문자열의 가독성
  - 위치: `codebase/frontend/eslint.config.mjs:52`, `:59`
  - 상세: `esquery` selector 문법과 이중 이스케이프된 정규식(`\\/`, `\\.\\.\\/`)이 한 줄에 뒤섞여 있어, ESLint flat config 의 selector 문법에 익숙하지 않은 리뷰어에게는 즉시 해석하기 어렵다. 바로 위 주석이 각 규칙의 의도를 잘 설명하고 있어 현재 수준에서도 유지보수는 가능하지만, 위 WARNING 항목의 상수 추출을 적용하면 이 가독성 이슈도 부수적으로 개선된다.
  - 제안: 위 WARNING 의 상수 추출로 자연히 완화됨. 별도 조치 불필요.

## 요약
변경은 크지 않고 각 블록에 배경·의도를 설명하는 주석이 충실해 개별 규칙의 가독성 자체는 양호하다. 다만 이번 커밋의 핵심 목적이 "레이어 가드가 부분 업데이트로 조용히 무력화되는 것"을 막는 것인데, 정작 그 가드를 구성하는 정규식 패턴이 두 selector 에 문자 그대로 중복되어 있어 동일한 부류의 drift 위험(패턴 확장 시 한쪽만 갱신)이 코드 자체에 남아 있다. 함수 길이·중첩 깊이·네이밍·테스트 구조(`it.each` 로 위반/비위반 케이스를 표 형태로 나열)는 모두 무난하며, 신규 패턴이라 기존 코드베이스와의 직접적 스타일 충돌은 없다.

## 위험도
LOW
STATUS: success
