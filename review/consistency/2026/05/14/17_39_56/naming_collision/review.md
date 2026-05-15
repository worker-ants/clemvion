naming_collision 검토가 이미 `review/consistency/2026-05-14_17-31-24/` 세션에서 완료되어 있습니다. 마이그레이션 버전도 확인했습니다.

---

## Naming Collision Check 결과

**검토 대상**: `plan/in-progress/spec-draft-cafe24-pending-polish.md`

### 주요 발견사항

**[WARNING] `CAFE24_INSTALL_INVALID_HMAC` — 동일 식별자, 의미 범위 축소**
- 기존: "HMAC 불일치 **또는 pending 미발견**" 합산 (정보 노출 방지)
- Draft: "HMAC 불일치만" (403) / "토큰 미존재" → `CAFE24_INSTALL_INVALID_TOKEN` (404) 분리
- 기존 테스트가 이 에러 코드를 "token not found" 경로에서도 assert한다면 회귀 발생
- **제안**: 구현 착수(변경 2) 전 관련 테스트에서 `CAFE24_INSTALL_INVALID_HMAC`를 "미발견" 케이스에 assert하는 코드 grep 확인 필요

**[INFO] `카테고리` — `Node.category`와 맥락 혼동 가능성**
- Cafe24 UI grouping "카테고리" vs `spec/1-data-model.md §2.6` Node.category (logic/flow/ai/…)
- Draft가 이미 `cafe24-api-metadata.md §6`에 용어 정의 주석 추가 예정 → mitigated

**[INFO] queue message `reason` 필드 신설**
- 기존 `{ integrationId }` → `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }`
- 명명 충돌 없음, schema 확장 이슈 (consumer 하위 호환 처리 필요)

### 마이그레이션 버전 확인 결과

Draft가 `V041` / `V042`를 참조하는데, **실제로 두 파일이 이미 존재**합니다:
- `V041__integration_oauth_state_provider_meta.sql` ✓ (provider_meta 컬럼 — DRAFT 3D와 정합)
- `V042__cafe24_private_app_pending_install.sql` ✓ (install_token 컬럼 — DRAFT 1B와 정합)

명명 충돌 없음.

---

### 요약

Draft의 신규 식별자(`install_token`, `pending_install`, `CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_LEGACY_PATH`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`, 각 `status_reason` 값들)는 기존 corpus에서 다른 의미로 사용 중인 사례가 없습니다. 유일한 주의 지점은 `CAFE24_INSTALL_INVALID_HMAC`의 의미 축소이며 Draft Rationale에서 이미 명시적으로 인정하고 있습니다.

### 위험도: **LOW**