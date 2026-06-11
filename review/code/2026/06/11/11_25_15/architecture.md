# 아키텍처(Architecture) 리뷰 결과

리뷰 범위: prod-fail-closed-guards 브랜치
주요 변경: `codebase/backend/src/common/config/production-guards.ts` (신규) + `spec/5-system/` 5개 spec 파일 + 관련 consistency review 산출물

---

## 발견사항

### [WARNING] warn 정책 경계가 `main.ts` 와 `production-guards.ts` 에 분산 — SRP/모듈 경계 비일관
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/main.ts` 라인 52–65, `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts`
- 상세: `production-guards.ts` 는 "throw 정책 전용" 이라는 단일 책임을 잘 명시했고, warn 정책은 `main.ts` 에 두는 분리 기준도 주석으로 명시돼 있다. 그러나 이 분리는 "정당 용도 유무"라는 정책 판단을 `main.ts` 에 흘려, `main.ts` 가 순수 bootstrap 진입점을 넘어 보안 정책 판단자 역할까지 겸하게 된다. warn 분기(`ALLOW_PRIVATE_HOST_TARGETS`) 규칙이 늘어날수록 `main.ts` 가 보안 정책 코드로 오염된다. 단일 책임 원칙 관점에서 `production-guards.ts` 가 warn 반환값(throw 없이 메시지를 반환하는 형태)으로 warn 대상도 관리하고, `main.ts` 는 결과를 logger.warn 하는 형태가 응집도를 높인다.
- 제안: `assertProductionConfig`가 `{ warnings: string[] }` 형태를 반환하거나 `getProductionWarnings(env)` 분리 함수를 두어 warn 정책도 `production-guards.ts` 안에서 선언적으로 관리하고, `main.ts` 는 결과를 소비만 하도록 역할을 재분리한다.

### [WARNING] `INSECURE_JWT_SECRETS` / `KNOWN_EXAMPLE_ENCRYPTION_KEYS` — 수동 동기화 의무가 런타임 보호에 구멍을 만드는 설계 취약점
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` 라인 32–48, 주석 "동기화 의무"
- 상세: 두 상수 집합은 `.env.example` 의 placeholder 값과 `jwt.config.ts` 의 dev fallback 을 하드코딩한다. 파일 주석이 "동기화 의무"를 명시하나, 이는 구조적으로 강제되지 않는다. 미래 기여자가 `.env.example` placeholder 를 교체하면서 이 Set 에 새 값을 추가하지 않으면 새 예시 키가 production 에 도달해도 가드가 뚫린다. 설계 패턴 관점에서 이는 "Out-of-band 동기화 의존" 안티패턴이다. `.env.example` 의 값을 단일 진실(SoT)로 하여 런타임에 파싱하거나, 최소한 `production-guards.spec.ts` 가 실제 `.env.example` 파일을 읽어 Set 과 교차 검증하는 테스트를 추가해야 한다.
- 제안: `production-guards.spec.ts` 에 `.env.example` 파일을 파싱해 `ENCRYPTION_KEY`·`JWT_SECRET` 의 실제 placeholder 값이 각 Set 에 포함돼 있는지 검증하는 테스트 케이스를 추가한다. 이렇게 하면 `.env.example` 을 바꿀 때 테스트가 실패해 동기화를 강제할 수 있다.

### [INFO] `production-guards.ts` 가 barrel export (`common/config/index.ts`) 에 미포함 — 의도적 비노출이지만 추후 재사용 비용 발생
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts`, consistency review `naming_collision.md`
- 상세: `isFlagOn` 유틸리티는 현재 `main.ts` 외에도 warn 분기에서 사용 중이다. `production-guards.ts` 가 barrel 에 노출되지 않으면 다른 모듈이 이 함수를 재사용하려 할 때 깊은 상대 경로 import 가 필요해진다. 의도적 비포함(main.ts 전용)이라면 파일 상단에 명시가 필요하고, `isFlagOn` 이 실제로 범용 유틸이라면 barrel 노출이 합리적이다.
- 제안: `production-guards.ts` 파일 헤더에 "이 모듈은 `main.ts` 가 직접 import 하는 boot-time 전용 모듈로 barrel(`index.ts`)에 포함하지 않는다" 를 명시하거나, `isFlagOn` 을 `common/utils/env.ts` 같은 유틸 파일로 분리해 barrel 을 통해 노출한다.

### [INFO] `assertProductionConfig` 함수 시그니처 — 의존성 역전(DI) 적용이 절반만 된 상태
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` 라인 67–70
- 상세: 함수가 `env: NodeJS.ProcessEnv = process.env` 를 파라미터로 받아 테스트 주입을 허용하는 것은 좋은 설계다. 그러나 `main.ts` 호출부가 `assertProductionConfig(process.env)` 를 명시적으로 넘기는 방식이므로 default parameter 의 의미가 "테스트 전용 오버라이드"임에도 프로덕션 호출 코드에서는 중복 인자를 전달하고 있다. 이는 모호성은 없으나, `process.env` 를 하드코딩하는 default 가 `process.env` 를 직접 읽는 것과 다를 게 없어 DI 의 이점이 실제 프로덕션 경로에서는 표현되지 않는다.
- 제안: 특별 조치 불필요. 설계 방향은 올바르다. 단, 향후 테스트 가독성을 위해 `main.ts` 호출부를 `assertProductionConfig()` (default 사용)로 단순화하고, 테스트에서만 `assertProductionConfig({ NODE_ENV: 'production', ... })` 형태를 명시하는 컨벤션을 문서화하면 의도가 더 명확해진다.

### [INFO] `assertProductionConfig` 관할 목록 — spec 세 파일(`1-auth.md`, `7-llm-client.md`, `11-mcp-client.md`)에 중복 열거, SoT 미단일화
- 위치: `spec/5-system/1-auth.md` §Rationale, `spec/5-system/7-llm-client.md` §7.1, `spec/5-system/11-mcp-client.md` §3.2 (consistency review `convention_compliance.md`, `naming_collision.md` 에서도 동일 지적)
- 상세: 아키텍처 문서 관점에서 단일 진실(SoT) 원칙 위반이다. 가드 대상 항목 목록(`JWT_SECRET`, `ENCRYPTION_KEY`, `MCP_ALLOW_INSECURE_URL`, `OAUTH_STUB`, `LLM_STUB`)이 여러 spec 에 복수로 기재된 상태에서, 신규 가드가 추가될 때 일부만 갱신되면 spec 간 불일치가 생긴다. 소프트웨어 아키텍처의 "관심사 집중(Cohesion)" 원칙에서 이 목록의 단일 SoT 가 필요하다.
- 제안: 전용 SoT 문서(`spec/5-system/production-guards.md` 또는 `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"`)를 한 곳으로 확정하고, 나머지 파일은 해당 섹션 링크만 유지한다. 구현 측에서도 `production-guards.ts` 파일 헤더가 SoT 역할을 하므로 spec 의 단일 진실 파일과 코드 파일을 양방향 참조하는 구조가 이상적이다.

### [INFO] `INTERACTION_JWT_SECRET` fail-closed 의 아키텍처 예외 — `InteractionTokenService` 생성자 throw 가 부팅 타이밍 보장을 약화
- 위치: `spec/5-system/14-external-interaction-api.md` §8.3, `codebase/backend/src/common/config/production-guards.ts` 주석 "의도적 비통합"
- 상세: `assertProductionConfig` 는 `main.ts` bootstrap 최초 단계에서 호출되어 NestJS DI 컨테이너 초기화 전에 실패를 보장한다. 반면 `INTERACTION_JWT_SECRET` 의 fail-closed 는 `InteractionTokenService` 생성자에 있어 NestJS DI 컨테이너 초기화 중에 throw 된다. "부팅 거부"라는 의도는 같으나 타이밍이 다르다 — 생성자 throw 는 더 늦게 실행되고, NestJS 에서 lazy load 를 사용하거나 해당 모듈을 require 하지 않는 테스트 환경에서는 실행되지 않을 수 있다. spec 과 코드 주석이 이 의도적 분리를 잘 설명하고 있으나, 동일 보안 목적의 패턴이 두 가지 타이밍에 존재한다는 아키텍처 비일관성이 잠재한다.
- 제안: 현 상태는 DI 생성자 컨텍스트 필요라는 이유로 의도적 분리임을 주석이 명시하고 있어 허용 가능하다. 추가로 `production-guards.spec.ts` 또는 별도 통합 테스트에서 `INTERACTION_JWT_SECRET` 미설정 시 서버가 실제로 부팅 거부하는지를 검증하는 테스트를 두면 아키텍처 의도를 보호할 수 있다.

---

## 요약

`production-guards.ts` 신규 도입은 분산된 부팅 가드를 단일 함수로 응집하는 SRP 준수·테스트 용이성 개선이라는 측면에서 아키텍처적으로 올바른 방향이다. 순수 함수(`assertProductionConfig(env)`) 설계, 명확한 경계 주석, spec SoT 명문화까지 일관성 있게 수행됐다. 다만 warn 정책이 `main.ts` 에 분산돼 `production-guards.ts` 의 "throw 전용" 경계가 `main.ts` 에 보안 정책 코드를 흘리는 불완전한 분리를 낳고 있다. 더 중요하게는 `INSECURE_JWT_SECRETS` / `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 의 수동 동기화 의무가 구조적으로 강제되지 않아, `.env.example` placeholder 변경 시 가드가 우회되는 설계 구멍이 존재한다 — 테스트로 이를 봉쇄하지 않으면 보안 회귀가 무증거로 일어날 수 있다. `assertProductionConfig` 관할 목록의 spec SoT 미단일화도 장기 유지보수 비용을 높인다.

---

## 위험도

MEDIUM
