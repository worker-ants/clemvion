# Security Review — src/lib 레이어 가드 동적 import/require 커버 + 회귀 테스트

리뷰 대상:
- `codebase/frontend/eslint.config.mjs`
- `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`

## 발견사항

- **[INFO]** ESLint 커스텀 selector 정규식은 개발-시점(빌드 타임) 입력에만 적용되어 런타임 공격 표면이 아님
  - 위치: `codebase/frontend/eslint.config.mjs:87`, `:94` (`ImportExpression[source.value=/.../]`, `CallExpression[...arguments.0.value=/.../]`)
  - 상세: 두 정규식(`/^(@\/components(\/.*)?|(\.\.\/)+components(\/.*)?)$/`)은 esquery selector 문법 내에서 컴파일 타임에 소스 코드의 import/require 리터럴 specifier 문자열에만 매칭된다. 이 값은 저장소 내 개발자가 작성한 소스 코드이며, 런타임에 외부(사용자) 입력이 주입되는 경로가 아니므로 ReDoS(정규식 서비스 거부) 관점의 공격 표면이 되지 않는다. 패턴 자체도 `(\.\.\/)+` 뒤에 고정 리터럴 `components`가 이어지는 구조라 중첩 quantifier로 인한 catastrophic backtracking 소지도 없다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** 린트 규칙은 "정직한 실수" 방지용 가드이며 악의적 우회에 대한 강제력은 없음
  - 위치: `codebase/frontend/eslint.config.mjs:53-173` 전체
  - 상세: 이번 변경은 `src/lib/**` → `@/components/**` 레이어 역전을 정적/동적 import·require 경로 모두에서 잡아내려는 아키텍처 가드다. 그러나 ESLint 규칙은 `// eslint-disable-next-line`, `eslint-disable` 블록 주석, 혹은 CI에서 lint 단계 자체를 스킵하는 방식으로 우회 가능하다. 이는 보안 취약점이 아니라 이 가드의 설계상 한계(코드 품질/아키텍처 목적이지 보안 경계가 아님)이며, 커밋 메시지에서도 "계산된 동적 경로(import(someVar))는 여전히 정적 분석 불가능 영역"이라고 스스로 명시하고 있어 팀이 이미 이 한계를 인지하고 있다.
  - 제안: 현재 목적(레이어링 가드)에는 충분하며 추가 조치 불필요. 만약 향후 이 규칙이 보안 경계(예: 특정 모듈의 민감 API 접근 차단)로 격상된다면 런타임 강제(예: 모듈 경계 검증, CSP 유사 메커니즘)를 별도로 검토해야 한다.

- **[INFO]** 신규 테스트는 실제 `eslint.config.mjs`의 규칙 객체를 그대로 로드해 fail-open 회귀를 방지
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:15-36`
  - 상세: 테스트가 픽스처를 별도로 복제하지 않고 `eslint.config.mjs`에서 `files: ["src/lib/**"]` 블록을 찾아 `Linter#verify`에 그대로 먹이는 방식은, 향후 규칙이 조용히 약화되거나(오타, 옵션 손실, `eslint-config-next` 업그레이드로 인한 병합 동작 변화) 가드가 무력화되는 상황을 CI가 잡아내도록 설계되어 있다. 이는 보안 취약점이 아니라 오히려 방어적 설계로 긍정적이다. 블록을 찾지 못하면 `throw new Error(...)`로 즉시 실패하는 것도 fail-closed 방향으로 적절하다.
  - 제안: 조치 불필요.

인젝션(SQL/XSS/커맨드/LDAP/경로 탐색), 하드코딩된 시크릿, 인증/인가, 사용자 입력 검증, 암호화, 에러 메시지의 민감정보 노출, 의존성 취약점 관점에서 검토했으나 해당 사항 없음. 두 파일 모두 애플리케이션 런타임 코드가 아니라 (1) 빌드/린트 툴체인 설정과 (2) 그 설정을 검증하는 단위 테스트이며, 사용자 입력을 처리하거나 네트워크/DB/파일시스템 I/O를 수행하는 로직이 없다. 새로 추가된 의존성도 없다(`eslint`, `vitest`는 기존 devDependency 재사용).

## 요약
이번 변경은 프론트엔드 코드베이스의 아키텍처 레이어링(`src/lib/**` → `@/components/**` 역전 금지)을 정적 import뿐 아니라 동적 `import()`/CJS `require()` 우회 경로까지 ESLint로 커버하고, 그 규칙이 조용히 무력화되지 않도록 실제 config 객체를 로드해 검증하는 회귀 테스트를 추가한 순수 개발 도구/테스트 변경이다. 사용자 입력, 인증/인가, 시크릿, 암호화, 외부 I/O 등 전통적 보안 공격 표면과 무관하며, 발견된 사항은 모두 정보성(INFO)으로 조치가 필요한 취약점은 없다.

## 위험도
NONE
