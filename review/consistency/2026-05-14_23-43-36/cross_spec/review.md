전체 spec 을 읽었습니다. Cross-spec 분석을 수행합니다.

---

## 발견사항

---

### **[WARNING]** `pending_install` 상태 Integration 사용 시 에러 코드 불일치

- **target 위치**: `spec/2-navigation/4-integration.md` §6 (상태 전이 주석)
  > "이 상태의 Integration 은 노드·AI Agent 에서 사용할 수 없다 (`INTEGRATION_INCOMPLETE` — §4.2)."
- **충돌 대상 1**: `spec/4-nodes/4-integration/4-cafe24.md` §4 step 3
  > `status='connected'` 검증 — 실패 시 `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED`
  
  `pending_install` ≠ `'connected'` → step 3 에서 `INTEGRATION_NOT_CONNECTED` 가 먼저 던져짐.
- **충돌 대상 2**: `spec/2-navigation/4-integration.md` §14.1 에러 코드 vocabulary
  > `INTEGRATION_NOT_CONNECTED` → "Integration 상태가 `expired`/`error`"
  > `INTEGRATION_INCOMPLETE` → "credentials JSONB에 필수 필드 누락"
  
  §14.1 은 `pending_install` 을 `INTEGRATION_NOT_CONNECTED` 의 트리거 목록에 포함하지 않는다.
- **상세**: 세 지점이 서로 다른 주장을 한다. (a) §6: `INTEGRATION_INCOMPLETE`. (b) Cafe24 노드 step 3 실행 순서: `INTEGRATION_NOT_CONNECTED` (status 검증이 credentials 검증보다 선행). (c) §14.1: `INTEGRATION_NOT_CONNECTED` 는 `expired`/`error` 전용. `pending_install` 이 credentials 누락(access_token/refresh_token 없음)이라는 점에서 `INTEGRATION_INCOMPLETE` 가 의미상 맞지만, 노드 실행 step 순서는 status 를 먼저 체크한다.
- **제안**: (a) `getForExecution` 이 `pending_install` 을 명시적으로 `INTEGRATION_INCOMPLETE` 로 throw 하는 분기를 갖는다면, 이를 Cafe24 노드 spec §4 step 3 에도 명시해야 한다. 또는 (b) §6 의 `INTEGRATION_INCOMPLETE` 를 `INTEGRATION_NOT_CONNECTED` 로 정정하고 §14.1 에 `pending_install` 케이스를 추가한다.

---

### **[WARNING]** `cafe24_operator_id` 필수(✓) 선언 vs. INTEGRATION_INCOMPLETE 검증 불일치

- **target 위치**: `spec/2-navigation/4-integration.md` §5.8 credentials JSONB 스키마
  > `cafe24_operator_id` | string | ✓ (필수)
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §4 step 4 INTEGRATION_INCOMPLETE 검증 목록
  > "`mall_id`, `app_type`, `access_token`, `refresh_token` 누락 시 throw"
  
  `cafe24_operator_id` 가 검증 목록에 없다.
- **상세**: 토큰을 발급받은 쇼핑몰 운영자 식별자(`cafe24_operator_id`)는 OAuth 토큰 교환 응답의 `user_id` 필드에서 채워지므로 `connected` 인 Integration 에서는 항상 존재해야 하지만, 노드 실행 시 credentials 무결성 검증에서 빠져 있다. `connected` 상태에서 해당 필드가 누락된 경우 노드가 자격증명 불완전 상태에서 실행될 수 있다.
- **제안**: 두 가지 중 하나 선택. (a) Cafe24 노드 spec §4 step 4 에 `cafe24_operator_id` 를 검증 목록에 추가. (b) `cafe24_operator_id` 는 Runtime 에서 직접 사용되지 않는 메타 필드임을 §5.8 에 주석으로 명시하고, INTEGRATION_INCOMPLETE 대상에서 제외임을 문서화.

---

### **[INFO]** §3.2 + Cafe24 노드 spec §9.4 의 "(현행 in-memory 100건 스캔 대체)" 스테일 참조

- **target 위치**: `spec/2-navigation/4-integration.md` §3.2 Private 앱 흐름 step 4
  > "백엔드가 path 의 `install_token` 으로 단일 `pending_install` Integration 을 조회하고, 그 row 의 `client_secret` 으로 HMAC 을 1회 검증한다 **(현행 in-memory 100건 스캔 대체)**."
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 4 (동일 문구)
- **상세**: 해당 parenthetical 이 지칭하는 "현행(old) in-memory 100건 스캔" 방식은 이미 완전히 제거됐다(`plan/in-progress/cafe24-pending-polish.md` 변경 2 완료). 현재의 spec 은 최종 상태를 기술해야 하는데, 폐기된 방식을 "대체"했다는 설명이 남아 있어 처음 읽는 독자에게 "이전 접근이 어딘가에 여전히 남아있다"고 오해하게 한다.
- **제안**: 두 spec 모두에서 `(현행 in-memory 100건 스캔 대체)` 괄호 전체를 제거. 설계 배경은 Rationale 섹션에 이미 기술되어 있다.

---

### **[INFO]** §2.2 내부 cross-reference 오류 (`§4.2` → `§4.3`)

- **target 위치**: `spec/2-navigation/4-integration.md` §2.2 더보기(⋮) 설명
  > "재인증(OAuth · **비활성 조건**: **§4.2 Reauthorize 행 참조**)"
- **충돌 대상**: 동일 문서 §4.2 (Overview 탭)
  > "Reauthorize(OAuth · `pending_install` 또는 cafe24 private 에서 비활성 — **§4.3 Reauthorize 상세 조건 참조**)"
  
  §4.2 자신도 §4.3 을 가리킨다. Reauthorize 비활성 조건의 정식 정의는 §4.3 Security 탭에 있다.
- **상세**: §2.2 가 §4.2 를 인용하지만 §4.2 는 그 자체로 정의가 없고 §4.3 으로 포워딩만 한다. 한 단계 hop 을 만들어 독자 혼란을 야기.
- **제안**: §2.2 의 "§4.2 Reauthorize 행 참조" → "§4.3 Reauthorize 상세 조건 참조" 로 직접 수정.

---

### **[INFO]** §3.2 의 `§9.5 참조` broken cross-reference

- **target 위치**: `spec/2-navigation/4-integration.md` §3.2 Private 앱 흐름 step 3
  > "`hmac` (HmacSHA256 서명, **§9.5 참조**)."
- **충돌 대상**: 동일 문서 §9 — §9.1·§9.2·§9.3·§9.4 만 존재, §9.5 없음.
- **상세**: HMAC 검증 상세는 `spec/4-nodes/4-integration/4-cafe24.md` §9.8 에 정의되어 있으나, integration spec 에는 §9.5 가 존재하지 않아 dangling reference.
- **제안**: `§9.5 참조` → `[Cafe24 노드 spec §9.8](../4-nodes/4-integration/4-cafe24.md#98-private-앱-app-url-hmac-검증) 참조` 로 수정.

---

### **[INFO]** §13 데이터 모델 영향 요약에 `install_token` 누락

- **target 위치**: `spec/2-navigation/4-integration.md` §13 데이터 모델 영향 요약
  > `status_reason`, `last_used_at`, `last_rotated_at`, `last_error` 필드 추가 (나열됨) — `install_token` 없음.
- **충돌 대상**: `spec/1-data-model.md` §2.10 Integration 엔티티
  > `install_token` 필드와 `(install_token) WHERE install_token IS NOT NULL` 부분 인덱스가 모두 명시됨.
- **상세**: Cafe24 Private 앱 흐름의 핵심 식별 필드인 `install_token` 이 §13 요약에서 빠져 있어, §13 만 읽는 구현자가 해당 컬럼을 추가해야 한다는 사실을 놓칠 수 있다. (`plan/in-progress/cafe24-pending-polish-followup.md` 그룹 F 에서도 이 항목을 별도로 언급함.)
- **제안**: §13 에 "`install_token` 필드 추가 (Cafe24 Private 앱 설치 흐름 식별 키 — 데이터 모델 §2.10)" 한 줄 추가.

---

## 요약

`spec/2-navigation/4-integration.md` 는 Cafe24 Private 앱 `pending_install` 상태 전이·에러 코드·식별 키 승격 내용을 포함해 전반적으로 정합하다. 단, 두 건의 WARNING 이 존재한다 — `pending_install` 통합을 노드에서 사용할 때 throw 되는 에러 코드가 세 지점에서 각각 다르게 주장되고 있고(`INTEGRATION_INCOMPLETE` vs `INTEGRATION_NOT_CONNECTED`), `cafe24_operator_id` 가 required 로 선언됐음에도 credentials 무결성 검증 step 에서 누락된 점이다. INFO 수준은 스테일 parenthetical·내부 broken 링크·§13 누락 항목으로, 기능 구현에는 직접 영향이 없으나 spec 의 읽기 신뢰성을 낮춘다. 두 WARNING 모두 현재 구현 중인 OAuth 콜백·reauthorize 유틸 리팩토링과 직접 맞닿아 있으므로, 코드 착수 전 에러 코드 귀속 방향을 결정한 뒤 둘 중 하나의 spec 을 수정하는 것이 권장된다.

## 위험도

**LOW** — CRITICAL 발견 없음. WARNING 2건은 구현 선택에 영향을 줄 수 있으나 기능 자체를 무력화하지는 않는다.