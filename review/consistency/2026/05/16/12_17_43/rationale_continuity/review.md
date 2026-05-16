# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/4-integration.md`
검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-05-16

---

### 발견사항

- **[INFO]** `tryRecoverByMallId` 회복 흐름과 폐기된 "100건 스캔 + trial HMAC" 간 명시적 구분 — 스펙 내 중복 보강
  - target 위치: `spec/2-navigation/4-integration.md` §9.2 (`GET /api/3rd-party/cafe24/install/:installToken` 설명) 및 Rationale "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 섹션
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격 (2026-05-14)" — "원래 설계는 … 백엔드가 `pending_install` 행을 in-memory 로 100건 스캔하면서 mall_id 일치 candidates 의 client_secret 으로 HMAC 검증을 trial" 했고, 이 패턴을 명시 폐기.
  - 상세: 동일 spec Rationale "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 섹션에서 "이는 옛 spec §9.8 의 '100건 스캔 + trial HMAC 폐기' 와 **표현상 충돌**하나 본질적으로 다른 경로다" 라고 스스로 구분을 명시하고 있어, Rationale 연속성이 내부적으로 유지되고 있다. 단, 구현자가 두 항목을 함께 읽지 않으면 폐기 항목을 재도입했다고 오인할 수 있어 INFO 수준으로 기록.
  - 제안: 추가 조치 불필요. 해당 Rationale 에 이미 "표현상 충돌 — 본질적으로 다른 경로" 구분이 명시되어 있어 구현자 혼동은 스펙 독해 순서 안내로 충분히 방지 가능.

- **[INFO]** `OAuthState.mode='reauthorize'` 재사용 결정과 향후 분리 조건이 열린 채로 남아있음
  - target 위치: `spec/2-navigation/4-integration.md` Rationale "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)"
  - 과거 결정 출처: 동일 Rationale 항목 마지막 문장 — "단, 향후 reauthorize 와 분리해야 할 동작이 늘어나면 별도 mode 신설 검토."
  - 상세: 현행 spec 에서 `request_scopes` 와 `reauthorize` 는 분리 유지되도록 이미 결정(Rationale "Cafe24 Private request-scopes 흐름 — `request_scopes` 와 `reauthorize` 의 분리 유지")되어 enum 분리가 일부 진행된 상태다. 구현 착수 시 이 "향후 신설 검토" 조건이 현재 기준에서 충족됐는지(분리해야 할 동작이 늘었는지) 재확인이 필요하다.
  - 제안: `request_scopes` 분기가 추가된 시점(2026-05-15)부터 분리 조건이 어느 정도 충족됐다고 볼 수 있다. Rationale 항목에 "현재 `request_scopes` 분기 추가로 분리 조건 부분 충족 — 추후 `cafe24_private_install` mode 신설 여부는 별도 plan으로 추적" 형태로 상태를 명시하면 연속성이 명확해진다.

- **[INFO]** `install_token_issued_at` 과 `created_at` fallback 의 `COALESCE` 스캐너 쿼리 — 스펙과 구현 간 정합 확인 요청
  - target 위치: `spec/2-navigation/4-integration.md` §11.1 `pending-install-ttl` 잡 설명, Rationale "install_token TTL 24h" TTL 기준 문단
  - 과거 결정 출처: 동일 Rationale — "옛 (V044 이전) 행은 `install_token_issued_at` NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback 해 legacy 의미를 유지."
  - 상세: §11.1 잡 표의 `pending-install-ttl` 대상 조건이 `COALESCE(install_token_issued_at, created_at) < now-24h` 로 명시되어 있어 Rationale 과 정합한다. 단, 이 COALESCE fallback 은 V044 이전 레거시 행이 시스템에서 전부 소멸되어야 제거 가능한 잠정 코드다. 구현 시 이 코드를 상수나 주석으로 "레거시 fallback — V044 이전 행 완전 소멸 후 제거 가능" 으로 명시해 두는 편이 향후 혼란 방지에 유익하다.
  - 제안: 구현 코드 내 COALESCE 라인에 인라인 주석으로 레거시 fallback 의도와 제거 조건을 명시.

---

### 요약

`spec/2-navigation/4-integration.md` 는 2026-05-14~05-16 에 걸쳐 누적된 복수의 결정 번복(install timeout 자동 삭제 → expired 보존, 64자 hex 토큰 → 22자 base64url, single-use token → persistent, refresh 실패 → expired 에서 error(auth_failed) 로 통일 등)을 각 Rationale 항목에 명시적 acknowledgment 와 함께 기록하고 있어, Rationale 연속성이 전반적으로 양호하게 관리되고 있다. `tryRecoverByMallId` 회복 흐름이 폐기된 "100건 스캔 + HMAC trial" 와 형태상 유사해 보이는 점도 Rationale 내부에서 명시적 구분 설명이 이미 제공되고 있다. 발견된 세 항목은 모두 INFO 수준으로, 향후 구현자 혼동 예방을 위한 Rationale 보완 제안이며, 기각된 대안의 재도입이나 합의된 invariant 위반은 식별되지 않았다.

### 위험도

NONE
