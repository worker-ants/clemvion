## 발견사항

---

### **[WARNING]** `CAFE24_INSTALL_INVALID_HMAC` 의미 범위 축소 — 기존 테스트 코드 수정 필요

- **target 신규 식별자:** `CAFE24_INSTALL_INVALID_HMAC (403)` (에러 코드 재정의, 의미 변경)
- **기존 사용처:** `spec/2-navigation/4-integration.md §9.2` — 현행 정의 "HMAC 검증 실패 또는 pending 미발견 합산 (정보 노출 방지)"
- **상세:** 현행 spec은 `CAFE24_INSTALL_INVALID_HMAC(403)` 하나로 "토큰/pending row 미존재" + "HMAC 불일치" 두 케이스를 합산 처리. 본 draft는 `CAFE24_INSTALL_INVALID_TOKEN(404)`를 분리하면서 이 코드를 순수 HMAC 불일치만으로 의미 축소. 기존 403을 기대하는 e2e/통합 테스트(특히 "pending 미발견" 경로)가 404를 받아 실패.
- **제안:** `cafe24-pending-polish.md` 변경 5 테스트 보강 목록에 "기존 `CAFE24_INSTALL_INVALID_HMAC(403)` 테스트 케이스 중 '토큰 미존재' 경로를 `CAFE24_INSTALL_INVALID_TOKEN(404)`로 전환" 항목을 명시 추가. Draft §9.2/§9.8에서 I7 언급은 있으나 구현 plan에는 누락.

---

### **[WARNING]** `token_exchange_failed` (auth 도메인) vs `oauth_token_exchange_failed` (integration 도메인) — 유사 식별자 중복 존재

- **target 신규 식별자:** `status_reason = 'oauth_token_exchange_failed'` (Integration DB 컬럼 값)
- **기존 사용처:** `spec/2-navigation/10-auth-flow.md §5.4` — `?error=token_exchange_failed` (소셜 로그인 OAuth 콜백 URL 파라미터)
- **상세:** `oauth_` prefix로 도메인이 구분되어 있고 draft Rationale §2I에서 "의도적 분리"로 명시됨. 충돌은 아니나, grep·로그 분석·신입 개발자 맥락에서 두 식별자가 혼동될 수 있음.
- **제안:** Draft Rationale 기술로 spec 차원은 충분. 추가 조치 불필요. 단, 운영 로그 알림 필터 구성 시 두 식별자를 별도 처리해야 함을 `cafe24-pending-polish.md` 비포함 섹션에 메모 추가 권장.

---

### **[INFO]** BullMQ `integration-expiry` 큐 메시지 — `reason` 필드 신설, 소비자 하위 호환 확인 범위

- **target 신규 식별자:** `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }` (큐 메시지 shape 확장)
- **기존 사용처:** `spec/data-flow/integration.md §1.4` — 현행 메시지는 `{ integrationId }` 단일 필드
- **상세:** Draft §3C-bis에 "기존 소비자가 `reason` 미포함 메시지를 받던 경로가 있다면 `reason ?? 'token_expiring'` 기본값 처리"가 명시됨. 멀티 인스턴스 배포 환경에서 구버전 소비자와 신버전 소비자가 같은 큐를 공유하는 롤링 배포 구간에 유의.
- **제안:** `cafe24-pending-polish.md` 변경 4에 "BullMQ `integration-expiry` 소비자 하위 호환 배포 순서 확인 (소비자 먼저, 생산자 나중)" 항목 추가 권장. 충돌 없음.

---

### **[INFO]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` vs `INTEGRATION_IN_USE` — 동일 HTTP 409 코드 중첩

- **target 신규 식별자:** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` (신규 에러 코드)
- **기존 사용처:** `spec/2-navigation/4-integration.md §9.4` — `INTEGRATION_IN_USE (409)` (삭제 차단)
- **상세:** 동일 HTTP 상태코드지만 에러 코드 문자열이 다름. Draft §2F에서 `INTEGRATION_IN_USE(409)` 선례를 명시적으로 참조하여 설계 근거 기록. 충돌 없음.
- **제안:** 조치 불필요.

---

### **[INFO]** `credentials_unreadable` — 구현 선행·spec 후행 소급 등재

- **target 신규 식별자:** `status_reason = 'credentials_unreadable'` (`spec/data-flow/integration.md §3B` `error` 행에 추가)
- **기존 사용처:** `integrations.service.ts:845` (코드에 이미 존재, spec 미등재 상태)
- **상세:** Draft §1C Rationale에 "pre-existing 분기로 본 개정 범위 외이나 정합성 유지를 위해 §10.4/data-flow §3.2에 동시 명시"로 설명. 충돌이 아닌 누락 정상화. Draft §3B에서 `error` 상태 후보값에 정상 포함.
- **제안:** 조치 불필요.

---

## 요약

본 draft가 도입하는 신규 식별자(`pending_install`, `install_token`, `CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_LEGACY_PATH`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`, `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `install_timeout`, `pending_install_timeout`)는 기존 식별자와 의미론적 Critical 충돌이 없다. WARNING 1(`CAFE24_INSTALL_INVALID_HMAC` 의미 축소)은 기존 e2e 테스트 코드가 예상 응답 코드를 403→404로 수정해야 하므로 구현 plan의 변경 5 테스트 보강 항목에 반영이 필요하다.

## 위험도

**LOW**