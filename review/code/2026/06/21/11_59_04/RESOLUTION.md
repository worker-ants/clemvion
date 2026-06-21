# RESOLUTION — refactor M-6 (Option B) fresh ai-review #3 후속

원본 SUMMARY: `SUMMARY.md` (위험도 LOW, Critical 0 / Warning 3 / INFO 22).
review #2 의 W1·W2(@Optional 통일·mcp.config 타입화) 제거 확인. 이번 3 Warning 은 전부 **테스트
mock 견고성** 항목 — 모두 근본 수정해 0 Warning 수렴 목표.

## 조치 항목

| SUMMARY # | 분류 | 조치 |
|---|---|---|
| W1 (Testing — llm mock key-agnostic) | fix | `llm.service.spec.ts` mock 을 key-specific(`key === 'llm.stubMode' ? llmStubMode : undefined`)으로 전환 + 가변 `llmStubMode` 로 per-test 제어 |
| W2 (Testing — OAUTH_STUB_MODE 초기값 미보존) | fix | 3개 oauth spec(service/cafe24/makeshop) beforeEach 에서 `savedOAuthStub = process.env.OAUTH_STUB_MODE` 저장, afterEach 에서 원복(unconditional delete 제거) |
| W3 (Testing — makeOAuthConfigMock silent undefined) | fix | `oauth-config-mock.ts` get 이 `'oauth'` 외 키 접근 시 `throw` — 미래 소비자 확장 강제(서비스는 현재 `'oauth'` 만 조회 확인) |
| I4 (SPEC-DRIFT — 11-mcp-client.md 미반영) | fix(spec) | §4.3 에 `mcp.*` ConfigService namespace 중앙화(`MCP_MAX_CONCURRENT_CONNECTIONS`/`MCP_CONNECT_TIMEOUT_MS`/`MCP_ALLOW_INSECURE_URL`) + allowInsecureUrl 단일 source 노트 추가 |
| I7 (config-env-coverage 모듈 레벨 I/O) | fix | `readFileSync`/`collectConfigEnvVars` 를 `beforeAll` 로 이동 |
| I13 (McpEnvConfig barrel 미export) | fix | `index.ts` 에 `export type { McpEnvConfig }` 추가 |
| I14 (parseOptionalNumber JSDoc 부재) | fix | 경계 조건(NaN/Infinity/blank→undefined, 음수/소수 보존) JSDoc 추가 |
| I17 (interaction 우선순위 케이스 부재) | fix | `interaction.jwtSecret` 우선 + `??` 단락으로 `jwt.secret` 미조회 단언 테스트 추가 |
| I19 (emptyOAuthEnvConfig factory 테스트 부재) | fix | `oauth.config.spec.ts` 신설 — 빈 기본값 + fresh-객체(mutation 격리) 단언 |

## 의도적 미조치 (documented — 설계 의도 / 범위 밖 / 차기 리팩터)

| SUMMARY # | 사유 |
|---|---|
| I1 (MCP_ALLOW_INSECURE_URL 부팅 스냅샷) | deploy-time 플래그라 boot-snapshot 이 의도. production-guards 가 production 기동을 fail-closed 차단. spec §4.3 에 "재기동 시 반영" 명문화 |
| I2 (INTERACTION_JWT_SECRET 가드 분산) | spec §8.3 "참고" 가 이미 명시한 의도적 비통합(모듈 로컬 컨텍스트 필요). 본 PR 범위 밖 |
| I5 (@Optional DI 규약) | review #2 에서 통일(전부 @Optional) + 생성자 주석 명문화. 추가 조치 불요 |
| I3·I6·I8·I9·I10·I11·I12·I15·I16·I18·I20·I21·I22 | 설계 의도 / pre-existing / cosmetic nit / 차기 리팩터 — 비차단 INFO |

## TEST 결과

- **lint**: 통과 (0 errors; `--fix` 는 변경 파일에만 한정)
- **unit**: 통과 (backend+frontend; 영향 spec 8 suites 250 tests 포함)
- **build**: 통과
- **e2e**: 통과 (`make e2e-test` 205 tests)

## 보류·후속 항목

- W3(OAUTH_STUB_MODE 헬퍼 ConfigService 이전, review #2)·I2(INTERACTION secret 중앙 가드)·I6(FRONTEND_URL app namespace 통일) 는 본 PR 범위 밖 후속 plan 후보(별도 plan 신설은 사용자 판단).
