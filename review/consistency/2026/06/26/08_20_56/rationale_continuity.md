# Rationale 연속성 검토 결과

검토 대상: 03 M-1 — `integration-oauth.service.ts` install 보일러플레이트 4종 helper 추출
검토 기준: `diff-base=origin/main` 변경 사항 vs 기존 spec `## Rationale` 항목

---

## 발견사항

### 발견사항 없음 (CLEAR)

적극적으로 검토한 4개 관점 모두에서 위반 없음.

---

### 검토 상세

#### 1. 기각된 대안의 재도입

**검토 범위**

- `spec/2-navigation/4-integration.md ## Rationale` — "HMAC 검증 알고리즘 — raw URL-encoded 값 보존", "install_token 을 App URL path 식별 키로 승격", "install endpoint rate limiting", "Cafe24 install_token mismatch 회복 흐름" 항 등
- `spec/4-nodes/4-integration/4-cafe24.md ## 9. Rationale` — §9.8 HMAC 검증, nonce cache, rate-limit 항
- `spec/4-nodes/4-integration/5-makeshop.md ## 9. Rationale` — §9.1~§9.7 항
- `spec/conventions/error-codes.md §2` — rename = breaking change 정책

**결과**

diff 의 4개 helper (`assertInstallTimestampFresh`, `assertInstallNonceNotReplayed`, `buildIntegrationDetailRedirectUrl`, `persistReauthorizeState`) 는 **동작을 변경하지 않는 순수 추출** 이며, 기각된 대안을 채택하거나 과거 결정을 번복하지 않는다.

과거 Rationale 에서 명시 기각된 항목 중 관련 있는 것:

| 기각된 대안 | spec Rationale 위치 | diff 의 처리 |
|---|---|---|
| in-memory 100건 스캔 + trial HMAC (옛 `GET /oauth/install/cafe24`) | `spec/2-navigation/4-integration.md` — "install_token 을 App URL path 식별 키로 승격" | 채택하지 않음. `install_token` 단일 row 조회는 유지됨 |
| `buildHmacMessage` / `buildMakeshopHmacMessage` 를 공유 helper 로 추상화 | diff 코드 주석 자체에서 "MUST stay caller-selected, never shared here" 라고 명시. spec Rationale 은 "raw URL-encoded byte 단위 보존이 정확성의 핵심" + makeshop 의 HMAC 메시지 구성이 `VERIFY` 미확정임을 명시 (`spec/4-nodes/4-integration/5-makeshop.md §9.7`) | 두 HMAC 빌더 함수는 추출하지 않고 caller 선택으로 유지 — 기각된 대안 재도입 없음 |
| 에러 코드 prefix 통합 (`CAFE24_*` / `MAKESHOP_*` 를 공통 prefix 로 대체) | `spec/conventions/error-codes.md §2` — "rename 은 breaking change" | `replayErrorCode` / `replayMessage` 를 caller 파라미터로 받아 각 provider 의 prefix 를 유지함 — rename 없음 |
| OAuthState 공통화 (mode 확장 등) | `spec/2-navigation/4-integration.md` — "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유" | `persistReauthorizeState` 는 `mode: 'reauthorize'` 고정 유지 — 합의된 mode 결정과 정합 |

#### 2. 합의된 원칙 위반

**결과: 위반 없음**

검토 항목:

- **HMAC 검증 인라인 감사 원칙**: diff 코드 주석(`// 282-298`)은 HMAC 빌더가 caller-specific 으로 유지돼야 하는 이유(makeshop `VERIFY` 마킹 + 각 provider 의 메시지 구성 미확정)를 명확히 기술하며, 이를 추출 대상에서 제외함. `spec/4-nodes/4-integration/4-cafe24.md §9.8` 의 "raw URL-encoded 값 보존" invariant 는 그대로 유지됨.

- **graceful degradation 원칙 (nonce cache)**: `assertInstallNonceNotReplayed` 는 `if (!this.installNonceCache) return;` 을 유지해 Redis 미설정 시 no-op 폴백을 보존 — `spec/4-nodes/4-integration/4-cafe24.md §9.8 nonce cache note` 의 "Redis 미설정 / 통신 실패 시 graceful fallback" invariant 와 정합.

- **error code prefix 분리 원칙**: `spec/conventions/error-codes.md §2` 의 rename = breaking change 정책에 따라 `CAFE24_INSTALL_REPLAY` / `MAKESHOP_INSTALL_REPLAY` 를 각 caller 가 전달하도록 설계함. helper 가 provider-agnostic code 를 새로 발행하지 않음.

- **`install_token` capability-token 가정**: `spec/2-navigation/4-integration.md` — "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" (96-bit 미만 단축 시 403 으로 복귀 의무)는 이번 추출 범위 밖 — 단일 row 조회 흐름, 토큰 길이, HMAC 검증 모두 변경되지 않아 보안 invariant 유지됨.

- **OAuthState `mode='reauthorize'` 재사용 합의**: `spec/2-navigation/4-integration.md` — "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유" 결정은 `persistReauthorizeState` 에서 `mode: 'reauthorize'` 상수로 정확히 반영됨.

#### 3. 결정의 무근거 번복

**결과: 번복 없음**

diff 는 behavior-preserving 리팩터로, 새 동작이나 새 결정을 도입하지 않는다. 추출된 4개 private method 는 기존 인라인 코드를 그대로 옮긴 것으로, 분기 조건·에러 코드·fallback 정책·state row 필드 값이 모두 동일하다.

#### 4. 암묵적 가정 충돌

**결과: 충돌 없음**

- **cross-pod nonce cache**: `assertInstallNonceNotReplayed` 는 `this.installNonceCache.isReplay({ mallId: params.identifier, ... })` 로 기존 파라미터 구조를 유지하며, `spec/4-nodes/4-integration/4-cafe24.md §9.8` 의 "키: `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac 앞 8자}`" invariant 가 helper 추출 이전에도 `isReplay` 구현 안에 있어 helper 에 의해 영향받지 않음.

- **post-install redirect target (`${FRONTEND_URL}/integrations/<id>`)**: `spec/2-navigation/4-integration.md` — "Cafe24 App URL 재호출 흐름" Rationale 에서 합의된 redirect target 이 `buildIntegrationDetailRedirectUrl` 에서 `${trimmed}/integrations/${integrationId}` 로 정확히 구현됨.

- **`providerMeta` 는 provider-specific 형태 유지**: `persistReauthorizeState` 의 `providerMeta: Record<string, unknown>` 파라미터는 caller 가 구성하도록 열어두어, cafe24 의 `{ mall_id, app_type, client_id, client_secret }` 와 makeshop 의 `{ shop_uid, client_id, client_secret, code_verifier }` (PKCE verifier 포함) 가 각각의 caller 에서 결정됨. `spec/2-navigation/4-integration.md §5.9 PKCE S256` 의 code_verifier 스레딩 invariant 가 유지됨.

---

## 요약

M-1 리팩터 diff 는 `handleInstall`(cafe24) 과 `handleMakeshopInstall`(makeshop) 양 핸들러에서 중복된 ±5분 타임스탬프 검사, nonce replay 가드, post-install redirect URL 빌드, `OAuthState` 생성·저장 4개 블록을 private method 로 추출한 것이다. 기존 spec Rationale 이 명시한 결정(HMAC 빌더 분리·provider 에러 코드 prefix 유지·graceful fallback·redirect target·PKCE verifier 스레딩·`mode='reauthorize'` 재사용 합의)은 모두 helper 의 설계 경계와 파라미터 선택으로 명시적으로 보존됐다. 기각된 대안(in-memory 스캔·공통 HMAC 추상화·에러 코드 rename)이 재도입된 사례는 없으며, 새 Rationale 기록이 필요한 결정 번복도 존재하지 않는다.

---

## 위험도

NONE
