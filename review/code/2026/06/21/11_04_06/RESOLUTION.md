# RESOLUTION — refactor M-6 (Option B) ai-review 후속

원본 SUMMARY: `SUMMARY.md` (위험도 MEDIUM, Critical 0 / Warning 8 / INFO 19).

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|---|---|---|---|
| W1 (Testing) | fix | `interaction.jwtSecret → jwt.secret` fallback 체인 round-trip 테스트 신설 | `interaction-token.service.spec.ts` 하단 `secret fallback chain (refactor M-6)` describe |
| W3 (Testing) | fix | `mcp.maxConcurrentConnections`/`mcp.connectTimeoutMs` ConfigService 주입 경로 테스트 신설 | `mcp-client.service.spec.ts` `config injection (refactor M-6)` describe (생성자가 두 키를 조회함을 단언) |
| W4 (Architecture) | fix | `EMPTY_OAUTH_ENV_CONFIG` 기본값 3중 중복 → `emptyOAuthEnvConfig()` **factory** 단일 SoT | `oauth.config.ts` 신설·barrel export. mutation 격리 위해 frozen 싱글턴이 아닌 factory (서비스 getter·mock 공유) |
| W7 (Side Effect) | verify | `rg 'new LlmService('` 전수 — 수정한 spec 외 생성처 없음 확인 | clean |
| W8 (Side Effect) | verify | `rg 'new IntegrationOAuthService('`·`'new McpClientService('` 전수 — 수정한 spec 외 생성처 없음 | clean |
| INFO-SPEC-DRIFT (§7.1) | fix(spec) | `7-llm-client.md §7.1` `process.env.LLM_STUB_MODE` 리터럴 → ConfigService(`llm.stubMode`) 표현 동기화 | 메커니즘 sync (Rationale 번복 아님) |
| INFO-SPEC-DRIFT (§8.3) | fix(spec) | `14-external-interaction-api.md §8.3` secret 우선순위 3-step env 체인 → ConfigService 2-step(`interaction.jwtSecret → jwt.secret`) 동기화 | 우선순위·의미 불변 |
| INFO #4 | fix | `config-env-coverage.spec.ts` dead 조건(`!f.endsWith('.spec.ts')`) 제거 | |
| INFO #18 | fix | `config-env-coverage.spec.ts` sanity 리스트에 `MCP_CONNECT_TIMEOUT_MS` 추가 | |
| INFO #19 | fix(plan) | 플랜 면제 목록 정정 — `isInsecureUrlAllowed()` 는 면제가 아니라 **이전 완료**(allowInsecureUrl getter 통합) | |

## 의도적 미조치 (documented — 회귀 방지 / 범위 밖)

| SUMMARY # | 사유 |
|---|---|
| W2 (Testing) | OAuth spec 3개의 `process.env.OAUTH_STUB_MODE` set 은 **un-migrated 헬퍼 `isOAuthStubModeAllowed()`**(call-time, NODE_ENV-gated, auth+integration 공유)를 구동한다. 제안된 `oauthMock.env.stubModeRaw` 경유는 동작하지 않음(헬퍼가 config 가 아닌 process.env 를 읽음). 헬퍼 자체 migration 은 M-6 "서비스 계층 직접 read" 범위 밖(cross-module 추상화) — 플랜 면제 목록에 명문화 |
| W5 (Architecture) | `mcp.config.ts` raw string 노출 + 소비자 파싱은 **동작 보존**(`Number(...) || DEFAULT`, `'true'/'1'` 규칙 byte-identical)을 위한 의도적 선택. DEFAULT 상수 단일 SoT 는 `mcp-client.service.ts` 잔류. config JSDoc 에 명문화됨 |
| W6 (Architecture) | `@Optional()` (IntegrationOAuth·Mcp) vs 필수(Llm) DI 불일치 — 전자는 수동 생성 레거시 테스트 호환, 후자는 항상 DI 주입. 현 패턴 유지(별도 규약 명문화는 후속) |
| INFO #2·#3·#5~#17 | low-priority nit (대부분 pre-existing / 설계 의도) — 필요 시 후속 |

## TEST 결과

- **lint**: 통과 (0 errors, 137 warnings=pre-existing `no-unsafe-*`). ※ 중간에 `eslint --fix` 를 src 전역에 잘못 실행해 무관 파일 38개가 `consistent-type-imports` 로 오변경(에러 유발)됐으나 `git checkout HEAD -- <collateral>` 로 전량 revert, M-6 파일만 잔존 확인.
- **unit**: 통과 (backend+frontend wrapper; 영향 spec 7 suites 277 tests 포함)
- **build**: 통과 (backend+frontend)
- **e2e**: 통과 (`make e2e-test` 205 tests — `execution-park-resume`(LLM_STUB_MODE ConfigService 부팅-스냅샷)·external-interaction·OAuth 흐름 포함)

## 보류·후속 항목

- 없음 (W2/W5/W6 은 의도적 미조치로 본 문서에 사유 기록, 별도 plan 불요).
