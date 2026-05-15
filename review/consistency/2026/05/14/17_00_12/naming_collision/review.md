spec draft를 기존 corpus 와 대조한 결과를 보고합니다.

---

## 발견사항

### [INFO] `CAFE24_INSTALL_INVALID_HMAC` — 기존 식별자 의미 축소

- **target 신규 식별자**: 기존 코드 유지, 의미 변경
- **기존 사용처**: `spec/2-navigation/4-integration.md §9.2` 현행 텍스트
  > `CAFE24_INSTALL_INVALID_HMAC`(403, **pending 미발견 포함** — 정보 노출 방지)
- **상세**: draft §2E 이후 `CAFE24_INSTALL_INVALID_HMAC` 는 순수 HMAC 검증 실패만 의미하도록 축소되고, "token 미존재" 케이스는 신규 `CAFE24_INSTALL_INVALID_TOKEN`(404) 로 분리됩니다. 기존 spec·코드에서 "pending 미발견 → 403" 응답을 기대했다면 이제 404 를 받게 되는 breaking semantic change 입니다. 코드 수준 클라이언트(Cafe24 Developers 쪽이 아닌 내부 e2e 테스트)는 이 변경에 취약할 수 있습니다.
- **제안**: §2E의 replace diff 에 "기존 `CAFE24_INSTALL_INVALID_HMAC` 의 pending-미발견 케이스 분리" 임을 주석으로 명시해 실수로 같은 코드로 착각하는 일을 예방합니다.

---

### [INFO] `OAUTH_TOKEN_EXCHANGE_FAILED` — API 에러 코드와 DB `status_reason` 이중 사용

- **target 신규 식별자**: `status_reason` 컬럼 값으로 `OAUTH_TOKEN_EXCHANGE_FAILED` 사용 (DRAFT 1C, DRAFT 2D, DRAFT 3B, DRAFT 3C)
- **기존 사용처**: 동일 문자열이 `spec/2-navigation/4-integration.md §9.4` 에 API 응답 에러 코드로 이미 정의
- **상세**: `OAUTH_TOKEN_EXCHANGE_FAILED` 는 API 레이어 에러 코드(클라이언트 응답)와 DB 컬럼 값(`integration.status_reason`) 양쪽에 동일 string 이 쓰입니다. 현재 draft 는 이 이중 사용을 암묵적으로 허용하지만 spec 어디에도 "API 에러 코드 = DB 저장값" 임이 명시되어 있지 않습니다.
- **제안**: §1C 또는 §2D 에 "status_reason 값은 callback 에러 코드 string 을 그대로 사용한다" 는 한 문장을 추가해 이중 사용이 의도임을 명시합니다.

---

### [INFO] `install_token` 마이그레이션 번호 "V042" — 컬럼 기존재 가능성

- **target 신규 식별자**: `spec/data-flow/integration.md §2.1` 의 "`install_token` 컬럼은 V042 추가"
- **기존 사용처**: git log에 이미 `fix(cafe24): Integration.installToken 컬럼 type 명시 — DataTypeNotSupportedError 해소` 커밋이 main 에 존재
- **상세**: 위 커밋은 `installToken` 컬럼이 이미 코드베이스에 존재하며 타입 오류를 수정했음을 나타냅니다. 즉, `install_token` 컬럼은 V042 이전 어떤 마이그레이션에서 이미 추가되었을 가능성이 높습니다. "V042 추가" 라는 spec 표기가 코드 실제 마이그레이션 번호와 어긋나면 spec-code 정합이 깨집니다.
- **제안**: spec 적용 전 `backend/migrations/` 디렉터리에서 `install_token` 이 어느 버전에서 추가됐는지 확인하고, 실제 번호(또는 "V0XX 추가" 표기)로 교정합니다.

---

### [INFO] `카테고리` / `Resource` 이중 용어

- **target 수정**: DRAFT 2H — spec 두 군데에서 "Resource 단위 grouping" → "카테고리 단위 grouping" 교정
- **기존 사용처**: `spec/conventions/cafe24-api-metadata.md §1` 은 여전히 "한 **Resource** 의 모든 Operation 메타데이터" 표현 사용
- **상세**: 교정 자체는 §6 의 "UI 는 카테고리 단위 grouping" 정의와 일치해 올바릅니다. 다만 convention 문서에서 "Resource" 가 여전히 backend 도메인 용어로 쓰이므로, 두 단어가 다른 레이어를 가리킨다는 점이 문서 간에 명시되지 않습니다.
- **제안**: `cafe24-api-metadata.md §6` 에 "UI 노출 단위는 '카테고리', 백엔드 메타데이터 파일 단위는 'Resource' — 두 용어가 가리키는 범위는 동일하나 문맥에 따라 혼용됨" 한 문장을 추가합니다.

---

## 요약

신규 식별자(`pending_install`, `install_token`, `CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_INVALID_HMAC`(narrowed), `CAFE24_INSTALL_REPLAY`, `CAFE24_INSTALL_LEGACY_PATH`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`, `install_timeout`)는 기존 corpus 와 직접 충돌하는 동음이의어 없음. 다만 기존 식별자 `CAFE24_INSTALL_INVALID_HMAC` 의 의미 축소, `OAUTH_TOKEN_EXCHANGE_FAILED` 의 이중 역할, V042 마이그레이션 번호 정합성 세 가지가 spec 적용 전 명시적 확인이 필요합니다.

## 위험도

**LOW** — 실제 명명 충돌 없음. INFO 항목들은 문서 명확성 개선 또는 번호 검증 수준.