# 신규 식별자 충돌 검토

검토 범위: `spec/5-system/` impl-done 후 갱신 (diff-base: origin/main)

대상 변경 파일:
- `spec/5-system/1-auth.md` — Rationale §1.5.D 신설, §1.5.1 Rate Limit 확정값 기술
- `spec/1-data-model.md` — User 엔티티 필드 11개 추가
- `spec/data-flow/1-audit.md` — `userId` 필터 추가, 권한 기술 갱신
- `spec/data-flow/15-external-interaction.md` — 승격 경로 갭 해소 기술

---

## 발견사항

### 발견사항 없음

모든 신규 식별자를 점검한 결과 충돌이 없다. 항목별 근거:

**1. Rationale ID `1.5.D`**
- target 신규 식별자: `spec/5-system/1-auth.md` Rationale 절 `### 1.5.D — 워크스페이스 초대 토큰을 raw 로 저장하는 이유`
- 기존 점검: origin/main 의 1-auth.md Rationale 에는 `1.5.A`, `1.5.B`, `1.5.C`, `1.4.A`~`1.4.I`, `2.3.A` 가 존재한다. `1.5.D` 는 main 에 없음 — 새 ID.
- 판정: 충돌 없음.

**2. User 엔티티 필드 11개 (`spec/1-data-model.md` §2.1)**
신규 추가 필드: `email_verified`, `email_verify_token`, `email_verify_expires_at`, `password_reset_token`, `password_reset_expires_at`, `login_attempts`, `locked_until`, `oauth_provider`, `oauth_provider_id`, `notification_preferences`, `password_hash` nullable 변경.
- `email_verify_token` / `email_verify_expires_at` / `login_attempts` / `locked_until` / `oauth_provider` / `oauth_provider_id`: `spec/data-flow/2-auth.md` 에서 이미 동일 snake_case 이름으로 사용 중이며 의미도 동일 (기존 코드 구현 반영 동기화). 의미 충돌 없음.
- `notification_preferences`: `spec/data-flow/8-notifications.md` 에서 `user.notification_preferences JSONB (V010)` 으로 이미 참조 중. 데이터 모델 표에 공식화된 것이며 의미 동일. 충돌 없음.
- `password_reset_token`: 1-auth.md §1.1 본문에서 `passwordResetToken` (camelCase) 로 참조하나, 이는 TypeORM entity 의 camelCase property 명(DB 컬럼: `password_reset_token`)이며 data-model.md 는 DB 컬럼(snake_case) 기준 표기. 동일 필드의 두 표기 혼재는 기존 spec 전체 관행과 일치 — 충돌 없음.

**3. `userId` 쿼리 파라미터 (`spec/data-flow/1-audit.md` §2.1)**
- target 신규 식별자: `GET /api/audit-logs` 필터에 `userId`(행위자) 추가.
- `userId` 는 spec 전역에서 "사용자 UUID" 의미로 일관 사용됨. audit 필터 컨텍스트에서 다른 의미로 쓰이는 기존 정의 없음. 충돌 없음.

**4. `INVITATION_THROTTLE` (코드 상수명, spec 내 참조)**
- `spec/5-system/1-auth.md` §1.5.1 에 `workspaces.controller.ts` `INVITATION_THROTTLE` 상수명 언급.
- `spec/data-flow/12-workspace.md` 에 동일 상수명이 이미 동일 의미(분당 10건 throttle)로 기술. 추가된 spec 기술이 기존 data-flow 정의와 동일 값·동일 의미 — 충돌 없음.

**5. API 엔드포인트**
- 이번 변경에서 신규 API 엔드포인트가 추가되지 않음.

**6. 환경변수·설정키**
- 이번 변경에서 신규 ENV var 또는 config key가 도입되지 않음.

**7. WebSocket 이벤트·파일 경로**
- 이번 변경에서 신규 이벤트명 또는 spec 파일 경로가 추가되지 않음.

---

## 요약

`spec/5-system/` 보안 fix(V-03 audit guard, C3 secret rotation) 에 수반된 spec 갱신이 도입하는 신규 식별자는 Rationale `1.5.D`, User 필드 11개(기존 구현 동기화), `userId` 필터 파라미터, `INVITATION_THROTTLE` 참조 4종이다. 모두 기존 사용처와 의미가 일치하거나 완전히 신규 ID 이며, 다른 의미로 이미 사용 중인 식별자와의 충돌이 발견되지 않았다.

## 위험도

NONE
