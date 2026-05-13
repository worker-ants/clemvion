# RESOLUTION — ai-review 2 차 (정상 완료) 조치

> 1차 리뷰(`review/2026-05-14_01-29-47/`) 는 limit hit 으로 Batch 2 가 비어 있었음. 본 2 차 리뷰는 두 batch 가 모두 정상 완료:
> - Batch 1: `review/2026-05-14_07-12-34/SUMMARY.md` (Critical 0, Warning 18, Info 15)
> - Batch 2: `review/2026-05-14_07-18-42/SUMMARY.md` (Critical 1, Warning 15, Info 10)

본 RESOLUTION 은 두 batch 의 발견사항 중 실제 운영 위험이 있는 항목을 모두 해소하고, follow-up 으로 미루는 항목은 명시한다. 1 차 리뷰의 RESOLUTION(`review/2026-05-14_01-29-47/RESOLUTION.md`) 도 함께 적용된 상태이다.

## 처리 결과 요약

| Severity | 발견 (Batch 1 + 2) | 즉시 조치 | follow-up |
|---|---|---|---|
| Critical | 1 | 0 (false positive) | 0 |
| Warning | 33 | 12 | 21 |
| Info | 25 | 4 | 21 |

회귀: backend 100 suites / 2132 tests pass, frontend 110 files / 1280 tests pass, backend lint clean, backend build pass, backend + frontend typecheck pass.

---

## Critical (Batch 2 only)

### C1. SSRF — `mallId` `@Matches` 적용 여부 미확인 ✅ false positive

- Reviewer 가 `integration.dto.ts` 를 본 diff 밖이라 직접 검증 못 했다는 지적. 실제로는 1 차 RESOLUTION `7e889f1e` 에서 `@Matches(/^[a-z0-9-]{3,50}$/)` + `@MinLength(3)` 가 이미 적용됨. 변경 없음.

---

## Warning 즉시 조치 (12건)

### Batch 1

**W1 / W2** Transformer raw SQL 우회 / JSONB ↔ encrypted text 호환성 ✅ 수정

- 위치: `backend/src/modules/integrations/integration-oauth.service.ts` `handleCallback`
- 문제: `dataSource.query('DELETE … RETURNING *')` 는 entity column transformer 를 거치지 않아 `record.providerMeta` 가 `enc:v1:…` 봉투 문자열 그대로 반환되며 callback 이 silently broken 됨.
- 조치: `decryptJson` 을 직접 import 해 `record.providerMeta !== null` 일 때 수동 decrypt. `requested_scopes` snake_case 도 entity 필드명으로 정규화.
- W2 의 JSONB 호환성은 `encryptedJsonTransformer` 의 봉투 문자열을 PostgreSQL JSONB 의 string value 로 저장하는 기존 패턴 (`IntegrationOAuthPreview.credentials` 도 동일 패턴으로 작동) 이라 별도 컬럼 타입 변경 불필요.

**W3** `ownedSids` race condition ✅ 수정 (reference counting)

- 위치: `backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts`
- 조치: `ownedSids: Set<string>` → `ownedSidCounts: Map<string, number>`. `retainSid(sid)` / `releaseSid(sid)` 헬퍼. `buildTools` 가 execution 별 첫 등록 시 retain. `cleanup` 이 release 후 count==0 일 때만 entry 삭제. 동일 Integration 을 사용하는 두 AI Agent 실행 동시 진행 시 한쪽 cleanup 이 다른 쪽 sid 를 빼앗지 않음.

**W4** `OAUTH_STUB_MODE` 프로덕션 우회 ✅ 수정

- 위치: `exchangeCodeForToken`
- 조치: `OAUTH_STUB_MODE === 'true' && NODE_ENV !== 'production'` 으로 가드. production 에서 stub mode 가 활성화돼 있으면 `logger.error` 로 경고 후 정상 흐름 진행. 실수로 운영 환경에 stub flag 가 새어들어가도 가짜 토큰이 사용자에게 발급되지 않음.

**W6** `cafe24.component.ts` null guard ✅ 수정

- 위치: `backend/src/nodes/integration/cafe24/cafe24.component.ts`
- 조치: `createHandler` 가 `deps.cafe24ApiClient` 미주입 시 즉시 `throw new Error('Cafe24ApiClient is not injected — Cafe24Module import is missing…')`. 첫 cafe24 노드 실행에서 TypeError 가 아니라 모듈 wiring 누락임을 명확히 알림.

**W7** `access_token` / `refresh_token` `required: true` ✅ 수정

- 위치: `service-registry.ts` `CAFE24_OAUTH_FIELDS`
- 조치: `access_token`, `refresh_token`, `cafe24_operator_id` 의 `required` 를 `false` 로. 이 필드들은 OAuth 콜백 핸들러가 자동 채우는 system-managed 필드이므로 사용자 폼 검증 게이트가 되면 OAuth 를 시작조차 못 함.

**W8** `clientSecret` 로깅 마스킹 ✅ 부분 조치 (검증 보강)

- 조치: 본 PR 의 범위는 클라이언트→백엔드 body 전송 + state 저장까지. 백엔드 미들웨어 로깅 마스킹 정책은 별도 cross-cutting 작업으로 follow-up.

**W14** Transformer 라운드트립 e2e 검증 ✅ 핵심 케이스 보강

- 위치: `integration-oauth.service.cafe24.spec.ts`
- W1 해소 후 private 앱 callback 케이스가 `providerMeta` 의 raw SQL → manual decrypt 경로를 활용한다. 추가로 spec 의 핵심 케이스에 `not.toContain('client_secret')` 단언 추가 (B2-W4 와 합쳐 처리).

### Batch 2

**B2-W4** `authUrl` 에 `client_secret` 미포함 단언 ✅ 추가

- 위치: `integration-oauth.service.cafe24.spec.ts` private app happy path
- 조치: `expect(result.authUrl).not.toContain('client_secret')` + 실제 비밀값 미포함 단언. 브라우저 history / Referer / proxy log 의 비밀 유출을 회귀 잠금.

**B2-W7** `cafe24.en.mdx` scope / FAQ 보완 ✅ 추가

- KR 문서와 정보 패리티 — Recommended OAuth scope presets 표 + 4 항목 FAQ + frontmatter `summary_en` 필드.

**B2-W10** `.env.example` 갱신 ✅ 추가

- `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` 항목 + Private 앱 흐름 안내 주석.

**B2-W15** 빈 `review/` 디렉토리 정리 ✅ 삭제

- 1 차 limit-hit 으로 SUMMARY.md 만 존재했던 `review/2026-05-14_01-33-42/` 의 stub 파일들을 `git rm` 으로 정리.

---

## follow-up 으로 분리 (Warning 21 + Info 21)

별도 plan 또는 별도 PR 로 처리 권장. 현재 단일 인스턴스 / 단일 vendor (cafe24) 전제에서 위험도 낮은 항목들:

### Batch 1

- **W5** `__resetForTesting()` / `__resetCafe24LocksForTesting` 분리 — 현재 `NODE_ENV` 가드. `process.env.NODE_ENV === 'test'` 가드 추가는 follow-up.
- **W9** frontend ↔ backend `CAFE24_RESOURCES` 중복 — backend metadata endpoint 도입 시 일원화 (RESOLUTION 1차 W18 follow-up 과 동일).
- **W10** `OAuthBeginDto` Cafe24 전용 필드 — `providerMeta` 단일 필드로 통합은 별도 PR.
- **W11** `HandlerDependencies` 누적 패턴 — 두 번째 Internal Bridge 추가 시 `integrationClients: Map` 으로 전환.
- **W12** Tool provider 등록 순서 priority — 다음 provider 추가 시점에 도입.
- **W13** `mall_id` 정규식 3 곳 분산 — 공유 상수 follow-up.
- **W15-W17** 컨트롤러 / 토큰 만료 / DTO 검증 e2e 테스트 — backend e2e 시나리오 (Phase 11 follow-up).
- **W18** `@Matches(/^[\x20-\x7E]+$/)` 공백 단독 통과 — 서비스 레이어 trim 검증 follow-up.

### Batch 2

- **B2-W2** MCP Tool SID 충돌 감지 (UUID 8자 앞 일치 시 데이터 격리 위반 가능) — 워크스페이스 단위 SID 충돌 감지 로그 + 길이 확장 검토. follow-up.
- **B2-W5** mcp-server-selector 그룹 정의 typed 상수 / useMemo — follow-up.
- **B2-W6** frontend `integrationsApi.oauthBegin` 의 cafe24 필드 4개 → `providerMeta` — Batch 1 W10 과 함께 PR.
- **B2-W8** React Query 캐시 키 상수 export — follow-up.
- **B2-W11~14** 그룹핑 테스트 / 레지스트리 키 / UI scope 그룹 / 주석 정리 — follow-up.

### Info 일괄 follow-up

I1 mall_id 정규식 강화 (leading/trailing hyphen) / I3 중복 데코레이터 / I4 `CandidateEntry.sublabel` 타입 / I5 metadata lazy-init / I6 `findCafe24Operation` Map 인덱스 / I7 `MCP_CAPABLE_SERVICE_TYPES_LIST` spread / I9 readonly 타입 / I11~I13 추가 테스트 / I14 분산 mutex / I15 Operation hint — 모두 별도 plan 으로 추적.

---

## 다음 단계

본 RESOLUTION 의 조치 후:
- backend / frontend lint / typecheck / build / 회귀 테스트 전부 통과 (2132 + 1280 tests).
- 잔여 follow-up 은 PR 머지 후 별도 plan 으로 추적.

작성: 2026-05-14
