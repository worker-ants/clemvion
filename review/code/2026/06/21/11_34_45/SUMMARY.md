# Code Review 통합 보고서

## 전체 위험도
**LOW** — refactor M-6(서비스 계층 `process.env` → `ConfigService` 중앙화)은 방향성·구현 품질 모두 양호하다. Critical 발견 없음. WARNING 3건은 DI 전략 불일치·타입 일관성·테스트 격리로, 기능 회귀 위험은 낮고 중기 기술 부채 성격이다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 아키텍처 / 유지보수성 | `@Optional()` DI 전략 불일치 — `IntegrationOAuthService`·`McpClientService`는 선택적 주입+폴백, `LlmService`는 필수 주입. 동일 PR 내 혼재로 후속 개발자가 어느 패턴을 따라야 할지 알기 어렵다 | `integration-oauth.service.ts` L406, `mcp-client.service.ts` 생성자, `llm.service.ts` 생성자 | "프로덕션 NestJS DI 경로는 필수; `@Optional()`은 레거시 수동 생성 테스트 호환 목적으로만 한시 허용" 규약을 주석 또는 CONTRIBUTING 에 명문화. 장기적으로 `@Optional()` 제거 + 테스트를 `Test.createTestingModule` 경유로 전환 |
| W2 | 유지보수성 | `mcp.config.ts` raw string 노출 — `maxConcurrentConnections`·`connectTimeoutMs`·`allowInsecureUrl` 세 필드가 `string \| undefined`로 노출. `oauth`·`interaction`·`llm` config는 변환 완료인데 패턴 불일치. 소비자가 늘어날수록 파싱 규칙이 분산 복제될 위험 | `codebase/backend/src/common/config/mcp.config.ts` 전체 | config 레이어에서 `number`/`boolean` 변환 완료 후 노출. 즉각 수정 어렵다면 반환 타입을 명시 인터페이스화하고 JSDoc에 "소비자 파싱 책임" 계약 명문화 |
| W3 | 테스팅 | `OAUTH_STUB_MODE` `process.env` 직접 조작 잔존 — `isOAuthStubModeAllowed()` 헬퍼가 call-time에 `process.env`를 직접 읽어 config mock 경유 제어 불가. `afterEach` delete 패턴이 있으나 `beforeEach` 이전 초기값 보존 없어 병렬 실행 환경에서 격리 취약. 의도적 미조치(RESOLUTION W2)이나 위험이 존재함 | `integration-oauth.service.spec.ts`, `cafe24.spec.ts`, `makeshop.spec.ts` 다수 라인 | 후속 플랜에서 `isOAuthStubModeAllowed()` 헬퍼가 ConfigService 주입을 받도록 변경. 단기적으로 `beforeEach` 이전 초기값 보존(`const prev = process.env.OAUTH_STUB_MODE; afterEach(() => { if (prev === undefined) delete …; else process.env.OAUTH_STUB_MODE = prev; })`) 추가 검토 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 아키텍처 | `oauth.config.ts`에 `FRONTEND_URL`/`APP_URL` 귀속 — 전역 URL이 OAuth namespace에 종속되어 향후 타 도메인(알림·웹훅)이 `oauth.frontendUrl`을 참조하게 됨 | `oauth.config.ts` frontendUrl/appUrl 필드, `app.config.ts` getAppBaseUrl | 차기 리팩터에서 `app` namespace로 통합. 당장은 JSDoc에 "임시 귀속 — 차기 리팩터 이전 예정" 명시 |
| I2 | 아키텍처 | `oauthEnv` private getter가 매 호출마다 `ConfigService.get()` 재호출 — 설계 의도(lazy vs eager, mutable vs immutable)가 코드만으로 불명확 | `integration-oauth.service.ts` oauthEnv getter | 생성자에서 1회 `this._oauthEnv = configService?.get<OAuthEnvConfig>('oauth') ?? emptyOAuthEnvConfig()`로 할당. 단, `oauthMock.env` 직접 mutation 테스트 전략과의 충돌 여부 확인 필요 |
| I3 | 아키텍처 | `isInsecureUrlAllowed()` free 함수 제거 → `McpClientService.allowInsecureUrl` 단일 소스 통합 — 단일 책임 원칙 적절히 적용됨 | `mcp-client.service.ts`, `mcp-tool-provider.ts` | 현재 구현 유지 |
| I4 | 요구사항 | `OAUTH_STUB_MODE` process.env 직접 조작 — `isOAuthStubModeAllowed()` 면제 목록 명문화 완료. 기능적 회귀 없음 | 세 spec 파일 | 현 상태 유지. 후속 ConfigService 이전 시 정리 |
| I5 | 요구사항 | `FRONTEND_URL`/`APP_URL` oauth·app namespace 이중 등록 — 기능적으로 문제없으나 단일 SoT 아님. RESOLUTION INFO #11에 이미 식별 | `oauth.config.ts` L717-719, `app.config.ts` L57-58 | 차기 리팩터에서 `app.*`로 통일 |
| I6 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/14-external-interaction-api.md` §8.3 — 이미 갱신 완료(2단계 체인으로 수정). 해소 확인 | `spec/5-system/14-external-interaction-api.md` L660 | 추가 조치 불필요 |
| I7 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/7-llm-client.md` §7.1 — `ConfigService llm.stubMode` 표현으로 갱신 완료. 해소 확인 | `spec/5-system/7-llm-client.md` L360 | 추가 조치 불필요 |
| I8 | 요구사항 | `interaction.config.ts` jwtSecret 기본값 없이 undefined 노출 — JSDoc에 "기본값 금지 이유(fallback 체인 보호)" 명문화됨. 의도적 설계 | `interaction.config.ts` | 현 설계 유지. 추가 소비자 신설 시 JSDoc 계약 확인 의무 |
| I9 | 요구사항 | `config-env-coverage.spec.ts` sanity 리스트에 `MCP_CONNECT_TIMEOUT_MS`·`MCP_ALLOW_INSECURE_URL` 누락 — RESOLUTION INFO #18 기록됐으나 파일 미반영 | `config-env-coverage.spec.ts` L329 | sanity 리스트에 `'MCP_CONNECT_TIMEOUT_MS'`, `'MCP_ALLOW_INSECURE_URL'` 추가 |
| I10 | 범위 | `integration-oauth.service.ts` scope 타입 캐스트 제거(2곳)·`decryptJson` 캐스트 제거 — M-6 직접 목표와 무관하나 동일 파일 내 타입 정밀도 개선으로 기능 영향 없음 | `integration-oauth.service.ts` L1648, L303 | 허용 가능 수준 |
| I11 | 부작용 | `mcp-test-connection.service.ts` `MCP_LIST_TIMEOUT_MS` 모듈 로드 const 잔존 — 플랜 면제 목록과 일치하는 의도적 미이전 | `mcp-test-connection.service.ts:55` | 변경 불필요 |
| I12 | 유지보수성 | `makeOAuthConfigMock` shallow spread — nested 객체 부분 override 시 다른 필드 유실 가능. 현재 호출 사이트는 모든 필드 명시로 안전하나 향후 함정 | `oauth-config-mock.ts` L27 | JSDoc에 "nested 객체 override는 전체 교체" 명시 |
| I13 | 유지보수성 | `llm.service.spec.ts` mockConfigService.get key 비특정 반환 — key 무관 `true` 반환으로 향후 키 추가 시 오탐 숨김 위험 | `llm.service.spec.ts` L68, L961~976 | `(key: string) => key === 'llm.stubMode' ? value : undefined` 형식으로 key 명시 |
| I14 | 유지보수성 | `makeOAuthConfigMock` get — `oauth` 외 키 접근 시 조용히 undefined 반환. 향후 `IntegrationOAuthService`가 타 namespace 읽을 때 silent 오탐 위험 | `oauth-config-mock.ts` L230-232 | 예상치 못한 키 접근 시 `throw new Error(...)` 또는 `jest.fn()`으로 명시적 실패 |
| I15 | 유지보수성 | `config-env-coverage.spec.ts` 모듈 레벨 `readFileSync` — `.env.example` 부재 시 suite 전체가 모듈 로드 오류로 크래시 | `config-env-coverage.spec.ts` L41-43 / L319 | `beforeAll`로 이동해 오류 컨텍스트 개선 |
| I16 | 문서화 | `parseAllowInsecure` JSDoc에 구 `isInsecureUrlAllowed()` 컨텍스트 혼재 — 함수 자체 역할이 묻힘 | `mcp-client.service.ts` 16-27행 | JSDoc을 "Raw `MCP_ALLOW_INSECURE_URL` env string을 boolean으로 파싱. `'true'`/`'1'`만 ON." 수준으로 간략화 |
| I17 | 문서화 | `allowInsecureUrl` getter JSDoc 한국어 — 파일 나머지 주석이 영어 | `mcp-client.service.ts` allowInsecureUrl getter | 영어로 통일 |
| I18 | 문서화 | `mcp.config.ts` JSDoc에 기본값 수치 미명시 | `mcp.config.ts` 11-13행 | JSDoc에 구체적 수치(`maxConcurrentConnections: 10, connectTimeoutMs: 10_000ms`) 병기 |
| I19 | 문서화 | `llm.config.ts` `encryptionKey` 필드 JSDoc 부재 — `stubMode`와 문서화 밀도 불균일 | `llm.config.ts` 4행 | 인라인 JSDoc 추가 |
| I20 | 문서화 | `plan/in-progress/refactor/02-architecture.md` 면제 목록에 `isInsecureUrlAllowed()` 잔존 — 실제로는 이전 완료·삭제됨 | `plan/in-progress/refactor/02-architecture.md` | "이전 완료 — `McpClientService.allowInsecureUrl` getter로 통합"으로 정정 또는 항목 제거 |
| I21 | 문서화 | `spec/5-system/7-llm-client.md` §7.1 변경 문장이 changelog 역할로 과도하게 길어짐 | `spec/5-system/7-llm-client.md` 357행 | 핵심 동작 설명과 리팩터 배경을 분리 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | LOW | `@Optional()` DI 혼재(W1), `oauth` namespace URL 귀속(I1), `oauthEnv` getter 재호출(I2), `mcp.config.ts` 패턴 불일치(I3) |
| maintainability | LOW | `mcp.config.ts` raw string(W2), `@Optional()` 규약 미명문화(W1 공유), `oauthEnv` getter 설계 의도 불명확(I2 공유), `makeOAuthConfigMock` shallow spread(I12) |
| testing | LOW | `OAUTH_STUB_MODE` process.env 의존 격리 취약(W3), LLM mock key 비특정성(I13), coverage spec 모듈 레벨 readFileSync(I15) |
| side_effect | LOW | 생성자 시그니처 변경 수동 생성 사이트 전수 검증 완료. `FRONTEND_URL`/`APP_URL` 이중 등록(I5), `assertHttpsUrl` 시그니처 변경(내부 함수, 외부 영향 없음) |
| requirement | NONE | 핵심 요구사항 전체 이행 완료. SPEC-DRIFT 2건 해소 확인(I6, I7). 잔여 사항 모두 INFO |
| scope | NONE | 전체 변경이 M-6 목표에 귀속됨. 타입 캐스트 제거 3건(I10)은 허용 가능 부수 정리 |
| documentation | NONE | 전반적 문서화 품질 양호. JSDoc 수치·언어·컨텍스트 소규모 개선 기회(I16~I21) |
| security | N/A (파일 없음) | reviewer output 파일 미생성 — 보안 검토 결과 누락 |

---

## 발견 없는 에이전트

- **requirement**: 요구사항 전체 충족, SPEC-DRIFT 2건 해소 완료
- **scope**: 범위 이탈 없음, 모든 변경이 M-6 플랜에 귀속됨
- **documentation**: Critical/Warning 없음, INFO 수준 일관성 개선만 존재

---

## 권장 조치사항

1. **[W1 — 즉시]** `@Optional()` DI 전략 규약을 주석(또는 팀 문서)에 명문화. "프로덕션 서비스 ConfigService = 필수; `@Optional()`은 레거시 수동 생성 테스트 호환 한시 허용"으로 기준 수립.
2. **[W2 — 단기]** `mcp.config.ts` 반환 타입을 명시 인터페이스로 문서화(즉각 수정 어려우면 JSDoc에 "소비자 파싱 책임" 계약 명시). 파싱 책임을 config 레이어로 올리는 작업은 별도 플랜으로 예약.
3. **[W3 — 단기]** `OAUTH_STUB_MODE` process.env 조작 3개 spec 파일의 beforeEach/afterEach 패턴에 초기값 보존 로직 추가 검토. 헬퍼 ConfigService 이전은 별도 플랜.
4. **[I9 — 즉시]** `config-env-coverage.spec.ts` sanity 리스트에 `'MCP_CONNECT_TIMEOUT_MS'`, `'MCP_ALLOW_INSECURE_URL'` 추가.
5. **[I20 — 즉시]** `plan/in-progress/refactor/02-architecture.md` 면제 목록의 `isInsecureUrlAllowed()` 항목을 "이전 완료" 표현으로 정정.
6. **[I13, I14 — 단기]** LLM mock·OAuth mock의 `get` 함수를 key-specific 구현으로 전환해 미래 키 추가 시 오탐 방지.
7. **[I15 — 단기]** `config-env-coverage.spec.ts` `readFileSync` 호출을 `beforeAll`로 이동.
8. **[I1, I5 — 중기]** `FRONTEND_URL`/`APP_URL`을 `oauth` namespace에서 `app` namespace로 통합 — 별도 리팩터 플랜.
9. **[security reviewer 누락]** `security.md` 파일이 존재하지 않아 보안 관점 검토가 누락됨. 보안 관련 우려가 있으면 security reviewer를 재실행 권장.

---

## 라우터 결정

라우터가 reviewer를 선별 실행함 (`routing_status=done`).

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명)
  - 단, `security` reviewer는 output 파일 미생성으로 결과 누락
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: `performance`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (6명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 (상세 사유 미기록) |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |