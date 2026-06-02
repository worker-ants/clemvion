# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 착수 전 검토 (`--impl-prep`)
**대상 scope**: `spec/4-nodes/4-integration/` (Cafe24 install rate limiting 구현 준비)
**연관 plan**: `plan/in-progress/cafe24-install-ratelimit.md` (A-3)

---

## 발견사항

### 1. [WARNING] install endpoint throttle 정책이 spec 에 미기재 — 구현과 spec 의 비대칭

- **target 위치**: `plan/in-progress/cafe24-install-ratelimit.md` §설계 (확정) — Redis 분산 throttle + 실패 페널티 Layer 1/2 정의
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 "보안 추가 조치" / `spec/2-navigation/4-integration.md` §9.2 API 표 (install 행)
- **상세**: 현재 `spec/4-nodes/4-integration/4-cafe24.md` §9.8 의 "보안 추가 조치" 목록은 `timestamp ±5분 윈도우` + `HMAC 미일치 403` + nonce cache (Redis) 만 열거되어 있으며, Layer 1(30/min 분산 Redis throttle)과 Layer 2(실패 카운터 페널티 `INSTALL_FAIL_THRESHOLD=10 / INSTALL_FAIL_WINDOW_SEC=600`) 가 전혀 언급되지 않는다. `spec/2-navigation/4-integration.md` §9.2 API 표의 install endpoint 행(`GET /api/3rd-party/cafe24/install/:installToken`)에도 `throttle 30/min` 또는 IP fail-penalty 항목이 없다. 구현 후 코드에는 두 layer 가 존재하지만 spec 에는 서술이 없으므로 코드-spec 비대칭이 발생한다. 또한 plan §4 "DOCUMENTATION — spec 갱신" 단계가 명시하고 있으나 아직 spec 이 갱신되지 않은 상태에서 구현을 착수하면, 추후 spec 갱신 시 다른 reviewer 가 코드 관찰로 상수·정책을 재발견해야 한다.
- **제안**: 구현 착수 전(`--impl-prep` 검토 시점)에 plan 단계 4번 "spec 갱신"을 완료하거나, 최소한 §9.8 에 다음 항목을 추가해야 한다: (a) Layer 1 Redis 분산 throttle (30/min, graceful degradation to in-memory), (b) Layer 2 실패 페널티 `cafe24:install:fail:{ip}`, `INSTALL_FAIL_THRESHOLD`, `INSTALL_FAIL_WINDOW_SEC` 상수, (c) 차단 응답(429 또는 기존 404 유지) 정책. 이 두 spec 파일(`4-cafe24.md`, `4-integration.md`)이 함께 갱신되어야 단일 진실이 유지된다.

---

### 2. [WARNING] install endpoint 에러 코드 목록에 429(rate-limit 초과) 응답 코드가 없음

- **target 위치**: `spec/2-navigation/4-integration.md` §9.2 API 표 (install 행) / §10.3 에러 코드 목록 (`CAFE24_INSTALL_*` 열거)
- **충돌 대상**: `plan/in-progress/cafe24-install-ratelimit.md` §설계 Layer 2 "임계치 초과 시 추가 처리 없이 차단(429 또는 404 유지로 oracle 노출 최소화)"
- **상세**: `spec/2-navigation/4-integration.md` §10.3 에는 install endpoint 에러 코드(`CAFE24_INSTALL_MISSING_PARAMS` / `CAFE24_INSTALL_INVALID_TOKEN` / `CAFE24_INSTALL_INVALID_HMAC` / `CAFE24_INSTALL_REPLAY`) 만 열거되어 있다. Layer 2 실패 페널티로 rate-limit 차단이 발생할 때 새 에러 코드(`CAFE24_INSTALL_RATE_LIMITED` 또는 동등 코드)를 추가할지, 기존 코드를 재사용할지, 아니면 plain 429 를 반환할지에 대한 spec 결정이 없다. plan 설계는 "oracle 노출 최소화를 위해 기존 404 유지 가능성도 있음"이라고 모호하게 기술한다. 구현자가 임의로 결정하면 `spec/2-navigation/4-integration.md` 의 에러 코드 표와 실제 구현이 어긋난다.
- **제안**: spec 갱신 시 Layer 2 차단의 HTTP 상태코드와 에러 코드(신설 또는 재사용)를 명시하고, `spec/2-navigation/4-integration.md` §10.3 에 해당 코드를 추가한다. "oracle 노출 최소화" 를 이유로 기존 404 를 그대로 쓰면 에러 코드 표에 별도 항목을 두지 않아도 되나, 429 를 쓰면 반드시 표에 추가해야 한다.

---

### 3. [WARNING] Redis throttle graceful degradation 정책과 기존 nonce cache 정책의 일치 여부 미명시

- **target 위치**: `plan/in-progress/cafe24-install-ratelimit.md` §설계 Layer 1 "Redis 미설정 시 graceful degradation — 기존 in-memory store 로 fallback (nonce-cache 패턴 일치)"
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 nonce cache 단락 "Redis 미설정 / 통신 실패 시 graceful degradation — nonce 검사는 skip 되고 옛 ±5분 윈도우 정책으로 fallback"
- **상세**: nonce cache 의 graceful degradation 은 "Redis 미설정 / 통신 실패 시 nonce 검사 자체를 skip" 이다. Layer 1 throttle 의 graceful degradation 은 "in-memory store 로 fallback" 이다. 두 정책이 서로 다르다 — nonce 는 Redis 없으면 보호가 약화되는 반면, throttle 은 in-memory 로 유지된다. spec §9.8 에 두 degradation 경로가 명확히 구분되어 기술되지 않으면 운영자가 Redis 없이 셀프 호스팅할 때 보안 레벨이 불분명해진다. (nonce 는 skip, throttle 은 pod-local in-memory 로 partial 작동 — 둘의 보안 실패 모드가 다름.)
- **제안**: spec §9.8 갱신 시 Layer 1 throttle 의 graceful degradation 정책과 nonce cache 의 degradation 정책을 병렬 기술하여 운영자가 Redis 없이 배포 시 어떤 보안 레이어가 얼마나 약화되는지 명확히 이해할 수 있게 한다.

---

### 4. [INFO] `spec/5-system/2-api-convention.md` §7 Rate Limiting 표에 install endpoint 항목 없음

- **target 위치**: `plan/in-progress/cafe24-install-ratelimit.md` §설계 Layer 1 (Redis 분산 throttle 30/min)
- **충돌 대상**: `spec/5-system/2-api-convention.md` §7 Rate Limiting 표 (`일반 API 100/min` / `인증 API 10/min` / `Webhook 100/min` / `파일 업로드 10/min`)
- **상세**: `/api/3rd-party/cafe24/install/:installToken` 는 비인증 3rd-party 엔드포인트로 위 표의 어느 범주에도 속하지 않는다. 현재 `spec/2-navigation/4-integration.md` 에서만 endpoint 수준 throttle 이 기술되어 있고(precheck 60/min), install endpoint 의 분산 throttle 정책은 시스템 차원 API convention 에 미노출이다. 직접 충돌은 아니나 새 throttle 추가 시 `spec/5-system/2-api-convention.md §7` 의 표에도 install endpoint 범주를 추가하거나, 범주 밖 endpoint 는 각 도메인 spec 에서 개별 관리한다는 원칙을 명시하는 것이 일관성 측면에서 권장된다.
- **제안**: spec 갱신 시 `spec/5-system/2-api-convention.md §7` 에 "3rd-party 수신 엔드포인트 (`/api/3rd-party/*`) 는 도메인별 spec 에서 throttle 정의" 한 줄을 추가하거나, install 30/min 을 표에 추가한다.

---

### 5. [INFO] `meta.callLimit` 필드의 타입이 target spec 과 데이터 모델 간 암묵적 비일관성

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §5.1 meta 표 `meta.callLimit?: string` — 예시 `"5/40"` (문자열)
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §4.1 Rate Limit 처리 상세 표 (`X-Api-Call-Limit` 헤더 `현재/상한` 예시 `1/40`)
- **상세**: 이 항목은 기존 spec 내 자체 일관성의 문제로, target spec 에 이미 존재한다. `meta.callLimit` 을 `string` 으로 정의하고 `"5/40"` 형태의 raw 헤더 값을 그대로 저장하는 반면, 다른 `meta.callUsage` / `meta.callRemain` 은 `number` 이다. 이는 의도적 선택이지만 TypeScript 표현식에서 `$node["X"].meta.callLimit` 파싱을 소비 측이 직접 해야 한다. 본 plan 의 구현 범위는 아니나 향후 Cafe24 관련 spec 개정 시 정비 후보임을 인지하도록 INFO 로 기록.
- **제안**: 현 구현 범위 밖이므로 즉시 조치 불필요. 차후 cafe24 spec 정비 시 `{ current: number, limit: number }` 분리 또는 현행 유지 중 하나를 Rationale 로 명시.

---

## 요약

Cross-Spec 일관성 관점에서 `spec/4-nodes/4-integration/` 은 현재(구현 착수 전) 기준으로 기존 spec 과 직접 모순(CRITICAL)이 없다. 단, plan A-3 에서 추가할 Cafe24 install endpoint 의 Redis 분산 throttle(Layer 1)과 실패 페널티(Layer 2) 정책은 아직 spec 에 반영되지 않았고, 에러 코드·HTTP 상태코드·graceful degradation 정책의 세부 결정이 spec 갱신 전에 구현으로 확정되면 `spec/4-nodes/4-integration/4-cafe24.md §9.8` 및 `spec/2-navigation/4-integration.md §9.2/§10.3` 과의 비대칭이 발생한다. plan 에서 spec 갱신을 명시한 step 4 가 구현(step 6) 보다 먼저 실행되어야 한다. `spec/5-system/2-api-convention.md §7` Rate Limiting 표도 3rd-party 엔드포인트 throttle 정책의 귀속처를 명시해 두면 향후 동종 endpoint 추가 시 일관성을 확보할 수 있다.

## 위험도

MEDIUM
