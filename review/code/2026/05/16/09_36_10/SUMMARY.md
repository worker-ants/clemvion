# Cafe24 통합 다관점 코드 리뷰 SUMMARY (2026-05-16)

6 reviewer 병렬 실행. 총 **78 issues**, 그중 **Critical 11건**.

## 종합 위험도: **HIGH**

가장 시급한 두 주제:

1. **운영 자동 갱신을 실제로 무력화하는 결함** — 신규 통합의 `lastRotatedAt` NULL + cutoff 쿼리가 NULL 을 제외하는 SQL 시맨틱이 결합되어, OAuth 콜백 직후 한 번도 사용되지 않은 통합은 background refresh 대상에서 영원히 빠진다. 사용자가 만들고 14일 idle 하면 PR #56 의 idle 보호가 무의미해지고 refresh_token 만료로 재인증 필요.
2. **waitUntilFinished timeout 시 false `auth_failed` 격하 가능** — 워커는 성공했지만 caller 가 timeout 으로 fail → 상위 retry 가 stale 객체로 즉시 재호출 → 401 → markAuthFailed 가 worker 가 방금 갱신한 통합을 잘못 `error(auth_failed)` 로 떨어뜨림.

## 분야별 결과

| 관점 | Total | Critical | 보고서 |
| --- | --- | --- | --- |
| security | 17 | 2 | [security/review.md](security/review.md) |
| concurrency | 9 | 1 | [concurrency/review.md](concurrency/review.md) |
| requirement | 16 | 3 | [requirement/review.md](requirement/review.md) |
| api-contract | 10 | 0 | [api-contract/review.md](api-contract/review.md) |
| database | 8 | 0 (2 High) | [database/review.md](database/review.md) |
| testing | 18 | 5 | [testing/review.md](testing/review.md) |

## Critical 11건 종합 (우선순위순)

### Tier 1 — 즉시 수정 필요 (운영 영향 직접)

#### [DB-1] 신규 통합의 `lastRotatedAt` NULL → background refresh 영원히 제외
- 출처: database HIGH-2 + testing CRITICAL (이중 발견)
- **위치**: `integrations.service.ts:281-291` (`create()`)
- **상세**: `consumePreviewToken` 경유 신규 cafe24 통합 생성 시 `lastRotatedAt` 명시 설정 안 함 → NULL 저장. background refresh 의 `LessThan(cutoff)` 가 NULL 을 FALSE 로 평가해 대상에서 제외. 14일 동안 사용되지 않으면 refresh_token 만료 → 재인증 필요. PR #56 의 idle 보호가 신규 통합에서는 효과 없음.
- **Fix**: `create()` 에서 `lastRotatedAt: new Date()` 설정, OR background refresh 쿼리를 `Or(LessThan(cutoff), IsNull())` 로 확장. 또는 둘 다.

#### [CONC-1] waitUntilFinished timeout 시 false `auth_failed` 격하 race
- 출처: concurrency C-1
- **위치**: `cafe24-api.client.ts:369-403` (`refreshViaQueue`)
- **시나리오**: 워커가 정상 refresh 완료 + DB 갱신 → caller 의 `waitUntilFinished` 가 30s timeout reject → caller 의 in-memory `integration` 객체는 stale → 상위 retry 가 같은 stale 객체로 즉시 재호출 → old token → 401 → `markAuthFailed` → 방금 갱신된 통합이 `error(auth_failed)` 로 격하.
- **Fix**: catch 블록에서 DB 재로드 시 `resolveTokenExpiry(fresh) - now > REFRESH_WINDOW_MS` 면 (worker 가 이미 refresh 완료) caller 객체에 mutate + throw 없이 정상 진행.

#### [SEC-C1] private app `client_secret` 이 OAuth state row 의 `provider_meta` 에 평문 저장 가능성
- 출처: security C-1
- **위치**: `integration-oauth.service.ts:1260-1265` (handleInstall stateRecord 생성)
- **상세**: `handleInstall` 이 OAuth state 생성 시 `providerMeta` 에 `client_secret` 포함. `IntegrationOAuthState.providerMeta` 컬럼에 `encryptedJsonTransformer` 가 적용되었는지 마이그레이션·엔티티 정의 확인 필요. 미적용이면 DB dump · WAL · replication stream 에서 10분 TTL 동안 평문 노출.
- **Fix**: `providerMeta` 컬럼 transformer 확인 후 누락 시 추가, 또는 state row 에 `client_secret` 저장 자체를 폐기 (Integration row 에서 직접 읽기).

#### [SEC-C2] `SECRET_LEAK_PATTERNS` 마스킹 미적용 경로
- 출처: security C-2
- **위치**: `cafe24-api.client.ts:441-455` (refreshAccessToken raw error), `:518` (markAuthFailed `lastError`)
- **상세**: refresh 실패 시 raw error body 가 `sanitizeLastErrorMessage` 없이 500자 로깅 + `Error()` 메시지로 throw → 상위 capture 가 `lastError` 에 저장. Cafe24 가 응답에 `client_secret` 이나 토큰 일부를 echo 하면 운영 DB · 로그에 잔류.
- **Fix**: (a) `SECRET_LEAK_PATTERNS` 에 `\bsecret\b`, `client-secret` 추가. (b) raw error 를 throw 하기 전·로깅 전 sanitize 적용. (c) 패턴을 공유 유틸로 추출.

### Tier 2 — Spec 의도 미구현 (이번 sprint)

#### [REQ-C1] 만료 스캐너가 `pending_install` 을 명시적으로 제외하지 않음
- 출처: requirement CRITICAL-1
- **위치**: `integration-expiry-scanner.service.ts:282-285` (`run()` where 절)
- **상세**: spec §11.1 "대상: tokenExpiresAt IS NOT NULL" 과 §2.4 "pending_install 은 배너에서 제외" 가 명시되어 있으나, 구현은 `status: Not(In(['expired', 'error']))` 만 필터. pending_install 이 명시 제외되지 않아 엣지 케이스에서 잘못된 만료 알림 가능.
- **Fix**: `Not(In(['expired', 'error', 'pending_install']))` 로 확장.

#### [REQ-C2] `connected → error(network)` 3회 연속 실패 전이가 완전 누락
- 출처: requirement CRITICAL-2
- **위치**: 없음 (구현 부재)
- **상세**: spec §6 가 명시한 "노드 실행 중 커넥션 실패 3회 연속 → `error(network)`" 전이가 코드 어디에도 없음. 네트워크 실패는 매번 `Cafe24TransportFailedError` 만 throw 하고 카운터·전이 없음.
- **Fix**: 연속 실패 카운터 (Integration row 새 컬럼 또는 in-memory) 도입 + 3회 시 `markStatus('error', 'network')`. 또는 spec 에서 미구현으로 defer 처리.

#### [REQ-C3] `error(insufficient_scope)` 전이 누락 — 모든 403 이 auth_failed 로 일괄 처리
- 출처: requirement CRITICAL-3
- **위치**: `cafe24-api.client.ts:514-516` (`executeWithRateLimit` 401/403 처리)
- **상세**: spec §6 / §9.4 가 "403 + missing_scope 시그널 → error(insufficient_scope)" 로 정의하나, 구현은 403 을 무조건 `markAuthFailed` (auth_failed). 사용자가 reauthorize 만 시도하다 같은 scope 부족으로 다시 403 받음. UI 안내 문구 분기 불가.
- **Fix**: 403 response body 의 `error.code` / `message` 에서 scope 키워드 감지 후 별도 `markInsufficientScope` 호출.

### Tier 3 — 테스트 회귀 보호 갭

#### [TEST-C1] refreshViaQueue 의 3가지 분기 미검증
- 출처: testing 3 × CRITICAL
- **상세**: (1) `queue.add` 자체가 throw (Redis 장애), (2) `waitUntilFinished` timeout 후 row 가 `connected` 상태, (3) worker 성공 후 `findOne` null 반환. 세 분기 모두 운영에서 발생 가능한데 단위 테스트 없음.
- **Fix**: 각 분기에 대해 mock 시나리오 추가.

#### [TEST-C2] Cafe24TokenRefreshProcessor 의 refresh 실패 propagation 미검증
- 출처: testing CRITICAL
- **상세**: `refreshAccessToken` 이 throw 했을 때 `processor.process()` 가 그대로 re-throw 해서 BullMQ 가 job 을 failed 로 마킹하는 흐름 미검증. `.catch()` 로 삼키지 않음을 코드 리뷰로만 확인해야 함.
- **Fix**: `mockRejectedValue(new Cafe24AuthFailedError(...))` 케이스 추가.

#### [TEST-C3] enqueueCafe24BackgroundRefresh 의 NULL/error 통합 처리 의도 미검증
- 출처: testing 2 × CRITICAL
- **상세**: `lastRotatedAt IS NULL` 통합이 enqueue 대상인지/제외인지 (DB-1 과 직결), `status='error'` 통합이 제외되는지 명시 테스트 부재. 쿼리 조건 변경 시 회귀 감지 불가.
- **Fix**: 양쪽 경우의 명시적 테스트 추가.

## High 주요 발견 (15+ 건 중 핵심)

| ID | 영역 | 한 줄 요약 |
| --- | --- | --- |
| SEC H-1 | security | HMAC 인코딩 — `encodeURIComponent` vs Cafe24 공식 `URLEncoder.encode` (공백 처리 차이로 정상 요청 거부 가능) |
| SEC H-2 | security | `tryRecoverByMallId` — `workspaceId` 필터 없이 mall_id 전체 스캔 → 타 테넌트 Integration ID 로그 누출 + DoS amplification |
| SEC H-3 | security | open redirect — `FRONTEND_URL` 검증 부재. `postMessage` targetOrigin 으로 사용되어 잘못 설정 시 previewToken 외부 도메인 누출 |
| CONC H-1 | concurrency | jobId dedup + `removeOnComplete: { age: 60 }` race — completed job 제거 시점 race 시 `waitUntilFinished` hang 가능성 |
| CONC H-2 | concurrency | source 'background' vs 'proactive' dedup 시 worker 가 먼저 enqueue 된 data 만 보아 status 검증 우회 가능 |
| CONC H-3 | concurrency | handleCallback transaction 의 `findOne` 에 row lock 없음 — 동시 reauthorize 시 lost update |
| REQ HIGH-1 | requirement | `tryRecoverByMallId` 회복 흐름이 spec §9.8 의 "폐기" 와 정면 충돌. spec 에 명시되지 않은 production 흐름 |
| REQ HIGH-2 | requirement | refresh 실패 → spec 은 `expired`, 구현은 `error(auth_failed)`. 용어 혼재. UI 문구·재인증 분기에 영향 |
| REQ HIGH-5 | requirement | `createPrivatePendingIntegration` 중복 체크가 `app_type='private'` 만 필터 — spec 의 "app_type 무관" 위반 |
| API H-1 | api-contract | install 엔드포인트 에러 응답이 `{ error: { code, message } }` envelope 위반 (`{ code, message }` 직접 반환) |
| API H-2 | api-contract | `OAuthBeginResultDto` 가 Cafe24 Private 분기 응답 필드 (`mode`, `appUrl`, `callbackUrl`) Swagger 미문서화 |
| API H-3 | api-contract | OAuth-specific 에러 코드 (`OAUTH_STATE_MISMATCH` 등) Swagger 누락 |
| DB H-1 | database | background refresh 쿼리에 `(service_type, status, last_rotated_at)` 부분 인덱스 부재. 통합 row 증가 시 full scan 위험 |

## Medium / 좋은 사례

각 보고서의 Medium 섹션과 "확인했지만 안전한 항목" 섹션 참조. 안전한 영역들:

- **SQL injection** — 모든 raw SQL 이 parameterized.
- **HMAC timing-safe** — `timingSafeEqual` 올바르게 사용.
- **state / preview 원자 소비** — `DELETE … RETURNING` 으로 race-free.
- **install_token / state / preview entropy** — 모두 128-bit+ 충분.
- **mall_id SSRF 방어** — 정규식 패턴 + 메타데이터 검증 이중.
- **provider allowlist** — `['google', 'github', 'cafe24']` 외 즉시 거부.
- **workspace 격리** — workspaceId 가 server-side state 에서 유래.
- **BullMQ jobId dedup** — refresh rotation race 클러스터 보호.
- **credentials JSONB 암호화** — `encryptedJsonTransformer` 적용.
- **Cafe24Module → IntegrationsModule 의존 방향 보존** — 큐 상수가 modules/ 에 위치.
- **마이그레이션 zero-downtime** — `CREATE INDEX CONCURRENTLY` 적절히 사용.

## Spec 갱신 필요

| ID | 갱신 사항 |
| --- | --- |
| SPEC-1 | `tryRecoverByMallId` 회복 흐름 — spec §9.8 또는 ## Rationale 에 명시 (또는 제거) |
| SPEC-2 | BullMQ `cafe24-background-refresh` 잡 + 10일 임계 — spec §11 / data-flow §1.4 추가 |
| SPEC-3 | PR #56 의 큐 도입 — spec §9.6 의 "Redis 분산 mutex 별도 spec" 미결을 "BullMQ jobId dedup 으로 해소" 로 갱신 |
| SPEC-4 | `CAFE24_INSTALL_MISSING_PARAMS` 에러 코드 — spec §9.4 추가 |

## 권장 후속 작업

본 리뷰 결과를 바탕으로 권장 PR 순서:

1. **Hotfix PR #1**: DB-1 (`lastRotatedAt` 초기화) + CONC-1 (waitUntilFinished timeout 시 worker 성공 감지) — 운영 영향 가장 직접
2. **Hotfix PR #2**: SEC-C1·SEC-C2 (시크릿 마스킹 + state row client_secret 보호) — 보안 즉시
3. **Sprint PR**: REQ-C1·C2·C3 (상태 전이 누락 3건) — spec 완전성
4. **Sprint PR**: TEST-C1·C2·C3 (BullMQ 큐 경로 회귀 테스트) — 회귀 안전망
5. **개선 PR**: Tier 3 의 High + Medium 묶음
6. **별도 task**: project-planner 가 SPEC-1~SPEC-4 spec 갱신

## BLOCK: NO

본 리뷰는 사후 감사이므로 차단 대상 PR 이 없다. PR #56 는 이미 별 branch 에서 review 진행 중.
