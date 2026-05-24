# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-prep`
- 대상 scope: `spec/5-system` (구현 착수 전)
- 관련 plan: `plan/in-progress/password-hash-format-guard.md`
- 검토일: 2026-05-24

---

## 발견사항

### [WARNING] `password_hash` 필드 nullable 표기 불일치

- **target 위치**: `spec/5-system/1-auth.md §1.1 비밀번호 저장` 행 — `user.password_hash 는 nullable — OAuth 단독 가입 사용자는 NULL`
- **충돌 대상**: `spec/1-data-model.md §2.1 User` 테이블 — `| password_hash | String | 비밀번호 해시 (bcrypt) |`
- **상세**: 데이터 모델 spec 의 `String` 타입 표기는 nullable 을 나타내지 않는다. 같은 파일에서 nullable 필드는 `String?` (물음표 접미) 로 표기하는 관례를 사용한다 (`avatar_url String?`, `two_factor_secret String?` 등 7개 필드가 동일 패턴). `password_hash` 는 `String` 으로만 기재되어 있어 NOT NULL 처럼 읽힌다. 그러나 `spec/5-system/1-auth.md §1.1` 은 "nullable", `spec/data-flow/2-auth.md` 는 `INSERT user (oauth_provider, oauth_provider_id, password_hash=NULL)` 로 명시하며, `codebase/backend/migrations/V001__initial_schema.sql:14` 의 `password_hash VARCHAR(255)` (NOT NULL 미지정), `codebase/backend/src/modules/users/entities/user.entity.ts:17` 의 `@Column({ name: 'password_hash', nullable: true, length: 255 })` 도 모두 nullable 을 채택하고 있다. 이 불일치로 인해 `spec/1-data-model.md` 만 읽은 독자는 password_hash 가 항상 채워져 있어야 한다고 오해할 수 있다.
- **제안**: `spec/1-data-model.md §2.1` 의 `password_hash | String` 을 `password_hash | String? | 비밀번호 해시 (bcrypt). OAuth 단독 가입 사용자는 NULL` 으로 갱신해 auth spec 과 정합성을 맞춘다. 본 구현(password-hash-format-guard) 은 `passwordHash !== null && !== undefined` 일 때만 검증을 수행하도록 plan 에 명시되어 있으므로, 구현 자체는 현행 설계와 일관된다. 다만 data model spec 의 부정확한 nullable 표기는 후속 구현자를 혼란시킬 수 있으므로 별도 project-planner 위임으로 정정 권장.

---

### [INFO] `spec/1-data-model.md §2.1 User` 에 오직 auth 에서만 사용되는 여러 필드가 누락

- **target 위치**: `spec/5-system/1-auth.md` 전반 (`oauth_provider`, `oauth_provider_id`, `email_verified`, `login_attempts`, `locked_until`, `password_reset_token` 등을 참조)
- **충돌 대상**: `spec/1-data-model.md §2.1 User` — 위 필드들이 데이터 모델 표에 등재되지 않음
- **상세**: `spec/1-data-model.md §2.1` 의 User 테이블은 `id`, `email`, `password_hash`, `name`, `avatar_url`, `locale`, `theme`, `two_factor_enabled`, `two_factor_secret`, `totp_recovery_codes`, `webauthn_recovery_codes`, `created_at`, `updated_at` 만 열거한다. 실제 엔티티(`user.entity.ts`) 와 V001 마이그레이션에는 `oauth_provider`, `oauth_provider_id`, `email_verified`, `email_verify_token`, `email_verify_expires_at`, `password_reset_token`, `password_reset_expires_at`, `login_attempts`, `locked_until`, `notification_preferences` 등 추가 컬럼이 존재하며 auth spec 곳곳에서 직접 참조된다. 본 password-hash-format-guard 구현에는 직접 영향이 없지만, data model SoT 가 불완전한 상태이므로 기록해 둔다.
- **제안**: data model spec 갱신은 본 PR 범위 밖. 별도 project-planner 위임으로 `spec/1-data-model.md §2.1` 에 auth 관련 컬럼을 추가하거나, 모델의 "core fields" 와 "auth-specific fields" 를 구분 기재하도록 보완하는 것을 검토한다.

---

### [INFO] `spec/5-system/1-auth.md` 에 entity-level bcrypt 포맷 검증(guard) 이 명문화되어 있지 않음

- **target 위치**: `spec/5-system/1-auth.md §1.1 비밀번호 저장` — `bcrypt (cost factor ≥ 12)` 만 기술, 저장 전 포맷 검증 의무 불기재
- **충돌 대상**: 없음 (기존 spec 과 모순은 아님)
- **상세**: plan (`password-hash-format-guard.md §Spec — 변경 없음`) 은 spec 추가 불필요라고 선언했다. 그 근거는 "기존 auth spec 의 nullable invariant 를 entity-level 에서 강제할 뿐"이라는 것이다. 이 판단 자체는 타당하다. 단, 향후 auth 영역 리뷰어가 `@BeforeInsert` / `@BeforeUpdate` 훅에 의존해 포맷이 강제됨을 spec 만 보고 알기 어렵다는 점은 INFO 로 기록한다. spec 에 "application entity hook 으로 강제" 한 줄을 Rationale 에 추가하면 구현 의도가 명확해진다. 필수는 아님.
- **제안**: 선택 사항. `spec/5-system/1-auth.md §1.1` 의 `비밀번호 저장` 행 설명에 "저장 전 `User` entity hook(`@BeforeInsert`/`@BeforeUpdate`) 이 bcrypt 포맷(`$2[aby]$dd$...`) 을 검증한다" 한 줄을 추가하거나, Rationale 절에 기재하면 충분하다.

---

## 요약

`spec/5-system` 의 auth spec(`1-auth.md`) 은 내부적으로 일관성이 있다. Cross-spec 관점에서 유일하게 실질적인 불일치는 `spec/1-data-model.md §2.1` 의 `password_hash` 필드가 nullable 임을 표기하지 않는다는 점이다. 이는 auth spec·data-flow spec·코드베이스 세 곳이 nullable 을 전제하는 것과 어긋난다. 본 구현(password-hash-format-guard) 은 `null/undefined` 를 통과시키도록 plan 에 명확히 기술되어 있으므로 구현 차단 사유는 아니다. 단, 데이터 모델 SoT 의 부정확한 표기는 별도 project-planner 위임으로 정정할 것을 권장한다. API 계약·요구사항 ID·상태 머신·RBAC·계층 책임 관점에서는 충돌 없음.

## 위험도

LOW

---

STATUS: SUCCESS
