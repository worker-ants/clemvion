---

## 발견사항

### [WARNING] `resource_not_found` — DRAFT 1C 와 DRAFT 3B 간 상충
- **target 위치**: DRAFT 1C (`spec/1-data-model.md §2.10 status_reason` 행) vs DRAFT 3B (`spec/data-flow/integration.md §3.2` 매핑 표)
- **위반 규약**: 없음 (정식 규약 직접 위반은 아님) — 그러나 draft가 적용되면 동일 컬럼의 유효값을 두 spec 파일이 모순 선언
- **상세**:
  - DRAFT 1C: `※ resource_not_found 는 row 자체가 사라진 케이스라 status_reason 갱신이 불가능 — 본 컬럼 후보값에서는 제외`
  - DRAFT 3B: `pending_install` status_reason 후보에 `resource_not_found` 를 명시 포함
  - DRAFT 2G §10.4 오류 매핑 표도 "변경 불가 (row 가 사라진 케이스)"로 기술 → DRAFT 1C, DRAFT 2G, DRAFT 3C 시퀀스 다이어그램 셋이 모두 DRAFT 3B 와 충돌
- **제안**: DRAFT 3B의 `pending_install` status_reason 후보 목록에서 `resource_not_found` 제거. 제거 후 괄호 설명 "모두 snake_case" 이하 본문을 이어 붙이면 자연스럽다.

---

### [WARNING] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` — HTTP 상태 코드 400 사용 (swagger 규약은 409)
- **target 위치**: DRAFT 2F (`spec/2-navigation/4-integration.md §9.4`) 및 DRAFT 2F-bis
- **위반 규약**: `spec/conventions/swagger.md §2-4` — "중복/충돌" 시나리오 → `ApiConflictResponse` (409)
- **상세**: 에러 설명이 "동일 `(workspaceId, mall_id, app_type='private')` 에 이미 `connected` Integration 존재"로, 명확한 리소스 충돌 케이스다. swagger 규약은 이를 409로 정의한다. 기존 `INTEGRATION_IN_USE (409)` 선례도 있어 400 채택은 일관성을 훼손한다.
- **제안**: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 400 → **409** 로 변경. 클라이언트가 "이미 연결된 통합이 있다"를 사용자에게 안내할 수 있도록 409 응답 body에 기존 integration 정보 hint를 포함하는 방향도 검토 가능.

---

### [INFO] DRAFT 2H — `cafe24-api-metadata.md §6` 추가 문구 "문맥에 따라 혼용한다"
- **target 위치**: DRAFT 2H — `spec/conventions/cafe24-api-metadata.md §6` 첫 단락 inline 보강
- **위반 규약**: 없음
- **상세**: 같은 문장 끝에 `spec 본문에서는 UI 맥락이면 "카테고리", 백엔드/Operation 메타데이터 맥락이면 "Resource" 사용`이라는 명확한 규칙이 이어지지만, 앞부분 "문맥에 따라 혼용한다" 는 "자유롭게 섞어도 된다"로 오독될 여지가 있다.
- **제안**: `"문맥에 따라 혼용한다"` → `"목적별로 구분 사용한다"`로 교체하면 이어지는 규칙과 어조가 통일된다.

---

### [INFO] HTTP 410 (`CAFE24_INSTALL_LEGACY_PATH`) — swagger 규약 표준 데코레이터 표에 미등재
- **target 위치**: DRAFT 2E, DRAFT 2F
- **위반 규약**: `spec/conventions/swagger.md §2-4` — 표준 응답 코드 표에 410 항목 없음
- **상세**: 410 자체가 REST 의미론적으로 적절하나, 구현 시 `@ApiResponse({ status: 410, description: '...' })` 커스텀 데코레이터를 사용해야 한다 — 이는 스펙이 아닌 구현 수준 주의 사항이므로 draft 수정보다는 developer skill 진입 시 인지 필요.
- **제안**: spec 본문에 `(구현 시 @ApiResponse({ status: 410 }) 사용)`을 parenthetical로 추가하면 개발자 참조가 명확해진다.

---

### [INFO] 에러 코드·status_reason 이중 표기 정책 — 규약 준수 확인
- **target 위치**: DRAFT 1C, DRAFT 2D, DRAFT 2G, DRAFT 3B 전반
- **위반 규약**: 없음 — `node-output.md §3.2` 준수 확인
- **상세**: 
  - `last_error.code` / callback HTML 에러 코드 → `UPPER_SNAKE_CASE` ✅ (`OAUTH_TOKEN_EXCHANGE_FAILED`, `CAFE24_INSTALL_*`)
  - DB `status_reason` 저장값 → `snake_case` ✅ (`oauth_token_exchange_failed`, `install_timeout`, `auth_failed`)
  - 두 표기 분리의 의도적 근거가 DRAFT 2I Rationale에 명시되어 있어 규약 위반 아님.

---

### [INFO] Plan 문서 구조 및 ## Rationale 섹션 — 규약 준수
- `plan/in-progress/spec-draft-cafe24-pending-polish.md` frontmatter (`worktree`, `started`, `owner`) ✅ CLAUDE.md 플랜 규약 준수
- DRAFT 2I의 `## Rationale` 신설 → CLAUDE.md 3섹션 권장 구조 준수 ✅

---

## 요약

draft 전반은 정식 규약을 잘 따르고 있다. 에러 코드 표기(UPPER_SNAKE_CASE / snake_case 이중 정책)·문서 구조·마이그레이션 참조 모두 규약 범위 내다. 시정이 필요한 항목은 두 가지다: (1) `resource_not_found`를 DRAFT 3B pending_install 후보에서 제거해 DRAFT 1C/2G와 정합 확보, (2) `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`를 swagger 규약에 맞게 400 → 409로 변경.

## 위험도

**LOW** — CRITICAL 없음. WARNING 2건 모두 수정 범위가 좁고 설계 의도 자체는 명확하다. 수정 후 spec 적용 진행 가능.