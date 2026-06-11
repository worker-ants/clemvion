### 발견사항

- **[INFO]** `jwtConfig`는 `registerAs` 래퍼 함수로 export되어 있어 테스트에서 직접 호출 시 `registerAs` 팩토리가 반환한 함수를 다시 호출하는 이중 호출 구조임
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.spec.ts` 라인 455 (`const cfg = jwtConfig();`)
  - 상세: `jwt.config.ts`의 `jwtConfig`는 `registerAs('jwt', () => ({ secret: ... }))` 패턴이다. `registerAs`가 반환하는 값 자체가 factory 함수이므로 `jwtConfig()`를 직접 호출하면 NestJS DI 컨텍스트 없이 내부 팩토리를 실행하게 된다. 이 패턴은 현재 NestJS `registerAs` 구현에서는 실제로 동작하지만(내부 팩토리를 invoke하도록 설계됨), 향후 NestJS 버전 업그레이드 시 동작이 변경될 수 있다. 현재 코드로는 테스트가 통과하므로 즉각 문제는 없으나, 계약상 불명확한 점이다.
  - 제안: 주석에 "registerAs 래퍼를 직접 invoke하는 것은 NestJS 내부 구현에 의존" 임을 명시하거나, 대신 `process.env.JWT_SECRET` 미설정 시의 fallback 값(`'dev-jwt-secret'`)을 테스트 내 하드코딩 상수로 직접 참조하고 `INSECURE_JWT_SECRETS`에 포함 여부만 검증하는 방식으로 단순화하는 것을 고려

- **[INFO]** `blacklist Set sync` describe 블록 내 `fs.readFileSync` 호출이 describe 최상단 스코프(동기)에서 실행됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.spec.ts` 라인 209-210
  - 상세: `const envExamplePath = path.resolve(...)` 및 `const envExampleContent = fs.readFileSync(...)` 가 `describe` 블록 최상단 동기 코드로 실행된다. 파일이 없으면 테스트 파일 로드 단계에서 즉시 throw되어 이 describe 블록 전체가 아닌 파일 전체가 로드 불가 상태가 된다. Jest에서는 describe-scope 동기 오류는 전체 스위트를 중단시킨다.
  - 제안: `beforeAll(() => { ... })` 블록 내부로 이동하거나, `let envExampleContent: string; beforeAll(() => { envExampleContent = fs.readFileSync(..., 'utf-8'); });` 패턴으로 변경하면 파일 미존재 시 해당 describe 블록만 실패하고 나머지 테스트는 계속 실행 가능

- **[INFO]** `.env.example` 경로 해석이 `__dirname` 기준 상대 경로(`'../../../.env.example'`)에 의존
  - 위치: 라인 209
  - 상세: `path.resolve(__dirname, '../../../.env.example')`은 빌드 결과물(`dist/`) 경로와 소스 경로의 디렉토리 깊이가 다를 경우 실패할 수 있다. Jest 환경(ts-jest/swc)에서는 `__dirname`이 소스 기준으로 해석되므로 현재는 문제없지만, 빌드된 JS 실행 시에는 경로가 달라진다.
  - 제안: 현 Jest 환경에서만 실행되는 spec 파일이므로 실질적 위험은 낮음. 다만 경로 의존성을 주석으로 명시하거나 `path.resolve(process.cwd(), 'codebase/backend/.env.example')` 처럼 repo 루트 기준으로 작성하면 더 명시적

- **[INFO]** `parseEnvExampleValue` 정규식에서 키 값에 특수문자(`.`, `*`, `+` 등)가 포함될 경우 escape 없이 RegExp 생성자에 전달됨
  - 위치: 라인 205 (`new RegExp(`^${key}=(.+)$`, 'm')`)
  - 상세: 현재 `'JWT_SECRET'`, `'ENCRYPTION_KEY'` 등 알파뉴메릭+밑줄 키만 사용하므로 실제 문제는 없으나, 유틸 함수 자체는 임의 키에 대해 unsafe하다. 이 함수가 helper 로서 재사용될 경우 오동작 가능.
  - 제안: 내부 사용 전용이므로 현재 허용 가능. 필요 시 `key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` 로 escape 추가

- **[INFO]** `INTERACTION_JWT_SECRET` 에 대한 블랙리스트 sync 테스트 없음
  - 위치: `blacklist Set sync` describe 블록 전체
  - 상세: `.env.example` 라인 95에 `# INTERACTION_JWT_SECRET=change-me-to-a-long-random-interaction-secret`이 주석으로 존재하며, `InteractionTokenService` 생성자 throw로 별도 fail-closed가 있다. 현재 `INSECURE_JWT_SECRETS` Set이 `INTERACTION_JWT_SECRET` fallback 값을 포함하는지 검증하는 테스트는 없다. `production-guards.ts` 범위 밖이므로 이는 의도적 설계지만, 주석으로 "INTERACTION_JWT_SECRET는 InteractionTokenService에서 별도 보호" 언급이 있으면 더 명확
  - 제안: 현재 scope에서 필수는 아님. 필요 시 별도 `interaction-token.service.spec.ts`에서 커버

### 요약

이번 변경의 테스트 품질은 전반적으로 양호하다. `isFlagOn` 독립 describe 블록(INFO-13)과 blacklist Set sync CI 방어선(W3/INFO-14), ENCRYPTION_KEY 긍정 케이스(INFO-12) 모두 기존 테스트 커버리지의 명확한 갭을 채우는 회귀 방어선이다. `jwtConfig()` 직접 호출 패턴은 NestJS 내부 구현에 암묵적으로 의존하는 부분이 있고, `fs.readFileSync`를 describe 최상단 동기 스코프에서 실행하는 것은 파일 미존재 시 전체 스위트를 중단시킬 수 있는 격리 문제가 있다. 그러나 두 케이스 모두 실제 CI 환경에서는 `.env.example`이 항상 존재하고 `jwtConfig()`가 정상 작동하므로 즉각적 위험은 낮다. 개선이 필요한 경우 `beforeAll` 패턴으로 파일 I/O를 이전하는 것이 가장 낮은 비용으로 견고성을 높이는 방법이다. README 변경(파일 1)은 테스트 관점에서 검토할 사항이 없다.

### 위험도
LOW
