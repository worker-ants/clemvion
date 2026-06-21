### 발견사항

- **[INFO]** `spec-draft-email-change.md` 미완료 체크박스 — 구현 위임 단계 대기 중
  - target 위치: `spec/5-system/1-auth.md §1.1.B` 전체, `spec/2-navigation/9-user-profile.md §6.1`, `spec/1-data-model.md §2.1`, `spec/conventions/audit-actions.md §3`, `spec/data-flow/1-audit.md §1.1`
  - 관련 plan: `plan/in-progress/spec-draft-email-change.md` 다음 단계 5번 (`[ ] spec PR → merge 후 별도 PR 로 developer 구현 위임`)
  - 상세: spec 문서 반영(단계 1~4)은 완료됐고, target spec 의 `§1.1.B` 이메일 변경 흐름이 draft plan 의 설계와 정합한다. 단계 5(developer 구현 위임)는 spec PR merge 이후의 후속 작업이므로 현재 open 상태가 정상이다.
  - 제안: 조치 불요. spec PR merge 후 developer 구현 track 착수 시 plan 체크.

- **[INFO]** `refactor-auth-reverify-unify.md` 범위 밖/후속 spec 갱신 항목과 target 의 §2.3 "이메일 OTP" 문구
  - target 위치: `spec/5-system/1-auth.md §2.3` 강제 종료 재인증 행 (`이메일 OTP 로 대체`), Rationale `1.1.B-4`
  - 관련 plan: `plan/in-progress/refactor-auth-reverify-unify.md` 범위 밖/후속 항목 — `verifyReauth` 에러 코드 spec 등재, `data-flow/2-auth.md §1.2` bcrypt 추상화 반영 등
  - 상세: `refactor-auth-reverify-unify` 는 이미 모든 구현 체크박스가 완료됐고, 범위 밖/후속으로 남긴 spec 드리프트 정정(플래너 영역)이 아직 미수행이다. target spec 의 `§2.3` 재인증 행("이메일 OTP")은 해당 plan 이 "변경하지 않는다"고 명시한 그대로 보존돼 있어 충돌 없다. 단, plan 의 후속 spec 갱신 항목(`verifyReauth` 에러 코드 테이블, `1-auth.md §2` self-revoke 정책 명시, `data-flow/2-auth.md §1.2` 헬퍼 경로)은 target `spec/5-system/1-auth.md`에 반영되지 않은 채 plan 에 "defer" 로 남아 있다.
  - 제안: plan 에서 INFO 수준 defer로 분류된 항목이라 차단 불요. 하지만 `spec/5-system/1-auth.md §2` self-revoke 방지 정책(`400 CANNOT_REVOKE_CURRENT_SESSION`)이 spec 본문에 미반영된 상태임을 추적 메모로 유지할 것을 권장한다. plan 자체에 이미 기록돼 있으므로 별도 갱신 불요.

- **[INFO]** `auth-config-webhook-followups.md` §3 spec 보완 항목과 `spec/5-system/1-auth.md §5` 엔드포인트 표
  - target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` 표
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3` — "POST /api/auth-configs/:id/reveal 행 추가" 미수행 항목
  - 상세: target spec 의 §5 엔드포인트 표에 `POST /api/auth-configs/:id/reveal` 행이 여전히 없다. 이는 본 target 변경 이전부터 존재하던 갭이며, 이번 이메일 변경 spec 작업이 이 상황을 악화시키거나 새로 만든 것은 아니다. target 변경 전후로 상태가 동일하다.
  - 제안: 이 갭은 `auth-config-webhook-followups.md §3`(planner 영역)에서 추적 중이므로 본 target 에 대한 별도 조치 불요.

- **[INFO]** `spec-draft-email-change.md` pending_plans 미등재
  - target 위치: `spec/5-system/1-auth.md` frontmatter `pending_plans:`
  - 관련 plan: `plan/in-progress/spec-draft-email-change.md`
  - 상세: `1-auth.md` frontmatter 의 `pending_plans` 에 `auth-config-webhook-followups.md` 와 `spec-sync-auth-gaps.md` 만 있고, `spec-draft-email-change.md`(status: draft, 구현 미착수)는 등재되지 않았다. developer 구현이 시작되면 이 plan 도 auth.md 구현 상태와 관련되므로 등재가 자연스럽다.
  - 제안: spec PR merge 후 developer 구현 착수 시 `pending_plans` 에 `spec-draft-email-change.md` 추가를 고려한다. 현 spec 단계에서는 선택적 추적 메모.

### 요약

`spec/5-system/` 의 target spec(주로 `1-auth.md §1.1.B`)는 `plan/in-progress/spec-draft-email-change.md`에서 확정된 설계를 충실히 반영하고 있으며, 진행 중인 다른 plan 과의 결정 충돌은 없다. `refactor-auth-reverify-unify.md`가 "건드리지 않는다"고 명시한 §2.3 재인증 행을 그대로 보존했고, `spec-sync-auth-gaps.md`(LDAP/SAML 미구현 추적)·`auth-config-webhook-followups.md`(auth_config audit 후속)와도 충돌이 없다. 미해결 결정을 일방적으로 우회하거나, 선행 plan 이 미해소인 사전 조건을 이 spec 이 가정하는 케이스는 발견되지 않았다. 식별된 항목 전부 INFO 수준의 추적 메모이며 구현 착수에 차단이 없다.

### 위험도

NONE

STATUS: SUCCESS
