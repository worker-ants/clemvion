## 발견사항

*Target 문서 본문이 `(없음)` — plan (`cafe24-pending-polish.md`) 에 명시된 spec 갱신 항목과 코퍼스를 교차 대조합니다.*

---

### [INFO] `install_token` — 데이터 모델과 일치, 충돌 없음

- **target 신규 식별자**: `Integration.install_token` (§2.4 등재)
- **기존 사용처**: `spec/1-data-model.md §2.10` — 이미 `install_token | String?` 컬럼으로 정의됨. 인덱스 `(install_token) WHERE install_token IS NOT NULL` 도 §3 에 등재됨.
- **상세**: target 의 등재가 data-model 의 기존 정의를 그대로 참조하므로 신규 도입이 아니라 동기화임. 의미 충돌 없음.

---

### [INFO] `pending_install` status — 데이터 모델과 일치, 충돌 없음

- **target 신규 식별자**: `Integration.status` 열거형에 `pending_install` 추가 (§2.2)
- **기존 사용처**: `spec/1-data-model.md §2.10` — `status | Enum | connected / expired / error / pending_install` 이미 등재.
- **상세**: 동기화 항목. 충돌 없음.

---

### [INFO] `install_timeout` status_reason — 데이터 모델과 일치

- **target 신규 식별자**: `statusReason = 'install_timeout'` (§6 pending_install → expired 전이)
- **기존 사용처**: `spec/1-data-model.md §2.10` — `expired → token_expired / refresh_failed / install_timeout` 이미 등재.
- **상세**: 동기화 항목. 충돌 없음.

---

### [WARNING] `CAFE24_INSTALL_LEGACY_PATH` / `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` / `CAFE24_INSTALL_INVALID_TOKEN` — 신규 에러 코드, 기존 패턴과 확인 필요

- **target 신규 식별자**: plan 변경 2·3에서 도입 예정인 에러 코드들
- **기존 사용처**: `spec/1-data-model.md §2.10` `status_reason` 에는 `UPPER_SNAKE_CASE` 에러 코드 공간이 `OAUTH_*` 계열로만 정의됨 (`OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`). `CAFE24_*` prefix 코드는 corpus 어디에도 등재되지 않음.
- **상세**: 새 prefix 도입 자체는 문제 없으나, 기존 `OAUTH_*` 계열과 동일 레이어(API 에러 코드 공간)에서 일관된 명명 규칙이 적용되어야 함. data-model §2.10 note("DB 저장값은 `snake_case`, 동일 의미의 API 에러 코드는 `OAUTH_*` `UPPER_SNAKE_CASE`") 와 `CAFE24_*` 코드가 같은 API 에러 코드 공간에서 일관성 있게 쓰이는지 확인 필요.
- **제안**: spec §10.4 에러 매핑 테이블에 `CAFE24_*` 코드를 명시적으로 등재해 기존 `OAUTH_*` 계열과 구분 영역을 분리할 것. 위반 자체는 아니며 문서화로 해소 가능.

---

### [INFO] `GET /api/integrations/oauth/install/cafe24/:installToken` — 신규 라우트, 기존 충돌 없음

- **target 신규 식별자**: plan 변경 2의 신규 컨트롤러 라우트
- **기존 사용처**: corpus 내 `spec/2-navigation/4-integration.md` API 섹션이 `(없음)` 으로 확인 불가. 단, data-flow `spec/data-flow/integration.md §3.2` 및 기존 consistency 검토(`review/consistency/2026-05-14_18-23-55/`)에서 이미 반영 완료로 기록됨.
- **상세**: 410 Gone 처리될 레거시 경로(`/oauth/install/cafe24` without installToken)와의 명확한 구분이 spec §9.2 에 문서화되어 있으면 충돌 없음.

---

### [INFO] `application` Resource (cafe24-api-metadata.md §1) — 이미 주석 처리됨

- **기존 사용처**: `spec/conventions/cafe24-api-metadata.md` §1 에서 `application.ts` 디렉토리 항목에 `⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의` 이미 명시.
- **상세**: 인지된 충돌이 컨벤션 문서에서 이미 경고로 처리됨. 추가 조치 불필요.

---

## 요약

Target 문서(`spec/2-navigation/4-integration.md`) 본문이 제공되지 않았으나 plan과 코퍼스 교차 대조 결과, **신규 식별자의 의미 충돌(CRITICAL)은 발견되지 않았다.** `install_token`, `pending_install`, `install_timeout` 은 이미 `spec/1-data-model.md §2.10` 에 정의된 식별자의 동기화 등재이며, 신규 에러 코드 `CAFE24_*` 계열은 기존 `OAUTH_*` 와 prefix 충돌은 없으나 API 에러 코드 공간의 일관성 문서화(§10.4 에러 매핑 테이블 등재)를 권장한다.

## 위험도

**LOW**