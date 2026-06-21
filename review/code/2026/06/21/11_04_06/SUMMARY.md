# Code Review 통합 보고서 — refactor M-6: 서비스 계층 ConfigService 중앙화

## 전체 위험도
**MEDIUM** — 핵심 fallback 체인 및 stub 모드 제어 경로에 대한 테스트 커버리지 갭이 존재하며, 아키텍처 레이어 일관성 개선 기회가 여러 곳에 있다. 기능 정확성 자체는 양호하며 Critical 이슈는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `interaction.jwtSecret → jwt.secret` fallback 체인 테스트 부재 — 리팩터 핵심 계약이 단위 테스트로 고정되지 않음 | `interaction-token.service.spec.ts` L595~635 | `interaction.jwtSecret`=undefined, `jwt.secret`='fallback-secret' 케이스 추가 후 round-trip verify |
| 2 | Testing | `OAUTH_STUB_MODE` 가 세 개 OAuth spec 파일에서 여전히 `process.env` 직접 조작 — 격리 불완전 | `integration-oauth.service.spec.ts`, `cafe24.spec.ts`, `makeshop.spec.ts` 다수 라인 | `oauthMock.env.stubModeRaw` 경유 제어로 전환; 장기적으로 `isOAuthStubModeAllowed` 헬퍼에 ConfigService 주입 |
| 3 | Testing | `mcp.maxConcurrentConnections`·`mcp.connectTimeoutMs` ConfigService 경유 주입 경로 테스트 없음 | `mcp-client.service.spec.ts` | `mockConfigService.get('mcp.maxConcurrentConnections')='5'` 반환 케이스 추가, `pLimit` 초기화 확인 |
| 4 | Architecture | `IntegrationOAuthService.configService` — `@Optional()` + 인라인 기본값 폴백으로 `oauth.config.ts` 와 기본값이 이중 정의 | `integration-oauth.service.ts` L406–413, `oauthEnv` getter | 운영 코드에서 `@Optional()` 제거; `EMPTY_OAUTH_ENV_CONFIG` 상수를 `oauth.config.ts` 에 단일 SoT 선언 |
| 5 | Architecture | `mcp.config.ts` — raw string 타입 노출, 파싱 책임을 소비자(`McpClientService`)에 위임하여 `oauth`/`interaction` config 와 응집도 불일치 | `mcp.config.ts` 전체 | config 레이어에서 `number`/`boolean` 변환 완료 후 노출; 즉각 수정 어렵다면 주석에 "소비자 파싱 책임" 명문화(이미 부분 적용됨) |
| 6 | Architecture | `@Optional()` DI 전략 불일치 — `IntegrationOAuthService`·`McpClientService`는 Optional, `LlmService`는 필수 — 팀 규약 미명문화 | `llm.service.ts` L922; `integration-oauth.service.ts`; `mcp-client.service.ts` | "프로덕션 서비스는 필수, 레거시 테스트 호환만 Optional" 를 주석·CONTRIBUTING 에 명문화하거나 일관 정책 적용 |
| 7 | Side Effect | `LlmService` 생성자 4번째 파라미터(`configService`) 추가 — 수동 `new LlmService(...)` 호출 사이트 누락 시 오류 | `llm.service.ts` | `grep -r 'new LlmService(' codebase/` 로 미수정 수동 생성 사이트 전수 확인 |
| 8 | Side Effect | `IntegrationOAuthService` 생성자 5번째 파라미터 삽입으로 기존 `installNonceCache` 가 6번째로 이동 — positional 인자 오류 가능성 | `integration-oauth.service.ts` L400 전후 | `grep -r 'new IntegrationOAuthService(' codebase/` 로 미수정 수동 생성 사이트 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec §8.3이 3단계 체인을 기술하나 구현은 ConfigService 2단계로 올바르게 수렴 — spec 설명이 낡음 | `spec/5-system/14-external-interaction-api.md` §8.3 L660 | spec L660 체인 설명을 "interaction.jwtSecret → jwt.secret" 2단계로 갱신 (project-planner 위임) |
| 2 | Requirement | `InteractionTokenService` fail-closed (`!envSecret`) 가 `jwt.config.ts` dev-fallback으로 인해 실제 발화 안 함 — pre-existing, `production-guards.ts`가 보완 | `interaction-token.service.ts` L910–930 | `production-guards.ts` 의존 유지; 개선 필요 시 별도 플랜 |
| 3 | Requirement | `OAUTH_STUB_MODE` — 활성화 경로(`isOAuthStubModeAllowed`)와 경고 로그 경로(`stubModeRaw`)가 다름, 의도적 설계 | `integration-oauth.service.ts` L1127–1136 | 현 설계 유지 |
| 4 | Requirement | `config-env-coverage.spec.ts` 의 `!f.endsWith('.spec.ts')` 조건은 dead code (`.config.ts`가 동시에 `.spec.ts`일 수 없음) | `config-env-coverage.spec.ts` L305 | 두 번째 조건 제거(기능 무관) |
| 5 | Maintainability | `OAuthEnvConfig` 기본값 구조가 `oauthEnv` getter, `makeOAuthConfigMock`, `oauth.config.ts` 3곳에 중복 | `integration-oauth.service.ts`; `oauth-config-mock.ts` | `EMPTY_OAUTH_ENV_CONFIG` 상수 단일 선언 후 재사용 |
| 6 | Maintainability | `config-env-coverage.spec.ts` `list.includes(file)` O(n) 탐색 — `Set<string>` 으로 교체하면 의도가 명확 | `config-env-coverage.spec.ts` ~L313 | value를 `Set<string>`으로 변경(마이너 가독성 개선) |
| 7 | Maintainability | `mcp-client.service.ts` `parseAllowInsecure` JSDoc이 이전 `isInsecureUrlAllowed` 컨텍스트와 혼재 | `mcp-client.service.ts` ~L3124–3131 | JSDoc을 "파싱 전용 순수 함수" 로 간략화 |
| 8 | Architecture | `oauthEnv` getter 가 호출마다 `ConfigService.get()` 재호출 — 성능 이슈는 낮으나 설계 의도 불명확 | `integration-oauth.service.ts` `oauthEnv` getter | 생성자에서 1회 할당 후 private readonly 필드로 유지 |
| 9 | Architecture | `FRONTEND_URL`/`APP_URL` 을 `oauth` namespace 에 귀속 — 향후 타 모듈에서 `oauth.frontendUrl` 경로 접근 부자연스러움 | `oauth.config.ts` L703–704 | 차기 리팩터에서 `app` namespace 또는 별도 `url` namespace 로 이전 |
| 10 | Side Effect | `interactionConfig.jwtSecret` — 기본값 없이 `undefined` 노출, 향후 소비자 추가 시 전파 위험 | `interaction.config.ts` | 유일 소비자(`InteractionTokenService`)는 `??` 체인으로 처리; 추후 소비자 추가 시 주석 계약 확인 |
| 11 | Side Effect | `oauthConfig`의 `FRONTEND_URL`/`APP_URL` 이 `app.config.ts` 와 namespace 중복 가능성 | `oauth.config.ts` L703–704 | `app.config.ts` 에 동일 env 등록 여부 확인 후 단일 namespace 통일 |
| 12 | Side Effect | `config-env-coverage.spec.ts` 모듈 레벨에서 `readFileSync` 실행 — `.env.example` 부재 시 suite 전체 크래시 | `config-env-coverage.spec.ts` L41–43 | CI에서 `.env.example` 항상 체크아웃 보장; `beforeAll` 이동 시 오류 문맥 개선 |
| 13 | Testing | `makeOAuthConfigMock.get`이 `'oauth'` 키만 처리 — 추후 다른 namespace 접근 시 silent `undefined` | `oauth-config-mock.ts` L35–37 | 예상치 못한 키에 `throw Error` 또는 `jest.fn()` 방어 코드 추가 |
| 14 | Testing | `llm.service.spec.ts` `mockConfigService.get`이 key 무관 단일 값 반환 — 키 추가 시 오염 가능 | `llm.service.spec.ts` L68, L961–976 | `(key) => key === 'llm.stubMode' ? value : undefined` 형식으로 key 명시 |
| 15 | Documentation | `mcp.config.ts` JSDoc에 `MCP_CONNECT_TIMEOUT_MS` 기본값 출처 미명시 | `mcp.config.ts` L6–8 | "DEFAULT 상수(10_000ms) SoT는 `mcp-client.service.ts` 잔류" 명시 |
| 16 | Documentation | `llm.config.ts` `encryptionKey` 필드 JSDoc 없음 — `stubMode` 와 문서화 밀도 불균일 (pre-existing) | `llm.config.ts` `encryptionKey` 필드 | 간략한 인라인 주석 추가 |
| 17 | Documentation | `mcp-client.service.ts` `allowInsecureUrl` getter JSDoc가 한국어, 파일 나머지는 영어 — 언어 혼재 | `mcp-client.service.ts` `allowInsecureUrl` getter | 영어로 통일 또는 프로젝트 언어 규약 명시 |
| 18 | Documentation | `config-env-coverage.spec.ts` sanity 리스트에 `MCP_CONNECT_TIMEOUT_MS` 누락 | `config-env-coverage.spec.ts` L325–336 | sanity 리스트에 `'MCP_CONNECT_TIMEOUT_MS'` 추가 |
| 19 | Documentation | `plan/in-progress/refactor/02-architecture.md` 면제 목록에 `isInsecureUrlAllowed()` 가 "이전 완료"임에도 "면제"로 표기 | `plan/in-progress/refactor/02-architecture.md` L3593–3596 | "이전 완료 (allowInsecureUrl getter로 통합)" 로 정정 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | N/A (output 파일 없음) | router_safety 강제 포함이었으나 output 미생성 — 이번 보고서에 미반영 |
| architecture | LOW | @Optional() 불일치, mcp.config.ts 파싱 책임 분산, FRONTEND_URL namespace 귀속 |
| requirement | NONE | 4개 namespace 전환 완전 구현, 발견사항 전부 INFO |
| scope | NONE | 20개 파일 전체 M-6 목표 범위 내, 불필요 변경 없음 |
| side_effect | LOW | 생성자 시그니처 변경에 따른 잠재적 수동 생성 사이트 미수정 가능성 (이미 주요 파일 반영) |
| maintainability | LOW | 기본값 3중 중복, raw string 노출, @Optional() 패턴 불일치 — 중기 개선 항목 |
| testing | MEDIUM | fallback 체인·OAUTH_STUB_MODE·MCP concurrency/timeout ConfigService 경로 테스트 갭 |
| documentation | NONE | 전반적 문서화 품질 높음, sanity 리스트 누락·plan 문서 불일치 경미 |

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음, 불필요 변경 없음
- **requirement**: 기능 완전성 충족, 발견사항 전부 INFO 수준

## 권장 조치사항

1. **[Testing/W1]** `interaction-token.service.spec.ts` 에 `interaction.jwtSecret=undefined → jwt.secret='fallback-secret'` fallback 체인 round-trip 테스트 추가 — 리팩터 핵심 계약 고정
2. **[Testing/W2]** OAuth spec 3개 파일에서 `OAUTH_STUB_MODE` 제어를 `process.env` 직접 조작에서 `oauthMock.env.stubModeRaw` 경유로 전환 (또는 stub 모드 경로 분기 명시 테스트 추가)
3. **[Testing/W3]** `mcp-client.service.spec.ts` 에 `mcp.maxConcurrentConnections`·`mcp.connectTimeoutMs` ConfigService 주입 경로 케이스 추가
4. **[Side Effect/W4]** `grep -r 'new LlmService(' codebase/` 및 `grep -r 'new IntegrationOAuthService(' codebase/` 실행하여 미수정 수동 생성 사이트 전수 검증
5. **[Architecture/W5]** `@Optional()` vs 필수 DI 전략 결정을 팀 규약으로 명문화하고, `IntegrationOAuthService` `@Optional()` + 기본값 폴백 패턴 장기 제거 계획 수립
6. **[SPEC-DRIFT/INFO]** `spec/5-system/14-external-interaction-api.md` §8.3 L660 의 3단계 체인 설명을 2단계로 갱신 (project-planner 위임)
7. **[Documentation/INFO]** `plan/in-progress/refactor/02-architecture.md` L3593–3596 면제 항목을 "이전 완료" 로 정정
8. **[Maintainability/INFO]** `EMPTY_OAUTH_ENV_CONFIG` 상수를 `oauth.config.ts` 에 단일 선언 후 `oauthEnv` getter 및 `makeOAuthConfigMock` 에서 재사용하여 3중 중복 제거

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`):

- **실행** (8명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`
  - 이 중 전부 router_safety 강제 포함: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외** (6명):

  | 제외된 reviewer | 이유 |
  |-----------------|------|
  | performance | 라우터 선별 제외 |
  | dependency | 라우터 선별 제외 |
  | database | 라우터 선별 제외 |
  | concurrency | 라우터 선별 제외 |
  | api_contract | 라우터 선별 제외 |
  | user_guide_sync | 라우터 선별 제외 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)

> **비고**: `security` reviewer 는 router_safety 강제 포함 대상이었으나 output 파일이 존재하지 않음 (`File does not exist`). 해당 reviewer 결과는 이번 통합 보고서에 반영되지 않았음.