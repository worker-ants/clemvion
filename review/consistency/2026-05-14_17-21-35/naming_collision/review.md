## 발견사항

### 명명 충돌 점검 결과

---

### [WARNING] `CAFE24_INSTALL_INVALID_HMAC` 의미 범위 축소 — 기존 사용처와 의미 변화

- **target 신규 식별자**: `CAFE24_INSTALL_INVALID_TOKEN (404)` — 토큰 미존재 케이스 분리
- **기존 사용처**: `spec/2-navigation/4-integration.md §9.2` — `CAFE24_INSTALL_INVALID_HMAC(403)` 을 "HMAC 검증 실패 **또는 pending 미발견**" 두 케이스의 합쳐진 응답으로 정의
- **상세**: DRAFT 2E 는 기존 에러 코드를 "HMAC 불일치만" 으로 좁히고, 나머지 "토큰 미존재·이미 소거" 케이스는 `CAFE24_INSTALL_INVALID_TOKEN(404)` 로 분리한다. 코드명(`CAFE24_INSTALL_INVALID_HMAC`)은 동일하나 **의미가 축소**되어, 기존 백엔드·테스트·클라이언트 코드가 이 에러를 "token not found" 분기로도 처리하고 있다면 갱신이 필요하다.
- **제안**: DRAFT 2J-2(`§9.8`) 및 DRAFT 2F 패치를 적용하면서, 기존 `handleInstall` 핸들러와 e2e 테스트에서 `CAFE24_INSTALL_INVALID_HMAC` 를 처리하는 코드를 전수 확인하고 404/403 분기로 분리할 것.

---

### [INFO] `oauth_*` snake_case (DB) ↔ `OAUTH_*` UPPER_SNAKE_CASE (API) 이중 표기

- **target 신규 식별자**: `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `resource_not_found` (DB `status_reason` 값)
- **기존 사용처**: `spec/2-navigation/4-integration.md §9.4` 의 `OAUTH_STATE_MISMATCH (400)` 등 API 레벨 에러 코드
- **상세**: 동일 의미를 DB 저장값은 `snake_case`, API 에러 코드는 `UPPER_SNAKE_CASE` 로 이중 표기하는 의도적 설계다. 드래프트 §1C 와 §2I Rationale 에서 명시적으로 문서화되어 있어 설계 의도는 명확하다. 그러나 구현 단계에서 두 표기를 혼용하면 `status_reason` 컬럼에 `OAUTH_STATE_MISMATCH` (대문자)가 저장되거나 API 응답에 `oauth_state_mismatch` (소문자)가 노출되는 버그가 발생할 수 있다.
- **제안**: `markIntegrationCallbackError` 보조 메서드 내부에서 status_reason 값을 상수 열거체로 관리하고, 단위 테스트에서 DB값(snake_case) / API값(UPPER_SNAKE_CASE) 를 동시에 assertions 하도록 강제할 것.

---

### [INFO] `카테고리` 용어 — `Node.category` Enum 과의 맥락 분리

- **target 신규 식별자**: `카테고리` (Cafe24 API allowlist UI grouping 단위, DRAFT 2H / DRAFT 2I §6)
- **기존 사용처**: `spec/1-data-model.md §2.6 Node.category` 는 `logic / flow / ai / integration / data / presentation` Enum; `spec/conventions/cafe24-api-metadata.md` 의 `scopeType` 필드는 이미 `Node.category` 와의 명명 충돌을 피하기 위해 `category` 대신 `scopeType` 을 채택했다고 명시
- **상세**: 드래프트가 Cafe24 API grouping 의 **UI 레이블**을 "카테고리" (한국어) 로 확정한다. 영문 코드베이스의 `Node.category` 와는 맥락이 다르고, 드래프트 §6 에서 "UI 맥락이면 카테고리, 백엔드 맥락이면 Resource" 로 명확히 구분한다. 실질적 충돌은 없으나, 프론트엔드 i18n 키나 문서 검색 시 혼동 가능.
- **제안**: `spec/conventions/cafe24-api-metadata.md §6` 에 추가되는 용어 정의가 `Node.category` 와 별개 개념임을 명시적으로 한 줄 주석으로 인라인화 (드래프트 이미 반영).

---

## 요약

신규 도입 식별자 전수 점검 결과, Critical 수준의 명명 충돌 없음. 새 에러 코드(`CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_LEGACY_PATH`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`), 새 status enum 값(`pending_install`), 새 컬럼(`install_token`), 새 status_reason 값(`install_timeout`, `credentials_unreadable`, `token_expired`, `refresh_failed`, callback 실패 분기 코드)은 기존 spec 코퍼스에서 다른 의미로 사용된 사례가 없다. `CAFE24_INSTALL_INVALID_HMAC` 의 의미 축소는 기존 구현 코드 점검이 필요한 Warning 수준의 주의사항이다.

## 위험도

**LOW**