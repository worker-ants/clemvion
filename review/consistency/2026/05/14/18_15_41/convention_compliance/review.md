`spec/conventions/swagger.md` §2-4 확인 완료. 4개 convention 파일 모두 검토했습니다.

---

## Convention Compliance Check — 결과

**대상**: `plan/in-progress/spec-draft-cafe24-pending-polish.md`
**모드**: spec draft 검토 (`--spec`)

---

### 발견사항

- **[INFO]** Convention 파일 수정이 spec 패치에 혼재
  - target 위치: DRAFT 2H — "`spec/conventions/cafe24-api-metadata.md §6` 첫 단락 inline 보강 (I10)"
  - 위반 규약: 직접 위반 아님 — CLAUDE.md의 "단일 진실 원칙" 및 convention 파일 성격
  - 상세: `spec/conventions/cafe24-api-metadata.md`는 다른 모든 spec 에서 참조하는 정식 규약 파일이다. 본 draft는 spec 파일 5개 패치와 함께 이 규약 파일도 수정 제안하고 있어, 리뷰어가 "spec 변경" 과 "규약 변경" 을 구분 없이 일괄 적용할 위험이 있다. 내용 자체("UI grouping 단위 = 카테고리")는 기존 §6 본문과 완전히 일관하는 명시 추가이므로 의미 충돌은 없다.
  - 제안: 규약 파일 수정을 별도 커밋(또는 별도 draft 항목)으로 분리하거나, draft 상단에 "규약 파일 수정 포함: `spec/conventions/cafe24-api-metadata.md §6`" 을 명시해 리뷰어가 인식하도록 표기.

---

- **[INFO]** Swagger §2-4 표에 없는 410 Gone 사용
  - target 위치: DRAFT 2E — `GET /api/integrations/oauth/install/cafe24` Deprecated 항 / DRAFT 2F — `CAFE24_INSTALL_LEGACY_PATH (410)`
  - 위반 규약: `spec/conventions/swagger.md §2-4` (상태 코드 응답 규칙 표)
  - 상세: §2-4 표는 200/201/204/400/401/403/404/409 를 열거하며 410 은 없다. `@nestjs/swagger` 에 `@ApiGoneResponse` 데코레이터가 없으므로 구현 시 `@ApiResponse({ status: 410 })` 를 수동 지정해야 한다. 표가 exhaustive 하지 않으므로 직접 위반은 아니지만, convention 표에 없는 코드를 사용할 경우 구현자 명시가 필요하다.
  - 제안: spec §9.2 deprecated 항에 "(구현 시 `@ApiResponse({ status: 410 })` 수동 지정 — swagger §2-4 표 외 코드)" 한 줄 구현 노트 추가. 또는 swagger.md §2-4 에 "410 Gone → 폐기된 경로" 행을 추가해 규약을 확장.

---

- **[INFO]** Rationale cross-reference 의 review session 타임스탬프 실재 불명확
  - target 위치: DRAFT 2I `## Rationale` — "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나" 단락 끝 `(참고: review/consistency/2026-05-14_16-48-25)`
  - 위반 규약: 직접 위반 아님
  - 상세: 현재 worktree git status 에 나타나는 consistency review 디렉토리는 `2026-05-14_17-00-12` 부터 시작한다. `16-48-25` 는 이 worktree 에 존재하지 않는 타임스탬프다. 이전 세션/worktree 산출물일 수 있으며, 링크가 빈 경로를 가리킬 가능성이 있다.
  - 제안: spec 적용 전 `review/consistency/2026-05-14_16-48-25/` 실재 여부 확인. 없으면 참조 링크 제거 또는 `2026-05-14_17-00-12` 로 대체.

---

### Critical/Warning 수준 위반 없음

- **API 에러 코드 명명** (`CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_INVALID_HMAC`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 등) — `UPPER_SNAKE_CASE` 완전 준수 (node-output Principle 3.2 ✅)
- **DB `status_reason` 명명** (`oauth_token_exchange_failed`, `install_timeout` 등) — `snake_case` 의도적 분리, Rationale 에 명시 ✅
- **409 근거** — swagger §2-4 표 "409 중복/충돌 → `@ApiConflictResponse`" 확인, draft 의 참조 정확 ✅
- **`## Rationale` 섹션 신설** — CLAUDE.md 권장 3섹션 구조(Overview / 본문 / Rationale) 준수 ✅
- **마이그레이션 V번호 참조** (V041 `provider_meta`, V042 `install_token`) — spec 이 기존 migration 을 cross-reference 하는 것으로 migration convention 적용 범위 외 ✅
- **`cafe24-api-metadata.md §6` "카테고리" 용어** — 기존 §6 본문과 일관, 명시 추가만임 ✅

### 요약

본 draft 는 4개 정식 규약 모두와 실질적인 충돌 없이 작성됐다. 에러 코드 포맷, HTTP 상태코드 분류, 문서 구조 모두 convention 을 준수하며, swagger §2-4 의 409 근거도 확인됐다. 지적 사항은 (a) 규약 파일 수정이 spec 패치에 묻혀 있다는 구조적 명시 부재, (b) 410 Gone 의 swagger 표 미등재로 인한 구현 시 수동 처리 필요, (c) Rationale 의 review 링크 타임스탬프 실재 확인의 세 INFO 로 한정된다.

### 위험도

**LOW** — Critical/Warning 수준 위반 없음. 채택 차단 없음.