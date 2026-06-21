# RESOLUTION — refactor M-6 (Option B) fresh ai-review #2 후속

원본 SUMMARY: `SUMMARY.md` (위험도 LOW, Critical 0 / Warning 3 / INFO 21).
이전 review(`../11_04_06/`)의 resolution 을 커버하는 fresh review. Warning 3건은 review #1 에서
의도적 면제로 분류했던 항목의 re-flag — 이번에 2건을 근본 제거하고 1건은 deliberate 로 확정.

## 조치 항목

| SUMMARY # | 분류 | 조치 |
|---|---|---|
| W1 (아키텍처 — `@Optional()` DI 불일치) | fix | `LlmService` configService 를 `@Optional()` 로 전환 — IntegrationOAuthService·McpClientService 와 DI 규약 통일. 미주입 시 `llm.stubMode`=undefined→OFF(프로덕션 동작). 규약을 생성자 주석에 명문화 |
| W2 (유지보수성 — `mcp.config` raw string) | fix | `mcp.config.ts` 를 `McpEnvConfig` 인터페이스 + config 레이어 파싱(`number\|undefined`/`boolean`)으로 전환 — oauth/interaction/llm namespace 와 타입 일관성 확보. `'true'`/`'1'`·숫자 파싱 edge 는 신설 `mcp.config.spec.ts` 가 검증. 서비스는 `(값) \|\| DEFAULT` 로 `'0'`→DEFAULT 등 기존 의미 보존 |
| I9 (sanity 리스트 누락) | 오탐 | `config-env-coverage.spec.ts` sanity 리스트에 `MCP_CONNECT_TIMEOUT_MS`·`MCP_ALLOW_INSECURE_URL` 이미 존재(resolution #1 반영분). reviewer stale-read |
| I20 (플랜 면제 잔존) | 오탐 | 플랜의 `isInsecureUrlAllowed()` 는 면제가 아닌 "이전 대상" 컨텍스트에만 존재(resolution #1 반영분). reviewer stale-read |

## 의도적 미조치 (documented — 범위 밖 / 동작보존)

| SUMMARY # | 사유 |
|---|---|
| W3 (테스팅 — `OAUTH_STUB_MODE` process.env 잔존) | 근본 원인은 cross-module 공유 헬퍼 `isOAuthStubModeAllowed()`(`common/utils/`, auth-oauth + integration-oauth 사용, NODE_ENV-gated free 함수)가 call-time 에 `process.env` 를 읽는 것. 이 헬퍼 migration 은 **M-6 "서비스 계층 직접 read" 범위 밖**(auth-oauth.service + 그 spec 들로 확대)이라 deferred — 플랜 면제 목록에 명문화. 격리 sub-concern 은 jest 가 spec 파일 단위로 process 격리하므로 실질 leak 위험은 이론적. 후속 plan 후보 |
| I1·I2·I5 (FRONTEND_URL/APP_URL oauth 귀속·oauthEnv getter 재호출·이중 등록) | 차기 리팩터 항목(별도). getter 재호출은 ConfigService.get 이 메모이즈된 namespace 객체 반환이라 비용 무시 가능 |
| I8·I11~I21 | low-priority nit / 설계 의도 / 문서화 밀도 — 필요 시 후속 |

## TEST 결과

- **lint**: 통과 (0 errors). ※ 이번엔 `eslint --fix` 를 편집 파일에만 한정(전역 금지 — review #1 의 collateral 재발 방지).
- **unit**: 통과 (backend+frontend). frontend `schedules-page.test.tsx` RBAC 왕복 테스트가 1회 flaky fail → 재실행 전체 통과(214 files·4499 tests), 본 backend 변경과 무관 확인.
- **build**: 통과
- **e2e**: 통과 (`make e2e-test` 205 tests). ※ 1차 시도는 Docker VM 디스크 고갈(`initdb: No space left on device`)로 postgres 기동 실패 — `docker builder prune -f`(빌드 캐시 21GB, 재생성 가능·scoped) 후 재시도 통과. 코드 무관 환경 이슈.

## 보류·후속 항목

- W3 의 `isOAuthStubModeAllowed()` ConfigService 이전은 auth-oauth 동반 변경이 필요해 본 PR 범위 밖 — 후속 plan 후보로 기록(별도 plan 신설은 사용자 판단).
