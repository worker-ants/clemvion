# Code Review 통합 보고서

**대상**: refactor M-6 — 서비스 계층 ConfigService 중앙화 (Option B, fresh ai-review #3)
**생성일**: 2026-06-21

---

## 전체 위험도

**LOW** — Critical 발견 없음. Warning 없음. 모든 reviewer 가 INFO 수준 항목만 보고했으며 3회 ai-review 사이클을 거쳐 Critical/Warning 이 0으로 수렴된 상태임.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

해당 없음.

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/4-integration.md` §5.8 이 `CAFE24_CLIENT_ID`/`SECRET` env 이름을 직접 언급 — ConfigService namespace 미반영 | `spec/2-navigation/4-integration.md` L1373 | 코드 유지. spec 갱신 여부는 project-planner 가 차기 plan 에서 판단 |
| 2 | Documentation | `llm.config.ts` `encryptionKey` 필드 JSDoc 누락 (이전 리뷰 3회 반복 지적) | `codebase/backend/src/common/config/llm.config.ts` L4 | `// AES-256-GCM key for model-config credential encryption (env: ENCRYPTION_KEY)` 인라인 주석 추가 |
| 3 | Documentation | `mcp-client.service.ts` `allowInsecureUrl` getter JSDoc 언어 혼재 — 파일 내 나머지 주석은 영어 (이전 리뷰 2회 반복) | `codebase/backend/src/modules/mcp/mcp-client.service.ts` L249-253 | getter JSDoc 을 영어로 통일 |
| 4 | Documentation | `mcp.config.ts` JSDoc 에 DEFAULT 상수 구체값(`DEFAULT_MAX_CONCURRENT_CONNECTIONS`=20, `DEFAULT_CONNECT_TIMEOUT_MS`=10_000) 미명시 (이전 리뷰 2회 반복) | `codebase/backend/src/common/config/mcp.config.ts` 파일 상단 | JSDoc 에 "DEFAULT 상수 SoT 는 `mcp-client.service.ts` 에 잔류" 및 구체값 추가 |
| 5 | Documentation | `integration-oauth.service.ts` `providerEnvCredentials` 기본 빈값 반환 경로 주석 부재 (이전 리뷰 1회 지적) | `integration-oauth.service.ts` `providerEnvCredentials` 마지막 return 라인 | `// makeshop 등 요청 body 로 자격증명을 받는 provider 는 env namespace 대상이 아님 — 빈값 반환` |
| 6 | Documentation | `oauth.config.ts` `FRONTEND_URL`/`APP_URL` `oauth` namespace 임시 귀속 JSDoc 누락 — `app.config.ts` 와 이중 등록 상태임 (이전 리뷰 2회 반복) | `codebase/backend/src/common/config/oauth.config.ts` `frontendUrl`/`appUrl` 필드 | `OAuthEnvConfig` 인터페이스 해당 필드에 임시 귀속 및 차기 이전 예정 JSDoc 추가 |
| 7 | Documentation | `7-llm-client.md §7.1` 리팩터 배경 설명이 기능 동작 설명과 과도하게 혼재 — 문장 매우 길어짐 (이전 리뷰 1회 지적) | `spec/5-system/7-llm-client.md` L360 | 동작 설명과 리팩터 배경 문장 분리 |
| 8 | Maintainability | `oauthEnv` private getter 가 매 호출 시 `ConfigService.get()` 재조회 — 설계 의도 불명확 (ConfigService 는 캐시하므로 실질 무해) | `integration-oauth.service.ts` `oauthEnv` getter | 생성자 1회 할당 전환 또는 getter 에 "ConfigService.get 이 캐시된 객체를 반환하므로 재호출 비용 없음" JSDoc 명시 |
| 9 | Maintainability | `allowInsecureUrl` getter 가 public 이나 McpToolProvider 의존 계약이 암묵적 — getter 에 의존자 명시 없음 | `mcp-client.service.ts` `allowInsecureUrl` getter | getter JSDoc 에 "`McpToolProvider` 가 단일 source 로 의존함 — public 으로 유지" 명시 |
| 10 | Maintainability | `makeOAuthConfigMock` — shallow spread 로 nested 객체 공유 가능성 (`overrides.cafe24` 경로 방어 복사 누락) | `__test-utils__/oauth-config-mock.ts` L~980 | `cafe24: { ...emptyBase.cafe24, ...overrides.cafe24 }` 패턴으로 deep-merge |
| 11 | Maintainability | `OAuthEnvConfig.stubModeRaw: string` 과 `llm.stubMode: boolean` 간 네이밍 불일치 — 향후 혼동 가능 | `oauth.config.ts` `stubModeRaw` 필드 | 필드에 "파싱 판정은 `isOAuthStubModeAllowed()` 단일 source" JSDoc 명시 |
| 12 | Maintainability | `interaction.config.ts` 단일 필드 namespace — 별도 `InteractionConfig` interface export 없어 소비자 타입 참조 우회 필요 | `codebase/backend/src/common/config/interaction.config.ts` | `InteractionConfig` 인터페이스 export 추가 또는 단일 필드라 인라인 유지 결정을 주석에 명시 |
| 13 | Testing | `parseOptionalNumber` 경계값(`'0'`, `'-1'`, 소수, `'Infinity'`) 계약이 테스트로 고정되지 않음 | `mcp.config.spec.ts` | `'0'` → (소비자 `||` 폴백으로) DEFAULT 동작 명시 또는 경계값 케이스 테스트 추가 |
| 14 | Testing | `interaction-token.service.spec.ts` — 두 secret 모두 미설정 시 fail-closed(throw) 케이스 누락 (spec §8.3 핵심 계약) | `interaction-token.service.spec.ts` M-6 fallback describe | `interaction.jwtSecret=undefined`, `jwt.secret=undefined` mock 으로 생성자 throw 단언 테스트 1건 추가 |
| 15 | Testing | `config-env-coverage.spec.ts` `new RegExp(name, ...)` — 현재 무해하나 이스케이프 미적용 | `config-env-coverage.spec.ts` L69 | `name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` 이스케이프 후 사용 |
| 16 | Testing | `oauth.config.spec.ts` 가 `oauthConfig()` 자체의 env → 필드 매핑을 테스트하지 않음 (`mcp.config.spec.ts` 와 불균일) | `oauth.config.spec.ts` | env-flip 테스트 추가 낮은 우선순위 — 기능 계약은 통합 테스트가 커버 |
| 17 | Side Effect | `FRONTEND_URL`/`APP_URL` 이 `oauth` namespace 와 `app.config.ts` 양쪽에 이중 등록 — 단일 SoT 위배 | `oauth.config.ts` L75-76 | 차기 리팩터에서 `app` namespace 단일화. 현재 부작용 없음 |
| 18 | Requirement | `integrations.service.ts` `cafe24PublicAvailable` 이 `process.env.CAFE24_CLIENT_ID/SECRET` 직접 접근 잔존 — M-6 범위 밖 의도적 미이전 | `integrations.service.ts` L1270-1271 | 현 상태 유지. 후속 리팩터에서 `oauth.config` namespace 경유로 통일 |
| 19 | Scope | `mcp-client.service.ts` `SessionImpl` 메서드 5곳 타입 캐스트 제거 — M-6 직접 목표와 무관한 타입 정밀도 개선 | `mcp-client.service.ts` diff | 범위 외지만 퇴행 위험 없고 코드 개선 방향이므로 INFO 수준. 향후 유사 변경은 별도 cleanup PR 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | N/A (output_file 미존재) | 결과 파일 없음 — 재시도 필요 |
| requirement | NONE | 핵심 기능 요구사항 전부 완전 구현. SPEC-DRIFT 1건(spec 갱신 필요 여부는 project-planner 판단) |
| scope | NONE | 26개 파일 전체 M-6 범위 내. 타입 캐스트 제거 8건 INFO 수준 |
| side_effect | LOW | 생성자 시그니처 변경 전수 검증 완료. OAUTH_STUB_MODE save/restore 추가. FRONTEND_URL 이중 등록 잔존 |
| maintainability | LOW | JSDoc 주석 개선 기회 7건 (모두 INFO). Critical/Warning 없음 |
| testing | NONE | 3회 ai-review 사이클 후 Critical/Warning 0 수렴. fail-closed 케이스 및 경계값 테스트 미흡 INFO 2건 |
| documentation | NONE | 전반적으로 우수. 이전 리뷰 반복 지적 INFO 항목 6건 미반영 |

---

## 발견 없는 에이전트

모든 실행 에이전트(requirement, scope, side_effect, maintainability, testing, documentation)에서 발견사항이 존재하나 전원 INFO 수준이며 Critical/Warning 은 없음.

---

## 권장 조치사항

1. **security reviewer 재확인** — `security.md` output_file 미존재. 보안 관점 검토가 공백 상태이므로 security reviewer 재실행 또는 수동 보안 검토 권장.
2. **[SPEC-DRIFT] spec 갱신 검토** — `spec/2-navigation/4-integration.md` §5.8 의 `CAFE24_CLIENT_ID`/`SECRET` 직접 env 이름 언급을 ConfigService namespace 경유 표현으로 갱신할지 project-planner 판단 필요.
3. **fail-closed 테스트 추가** — `interaction-token.service.spec.ts` 에 두 secret 모두 미설정 시 throw 케이스 1건 추가. spec §8.3 "production fail-closed" 핵심 계약 보강.
4. **`makeOAuthConfigMock` deep-merge** — `overrides` 의 nested 객체 shallow spread 가 mutation side-effect 유발 가능. `cafe24: { ...emptyBase.cafe24, ...overrides.cafe24 }` 패턴 적용.
5. **문서화 일괄 처리 (소규모)** — `llm.config.ts encryptionKey` JSDoc, `allowInsecureUrl` getter JSDoc 영어 통일, `mcp.config.ts` DEFAULT 구체값, `providerEnvCredentials` 기본 반환 주석, `oauth.config.ts` 임시 귀속 JSDoc — 한 커밋으로 일괄 처리 가능.
6. **`oauthEnv` getter 의도 명시** — 생성자 1회 할당 전환 또는 JSDoc 에 "ConfigService.get 이 부팅 시 스냅샷된 캐시를 반환하므로 재호출 비용 없음" 명시.
7. **`FRONTEND_URL`/`APP_URL` 이중 등록 해소** — 차기 리팩터에서 `app` namespace 단일화. 현재 부작용 없으나 단일 SoT 위배.

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행 (router_safety 강제 포함)**: `security`, `documentation`, `maintainability`, `requirement`, `scope`, `side_effect`, `testing` (7명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외**: 아래 표 (7명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |

---

*비고*: `security` reviewer 가 `ran` manifest 에 `success` 로 기재됐으나 `output_file`(`security.md`)이 존재하지 않아 보안 발견사항을 통합할 수 없었음. 전체 위험도 판정에서 보안 관점이 공백 상태임을 유의.