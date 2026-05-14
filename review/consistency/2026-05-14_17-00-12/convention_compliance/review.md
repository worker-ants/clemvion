이제 충분한 맥락을 확보했습니다. 분석을 작성합니다.

---

## Convention Compliance Check — spec-draft-cafe24-pending-polish.md

### 발견사항

---

**[WARNING] `pending_install` status_reason 저장값의 케이스 규약 불일치**

- **target 위치**: DRAFT 1 §1C, DRAFT 2 §2D (전이 표 3번째 신규 행), §2G (§10.4), DRAFT 3 §3B (status_reason 매핑 표), §3C (시퀀스 다이어그램 `status_reason=OAUTH_TOKEN_EXCHANGE_FAILED`)
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 (`code` 는 `UPPER_SNAKE_CASE`, but this is for **API response error codes**); 더 직접적으로는 기존 구현의 암묵적 `status_reason` 값 규약 (현재 소스코드 기준 `'auth_failed'`, `'token_expired'`, `'refresh_failed'`, `'insufficient_scope'`, `'network'`, `'unknown'` — 모두 `snake_case`)
- **상세**: 기존 `statusReason` 할당 코드(`cafe24-api.client.ts:354`, `integrations.service.ts:576`, `data-flow/integration.md §3.2`)는 예외 없이 `snake_case` 문자열 리터럴을 사용한다. draft 가 새로 도입하는 `pending_install` status_reason 후보들(`OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `RESOURCE_NOT_FOUND`)은 모두 `UPPER_SNAKE_CASE` 다. 반면 같은 draft 에서 추가되는 `install_timeout`(expired 케이스)은 올바르게 `snake_case` 를 따르고 있어 **같은 필드 안에서 두 가지 케이스 규약이 공존**하는 결과가 된다. `node-output.md` 의 `UPPER_SNAKE_CASE` 는 API 응답의 `error.code` 레이어에 적용되는 규칙이며, DB 저장 필드인 `status_reason` 에는 적용되지 않는다.
- **제안**: `pending_install` status_reason 저장값도 `snake_case` 로 통일. 예: `OAUTH_TOKEN_EXCHANGE_FAILED` → `oauth_token_exchange_failed`, `OAUTH_STATE_MISMATCH` → `oauth_state_mismatch`, `OAUTH_STATE_EXPIRED` → `oauth_state_expired`, `RESOURCE_NOT_FOUND` → `resource_not_found`. 시퀀스 다이어그램(§3C), §1C 설명문, §2D 전이 표, §2G §10.4 에러 매핑, §3B 매핑 표 모두 동일하게 교정. API 응답 에러 코드(`CAFE24_INSTALL_INVALID_HMAC`, `CAFE24_INSTALL_LEGACY_PATH` 등 §9.2·§9.4 정의분)는 계속 `UPPER_SNAKE_CASE` 유지 — 두 레이어를 명확히 분리.

---

**[INFO] `last_error.code`와 `status_reason` 이 동일 문자열을 공유하는 설계 의도가 불명확**

- **target 위치**: DRAFT 3 §3C 시퀀스 다이어그램 (`UPDATE integration SET status_reason=OAUTH_TOKEN_EXCHANGE_FAILED, last_error={code,message,at}`), DRAFT 2 §2G
- **위반 규약**: 정식 규약 직접 위반은 아님. `spec/conventions/node-output.md` Principle 3 (에러 컨트랙트 통일) 의 정신
- **상세**: draft 설계에서 `last_error.code` 와 `status_reason` 에 동일한 코드 문자열이 들어간다. 두 필드가 존재하는 이유가 다름(`last_error` 는 시점·메시지 포함 진단 스냅샷, `status_reason` 은 현재 status 의 의미론적 분류)에도 같은 값을 공유하면 미래 독자가 중복 여부와 역할 차이를 혼동할 수 있다. 특히 `error` status 의 `status_reason` 은 `auth_failed` / `insufficient_scope` 같은 **분류 코드**이고, `last_error` 에는 더 상세한 진단 정보가 들어가는 기존 패턴과 다르다.
- **제안**: Rationale 섹션(§2I)에 "왜 pending_install 의 status_reason 이 last_error.code 와 동일한 값을 가지는가"를 한 줄 추가. 예: `last_error.code` 가 nullable 세션 진단용이고 TTL 만료 후 소거될 수 있어, 재시도 안내 UI 가 영속적으로 참조할 코드를 `status_reason` 에도 중복 보존한다는 설계 근거.

---

**[INFO] V042 참조 정확성 확인 완료 (이슈 없음)**

- **target 위치**: DRAFT 3 §3D (`install_token 컬럼은 V042 추가`)
- **상세**: `backend/migrations/V042__cafe24_private_app_pending_install.sql` 가 실제로 존재하며 `install_token VARCHAR(64) NULL` 컬럼 추가와 `pending_install` enum 확장을 포함한다. draft 의 V042 참조는 정확. 마이그레이션 규약(`spec/conventions/migrations.md`) 위반 없음.

---

### 요약

draft 의 문서 구조(frontmatter 완비, `plan/in-progress/` 위치, Rationale 섹션 신설, `## Rationale` 3섹션 권장 구성), API 에러 코드 명명(`UPPER_SNAKE_CASE`), 용어 교정(`Resource` → `카테고리`, `cafe24-api-metadata.md §6` 참조 링크 포함), V042 마이그레이션 참조는 모두 규약을 준수한다. 유일한 실질적 위반은 **`pending_install` 상태의 `status_reason` DB 저장값에 `UPPER_SNAKE_CASE` 를 사용**한다는 점으로, 기존 구현 전체가 `snake_case` 를 사용하는 이 필드에 케이스 불일치를 도입한다. 수정 범위가 draft 내 5~6개 위치로 제한적이므로 반영 비용은 낮다.

### 위험도

**LOW**