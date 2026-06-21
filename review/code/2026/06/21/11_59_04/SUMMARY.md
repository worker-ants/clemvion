# Code Review 통합 보고서 — refactor M-6: 서비스 계층 ConfigService 중앙화

## 전체 위험도
**LOW** — Critical 발견 없음. 테스트 mock 견고성 3건(WARNING)이 중기 내구성 위험이며, 보안·기능·범위는 모두 양호.

## Critical 발견사항

_없음._

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Testing | `llm.service.spec.ts` `mockConfigService.get`이 key 무관 단일 값 반환 — 미래 키 추가 시 오탐을 조용히 숨김 | `llm.service.spec.ts` L68, L961, L969, L976 | `(key: string) => key === 'llm.stubMode' ? <value> : undefined` 형식의 key-specific 함수로 교체 |
| W2 | Testing | `OAUTH_STUB_MODE` `process.env` 직접 조작 시 초기값 미보존 — `beforeEach` 실행 전 설정 상태 원복 없음, 워커 내 오염 가능성 | `integration-oauth.service.spec.ts`, `cafe24.spec.ts`, `makeshop.spec.ts` | `beforeEach`에서 `savedOauthStub = process.env.OAUTH_STUB_MODE` 저장, `afterEach`에서 복원. `mcp.config.spec.ts`의 save/restore 패턴 참고 |
| W3 | Testing | `makeOAuthConfigMock.get`이 `'oauth'` 외 키 접근 시 silent `undefined` 반환 — 미래 소비자 확장 시 silent regression | `__test-utils__/oauth-config-mock.ts` L74 | 예상치 못한 키 접근 시 `throw new Error(...)` 또는 `jest.fn()`으로 전환 + 호출 단언 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | Security | `MCP_ALLOW_INSECURE_URL` 부팅 스냅샷 고착 — 런타임 hot-disable 불가. staging에서 의도치 않게 true 고착 가능 | `mcp-client.service.ts` `allowInsecureUrl` getter | JSDoc·`.env.example`에 "재기동 필요" 명시. staging `production-guards` 차단 여부 검토 |
| I2 | Security | `INTERACTION_JWT_SECRET` 미설정 시 ephemeral 키 폴백 — fail-closed 가드가 서비스 생성자에 분산 | `interaction.config.ts`, `InteractionTokenService` 생성자 | `production-guards.ts`에 `INTERACTION_JWT_SECRET` 또는 `JWT_SECRET` 설정 여부 중앙 가드 추가 |
| I3 | Security | `OAuthEnvConfig` 객체 참조 mutation 잠재 위험 — `oauthEnv` private getter이나 반환 중첩 객체 변이 가능 | `integration-oauth.service.ts` `oauthEnv` getter | `Object.freeze()` 또는 생성자에서 1회 읽어 readonly 필드 저장 |
| I4 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/11-mcp-client.md` — ConfigService 중앙화 미반영. `mcp.*` namespace 기술 누락 (`7-llm-client.md`·`14-external-interaction-api.md`는 이미 반영됨) | `spec/5-system/11-mcp-client.md` §2.1, §3 | 코드 유지 + spec 갱신: §2.1·§3에 "ConfigService `mcp.maxConcurrentConnections`/`mcp.connectTimeoutMs`/`mcp.allowInsecureUrl` namespace 중앙화 (refactor M-6)" 추가 (project-planner 위임) |
| I5 | Architecture | `@Optional()` DI 전략 불일치 — `LlmService`·`IntegrationOAuthService`·`McpClientService` 모두 `@Optional()` configService 사용, 프로덕션 핵심 의존성이 선택적 선언 | `llm.service.ts` L930, `integration-oauth.service.ts` L487, `mcp-client.service.ts` L923 | 팀 규약 명문화 후 단계적 `@Optional()` 제거 (현재 이전 RESOLUTION에서 의도적 미조치) |
| I6 | Architecture | `FRONTEND_URL`/`APP_URL`이 `oauth` namespace와 `app` namespace 양쪽 이중 등록 — 단일 SoT 아님 | `oauth.config.ts` L79-80, `app.config.ts` L57-58 | 차기 리팩터에서 `app` namespace 단일화 |
| I7 | Architecture | `config-env-coverage.spec.ts` 모듈 레벨 `readFileSync` 실행 — `.env.example` 부재 시 suite 전체 크래시, 오류 컨텍스트 빈약 | `config-env-coverage.spec.ts` L41-43 | `beforeAll`로 이동 |
| I8 | Maintainability | `oauthEnv` getter 매 호출 시 `ConfigService.get()` 재조회 — 의도 불명확 (테스트 mutation 패턴과 의도적 정합) | `integration-oauth.service.ts` `oauthEnv` private getter | 재조회 이유 주석 명시. 또는 생성자 1회 할당 (단, 테스트 mutation 패턴 충돌 주의) |
| I9 | Maintainability | `allowInsecureUrl` getter public 노출 — 내부 config 상태가 서비스 공개 인터페이스로 유출 | `mcp-client.service.ts` `allowInsecureUrl` getter | JSDoc에 "McpToolProvider용 단일 SoT" 명시. 중장기 `validateAndNormalizeUrl` 캡슐화 고려 |
| I10 | Maintainability | `providerEnvCredentials` 기본값 반환 경로 문서화 미흡 — 빈 문자열 반환 이유 불명확 | `integration-oauth.service.ts` 마지막 `return { clientId: '', clientSecret: '' }` | `// makeshop 등 body 자격증명 provider는 env 대상 아님 — 빈값 반환` 주석 추가 |
| I11 | Maintainability | `mcp-client.service.ts` `allowInsecureUrl` getter JSDoc 한국어 — 파일 나머지는 영어 | `mcp-client.service.ts` L248-254 | getter JSDoc 영어 통일 또는 프로젝트 언어 규약 명문화 |
| I12 | Maintainability | `config-env-coverage.spec.ts` `byVar` Map value에 `Array` + `includes` O(n) 조회 — `Set`으로 교체 가능 | `config-env-coverage.spec.ts` `collectConfigEnvVars` | `Map<string, Set<string>>`으로 교체, `list.includes` → `set.has` |
| I13 | Documentation | `McpEnvConfig` 인터페이스가 config barrel(`index.ts`)에 미export — `OAuthEnvConfig`·`WebAuthnConfig`와 불균일 | `common/config/index.ts` | `export type { McpEnvConfig } from './mcp.config'` 추가 또는 내부 전용 JSDoc 명시 |
| I14 | Documentation | `parseOptionalNumber` 헬퍼 함수에 JSDoc 없음 — `Number.isFinite` 경계 조건 즉각 파악 어려움 | `mcp.config.ts` L25 | `/** raw env string → number; non-finite(NaN, Infinity) or blank → undefined */` 추가 |
| I15 | Documentation | `llm.config.ts` `encryptionKey` 필드 JSDoc 없음 — `stubMode`와 문서화 밀도 불균일 (pre-existing) | `llm.config.ts` L4 | `// AES-256-GCM key for model-config credential encryption` 인라인 주석 추가 |
| I16 | Documentation | `mcp.config.ts` JSDoc에 DEFAULT 상수 구체값 미명시 | `mcp.config.ts` L12-14 | JSDoc에 `DEFAULT_MAX_CONCURRENT_CONNECTIONS`(20)·`DEFAULT_CONNECT_TIMEOUT_MS`(10_000ms) 구체값 추가 |
| I17 | Testing | `interaction-token.service.spec.ts` fallback chain — `interaction.jwtSecret` 우선 케이스 및 둘다 미설정 fail-closed 케이스 부재 | `interaction-token.service.spec.ts` L640-660 | `interaction.jwtSecret` 설정 시 `jwt.secret` 미조회 단언 케이스 추가 |
| I18 | Testing | `mcp.config.spec.ts` `parseOptionalNumber` 음수·소수·`Infinity` 케이스 미테스트 — 음수가 DEFAULT 폴백 없이 통과 | `mcp.config.spec.ts` L630-642 | `'-1'` 케이스 계약 명시 테스트 추가 또는 0 이하 → `undefined` 가드 추가 |
| I19 | Testing | `emptyOAuthEnvConfig` factory 단위 테스트 부재 — fresh 객체 반환 및 필드 검증 없음 | `oauth.config.ts` | `oauth.config.spec.ts` 신설 또는 기존 spec에 두 번 호출 후 객체 동일성(`not.toBe`) + 내용 동일성 단언 추가 |
| I20 | Security | `config-env-coverage.spec.ts` 동적 정규식 생성 — env 이름에 정규식 특수문자 포함 시 이론적 패턴 오작동 (실제 위험 없음) | `config-env-coverage.spec.ts` L417 | `name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` 이스케이프 추가 (코드 견고성) |
| I21 | Security | `LLM_STUB_MODE=true` 부팅 시 경고 로그 없음 — staging에서 stub 모드 기동 미인지 | `llm.config.ts` | 부팅 시 `Logger.warn` 명시적 경고 출력 |
| I22 | Scope | 타입 캐스트 제거 8건 포함 (M-6 직접 목표 외) — 기능 무관, 범위 이탈 허용 수준 | `integration-oauth.service.ts` L303·L1591·L1653, `mcp-client.service.ts` L501-521 | 기록 유지. 추가 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | MCP_ALLOW_INSECURE_URL 부팅 고착, INTERACTION_JWT_SECRET 가드 분산, OAuthEnvConfig mutation 위험 (모두 WARNING 이하) |
| architecture | NONE | @Optional() DI 불일치, FRONTEND_URL 이중 namespace, 정적 readFileSync (모두 INFO, 이전 RESOLUTION 기인지) |
| requirement | NONE | SPEC-DRIFT 1건(11-mcp-client.md 미반영) 외 기능 완전성 결함 없음 |
| scope | NONE | 타입 캐스트 제거 8건 부수 포함, 범위 이탈 허용 수준 |
| side_effect | LOW | FRONTEND_URL 이중 등록, OAUTH_STUB_MODE 초기값 미보존 — 런타임 불일치 없음 |
| maintainability | LOW | getter 재조회 의도 불명확, JSDoc 언어 혼재, Set 대신 Array 다수 (이전 SUMMARY 미해소 항목 잔존) |
| testing | LOW | key-agnostic mock 3건(WARNING) — 현재 기능 안전, 중기 테스트 내구성 위험 |
| documentation | NONE | McpEnvConfig barrel 미export, parseOptionalNumber JSDoc 없음 등 소규모 일관성 항목 |

## 발견 없는 에이전트

없음 (모든 에이전트가 INFO 이상 발견사항 보고).

## 권장 조치사항

1. **[W1] `llm.service.spec.ts` key-specific mock 교체** — `(key) => key === 'llm.stubMode' ? value : undefined` 형식으로 전환해 미래 키 추가 시 오탐 방지.
2. **[W2] `OAUTH_STUB_MODE` 초기값 save/restore 패턴 통일** — 3개 spec 파일 `beforeEach`에서 기존 값 저장, `afterEach`에서 복원. `mcp.config.spec.ts` 패턴 참고.
3. **[W3] `makeOAuthConfigMock.get` 예상 외 키 접근 시 throw 추가** — silent `undefined` 반환을 명시적 에러로 전환.
4. **[I4-SPEC-DRIFT] `spec/5-system/11-mcp-client.md` spec 갱신** — §2.1·§3에 `mcp.*` ConfigService namespace 중앙화 기술 추가 (project-planner 위임).
5. **[I2] `production-guards.ts`에 `INTERACTION_JWT_SECRET`/`JWT_SECRET` 중앙 가드 추가** — fail-closed 지점을 서비스 생성자에서 단일 위치로 통합.
6. **[I13] `McpEnvConfig` barrel export 추가** — `index.ts`에 `export type { McpEnvConfig }` 추가 (소규모).
7. **[I11/I14/I15/I16] JSDoc 보강** — `parseOptionalNumber`, `encryptionKey`, DEFAULT 구체값, `allowInsecureUrl` getter 언어 통일 (일괄 처리 권장).
8. **[I18] `parseOptionalNumber` 음수 케이스 계약 명시** — `-1` 테스트 추가 또는 0 이하 → `undefined` 가드.
9. **[I19] `emptyOAuthEnvConfig` factory 단위 테스트 신설** — fresh 객체 반환 보증.
10. **[I21] `LLM_STUB_MODE=true` 부팅 경고 로그** — staging 인지 개선.

## 라우터 결정

routing_status=done (router 가 선별):

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명, 전원 router_safety 강제 포함)
- **제외**: 6명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 제외 |
  | dependency | router 제외 |
  | database | router 제외 |
  | concurrency | router 제외 |
  | api_contract | router 제외 |
  | user_guide_sync | router 제외 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)