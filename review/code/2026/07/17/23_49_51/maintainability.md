# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** ESLint 규칙 필터 predicate 중복
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` — 기존 `layeringErrors()` (합성 `Linter#verify` 스위트용) 와 신규 `errorsAt()` (실제 `ESLint` API 스위트용) 모두 `(m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-syntax"` 를 동일하게 반복한다.
  - 상세: 두 스위트가 서로 다른 API(`Linter` vs `ESLint`)를 쓰기 때문에 함수 자체를 합칠 필요는 없지만, "레이어 가드가 사용하는 rule-id 목록" 이라는 지식은 하나의 상수로 뽑아둘 만하다. 지금 구조로도 향후 규칙이 하나 더 추가되면 두 군데를 手동으로 동기화해야 하는 drift 위험이 남는다.
  - 제안: 파일 상단에 `const LAYERING_RULE_IDS = ["no-restricted-imports", "no-restricted-syntax"] as const;` 를 두고 두 필터에서 `LAYERING_RULE_IDS.includes(m.ruleId)` 형태로 재사용. 급하지 않은 개선.

- **[INFO]** `LOWER_LAYERS` export 가 설정 파일을 사실상 모듈 공개 API 로 만듦
  - 위치: `codebase/frontend/eslint.config.mjs` (신규 `export const LOWER_LAYERS`)
  - 상세: `eslint.config.mjs` 는 원래 ESLint CLI 전용 설정 파일인데, 이제 테스트가 import 하는 실질적 모듈이 됐다. 기존에도 `eslintConfig` default export 를 테스트가 가져다 쓰던 선례가 있어 완전히 새로운 패턴은 아니지만, 설정 파일의 책임 경계(ESLint 설정 vs 테스트가 참조하는 SoT 상수)가 점점 넓어지고 있다. 현재는 주석으로 의도(§Rationale, 회귀 테스트 연결)를 잘 남겨둬 실질적 문제는 없다.
  - 제안: 조치 불필요. 다만 향후 이 파일에서 export 하는 상수가 더 늘어나면 `layering-config.mjs` 같은 별도 상수 모듈로 분리해 "ESLint 설정"과 "레이어 목록 SoT"의 관심사를 나누는 것을 고려.

- **[INFO]** 계층 목록(`"src/lib/**"`, `"src/types/**"`) 리터럴의 의도된 중복
  - 위치: `codebase/frontend/eslint.config.mjs` 의 `LOWER_LAYERS` vs `eslint-layering-guard.test.ts` 의 `EXPECTED_LOWER_LAYERS`
  - 상세: 동일한 문자열 배열이 두 곳에 하드코딩돼 있으나, 테스트 코드 주석이 "config 에서 가져오면 glob 을 지우는 mutation 이 기대값까지 함께 지워 false green 이 된다"는 근거로 의도적으로 분리했음을 명시하고 있다. 이는 일반적인 "중복 코드 지양" 원칙의 예외로 타당한 근거가 있는 케이스다.
  - 제안: 조치 불필요 — 현재 상태 유지 권장.

전반적으로 `eslint.config.mjs` 리팩터(3개의 하드코딩 메시지 → `LAYERS_LABEL`/`RESOLUTION_HINT` 기반 파생)는 이전에 지적됐을 법한 문자열 중복을 정확히 해소했고, `LOWER_LAYERS` 단일 배열로 `files:` 스코프와 메시지 라벨을 동기화해 "src/lib/** 만 언급하는데 실제로는 src/types/** 도 막는" drift 를 원천 차단했다. 신규 "가드 스코프" 테스트 스위트는 목적(내용 검증 vs 경로 매칭 검증)이 명확히 분리돼 있고, 각 케이스마다 "왜 이 케이스가 필요한가"를 주석으로 남겨 향후 유지보수자가 임의로 케이스를 지우기 어렵게 만들었다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, 네이밍(`LOWER_LAYERS`, `LAYERS_LABEL`, `RESOLUTION_HINT`, `errorsAt`, `CONFIG_LOWER_LAYERS`/`EXPECTED_LOWER_LAYERS`)이 목적을 명확히 드러내며 기존 코드베이스 스타일(flat config 배열, `it.each`/`describe.each` 패턴)과 일관된다. 주석/스펙 참조(`spec/conventions/frontend-layering.md`)로 근거를 코드 밖 SoT 로 옮긴 것도 중복 설명 제거에 기여한다. CRITICAL/WARNING 급 이슈는 발견되지 않았다.

## 위험도

LOW
