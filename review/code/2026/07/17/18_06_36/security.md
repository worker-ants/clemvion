# 보안(Security) 리뷰

대상: uncommitted working diff (`git diff`)
- `codebase/frontend/eslint.config.mjs`
- `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`

## 컨텍스트

이번 변경은 런타임 애플리케이션 코드가 아니라 **빌드타임 ESLint flat config**와 그 config 를
검증하는 **단위 테스트**에 국한된다.

1. `eslint.config.mjs`: `src/lib/**` → `@/components/**` 레이어 역전을 막는 두 `no-restricted-syntax`
   selector(`ImportExpression` 동적 `import()`, CJS `require()`)에서 중복 정의돼 있던 정규식 문자열을
   `COMPONENTS_PATH_RE` 상수(`String.raw`)로 통합해 두 selector 가 공유하도록 리팩터링했다.
2. `eslint-layering-guard.test.ts`: 기존 테스트가 `Array.prototype.find` 로 `files: ["src/lib/**"]`
   블록 **첫 번째**만 추출해, ESLint flat config 의 "나중 블록이 앞 블록을 덮어쓴다" 병합 규칙 하에서
   뒤쪽 override 가 규칙을 약화시켜도 테스트가 그 사실을 못 잡는(fail-open) 갭을 `filter` + `Object.assign`
   병합 재현으로 닫았다. 아울러 bare-path(`"@/components"`, `"../components"`, 서브패스 없음) 위반
   케이스를 `it.each`에 추가했다.

두 파일 모두 개발 도구 설정/테스트이며, 사용자 입력·네트워크 요청·DB 접근·인증/세션·암호화 로직과
접점이 없다. 아래는 점검 관점 8개 항목에 대한 개별 확인 결과다.

## 발견사항

- **[INFO]** 정규식은 컴파일타임 상수이며 외부/사용자 입력에서 유래하지 않음 (정규식 인젝션·ReDoS 해당 없음)
  - 위치: `codebase/frontend/eslint.config.mjs:6` (`COMPONENTS_PATH_RE` 선언), 사용처 `:49`, `:55`
  - 상세: `COMPONENTS_PATH_RE` 는 하드코딩된 리터럴 문자열(`String.raw` 로 이스케이프 보존)이며 env
    변수·파일·네트워크·사용자 입력 어디에서도 파생되지 않는다. 두 곳의 esquery `selector` 문자열에
    템플릿 리터럴로 삽입되지만 삽입 값이 고정 상수이므로 selector 파싱 오염(정규식/셀렉터 인젝션)
    경로가 없다. 패턴 자체(`(\.\.\/)+components(\/.*)?`)도 중첩 quantifier 로 인한 catastrophic
    backtracking(ReDoS) 구조가 아니며, 설령 있었더라도 평가 대상은 lint 시점의 소스 코드 import
    specifier 문자열(개발자가 작성한, 길이가 짧고 신뢰되는 텍스트)이라 공격 표면이 아니다.
    또한 리팩터링 전/후 두 selector 문자열이 문자 단위로 동일함을 직접 대조 확인했다 — 동작 회귀 없음.
  - 제안: 조치 불필요. 참고용 확인 기록.

- **[INFO]** 이 변경은 런타임 보안 통제가 아니라 아키텍처 경계(레이어 역전 방지)를 위한 빌드타임
  가드이며, 테스트 강화는 그 가드의 "fail-open" 회귀를 막는 방향으로만 작용한다
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 전체
  - 상세: `find` → `filter`+병합 전환은 ESLint flat config 의 다중 블록 override 의미론을 정확히
    재현해, 향후 다른 override 블록이 `no-restricted-syntax`/`no-restricted-imports` 를 약화시키는
    회귀(즉 이 레이어 가드가 조용히 무력화되는 시나리오)를 테스트가 실제로 탐지하게 만든다. 이는
    OWASP 카테고리에 직접 대응하지는 않지만 "보안/품질 가드레일의 무결성을 보장하는 테스트"라는
    점에서 방어적 개선(regression-guard hardening)에 해당한다. 새로 추가된 bare-path 케이스
    (`import "@/components";` 등)도 오탐/누락 방지를 위한 커버리지 확장으로 부작용 없음을 확인했다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 의존성·시크릿·네트워크/DB/인증 접점 없음
  - 위치: 두 파일 diff 전체
  - 상세: `package.json`/lockfile 변경 없음 (`git status` 로 확인, 두 파일만 modified). 하드코딩된
    API 키/비밀번호/토큰 없음. 인증/인가/세션 로직 없음. 사용자 입력 처리 경로 없음(정적 분석 도구
    설정). 암호화/해시 로직 없음. 에러 메시지(`throw new Error(...)`)는 config 구조에 대한 진단
    문자열만 포함하고 민감 정보(경로 외 시스템 세부사항, 스택 트레이스 원문 등) 노출 없음.
  - 제안: 조치 불필요.

## 요약

이번 diff 는 `codebase/frontend` 의 ESLint flat config 리팩터링(정규식 중복 제거)과 그 config 를
실제로 로드해 검증하는 단위 테스트의 커버리지 강화(첫 블록만 보던 fail-open 갭을 병합 재현으로
차단, bare-path 케이스 추가)로 구성되며 런타임 애플리케이션 코드·사용자 입력·인증/DB/네트워크
경로를 전혀 건드리지 않는다. 정규식은 고정 상수라 인젝션·ReDoS 공격 표면이 없고, 리팩터링 전후
selector 문자열이 동일함을 직접 대조해 동작 회귀가 없음을 확인했다. 새 코드는 오히려 아키텍처
경계 가드(src/lib → components 레이어 역전 금지)의 조용한 약화를 테스트로 잡아내는 방어적 개선이다.
CRITICAL/WARNING 급 보안 문제는 발견되지 않았다.

## 위험도

NONE
