# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
Target: `spec/5-system/` (주요 관심 영역: `1-auth.md §1.1.B` 이메일 변경 흐름 신규 추가)
관련 spec 변경 범위 (vs origin/main):
- `spec/5-system/1-auth.md` — §1.1.B 이메일 변경 흐름 전체, §2.3 이메일 변경 시 처리, §4.1/§4.3/§5 포인터
- `spec/1-data-model.md` — User 엔티티에 `pending_email`, `email_change_token`, `email_change_expires_at` 추가
- `spec/2-navigation/9-user-profile.md` — §6.1 4개 엔드포인트 + pendingEmail GET 추가
- `spec/conventions/audit-actions.md` — `user.email_changed` 등록
- `spec/data-flow/1-audit.md` — `user.email_changed` 구현 행 추가
- `spec/data-flow/2-auth.md` — §1.7.1 이메일 변경 흐름 + Schema 매핑 행 추가

---

## 발견사항

### INFO-1 — `verifyReauth` vs `reauthenticate` 메서드명 불일치

- **target 위치**: `spec/5-system/1-auth.md §1.1.B` (line 76) 및 Rationale 1.1.B-4 (line 508)
- **충돌 대상**: `spec/data-flow/2-auth.md §1.7.1` (신규 추가), `codebase/backend/src/modules/auth/sessions.service.ts`
- **상세**: `1-auth.md §1.1.B` 는 이메일 변경 재인증 구현을 "세션 강제 종료와 동일한 `SessionsService.verifyReauth`(password OR TOTP) 를 재사용한다" 고 명시하지만, 실제 구현에서 `verifyReauth` 는 `sessions.service.ts` 의 **private** 메서드다. 외부에 노출된 **public** 메서드는 `reauthenticate`이며, 이것이 `auth.service.ts` 에서 이메일 변경 재인증에 호출된다. `data-flow/2-auth.md §1.7.1` 에는 `SessionsService.reauthenticate` 로 올바르게 기술돼 있어, spec 내부에서 서로 다른 이름을 지칭한다.
- **제안**: `spec/5-system/1-auth.md §1.1.B` 와 Rationale 1.1.B-4 의 `SessionsService.verifyReauth` 를 `SessionsService.reauthenticate`(또는 "재인증 public API") 로 정정. verifyReauth 는 내부 구현 헬퍼임을 명시하거나 언급을 제거.

---

### INFO-2 — `user.email_changed` 감사 액션 상태: audit-actions.md 에 "구현"으로 등재됐으나 1-auth.md §4.1 에서 "Planned" 기술과 혼재

- **target 위치**: `spec/5-system/1-auth.md §4.1` 의 "현재 구현된 액션" 표
- **충돌 대상**: `spec/conventions/audit-actions.md` 의 `user` 네임스페이스 행 (email_changed 포함 "구현"), `spec/data-flow/1-audit.md §1.1`
- **상세**: `spec/conventions/audit-actions.md` 의 `user | 과거분사 | password_changed, 2fa_enabled, 2fa_disabled, email_changed | 구현` 으로 4개 모두 "구현" 상태로 등재돼 있다. `data-flow/1-audit.md` 도 `user.email_changed` 를 구현된 것으로 기술한다. 그런데 `1-auth.md §4.1` 의 "현재 구현된 액션" 표에는 `user.email_changed` 가 누락돼 있고, "Planned (미구현)" 표에도 포함돼 있지 않다 — 즉 1-auth.md §4.1 은 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 만 나열하고 `user.email_changed` 를 제외하고 있다. 단, §4.1 의 인라인 각주 `user.email_changed`(이메일 변경 확인 `POST /users/me/email-change/verify`, §1.1.B) 에서 언급은 되므로 완전 누락은 아니다.
- **제안**: `spec/5-system/1-auth.md §4.1` 의 "현재 구현된 액션" 인증 카테고리 행에 `user.email_changed` 를 명시적으로 추가해 audit-actions.md 및 data-flow/1-audit.md 와 일치시킨다. 각주 내 언급만으로는 일관성이 부족하다.

---

### INFO-3 — `data-flow/2-auth.md §1.7.1` 섹션 레벨: "####" vs 부모 "###" 의 레벨 불일치 없음 (정상), 단 제목 번호 "1.7.1" 이 문서 전체 구조에서 처음 4-depth 부절 도입

- **target 위치**: `spec/data-flow/2-auth.md §1.7.1` (신규 추가)
- **충돌 대상**: `spec/data-flow/2-auth.md` 기존 구조 (`### 1.1` ~ `### 1.7` 모두 `###` 3-depth)
- **상세**: 기존 `data-flow/2-auth.md` 의 모든 1.x 절은 `### 1.x` (3-depth) 수준이었다. 새로 추가된 `#### 1.7.1` 은 4-depth 부절을 처음 도입한다. 동일 문서에서 `### 1.7 비밀번호 재설정 · 이메일 보조 엔드포인트` 하위에 `#### 1.7.1 이메일 변경` 을 두는 것은 구조적으로 타당하나, 다른 1.x 절들(`### 1.1`~`### 1.6`)은 부절 없이 단일 섹션으로 돼 있어 스타일 비일관성이 생긴다.
- **제안**: 문서 구조 일관성을 위해 `1.7.1` 을 `### 1.8` 로 독립 절로 승격하거나, 또는 `1.7` 을 리스트 형태로 재조직. 기능 동작에 영향은 없음.

---

## 요약

Cross-Spec 일관성 관점에서 이메일 변경 흐름(`spec/5-system/1-auth.md §1.1.B`) 추가는 `spec/1-data-model.md` 의 User 엔티티 필드 정의, `spec/2-navigation/9-user-profile.md` 의 API endpoint 표, `spec/conventions/audit-actions.md` 와 `spec/data-flow/1-audit.md` 의 감사 액션 등록과 전반적으로 정합하게 연결돼 있다. 데이터 모델 충돌, API 계약 충돌, 상태 전이 충돌, RBAC 충돌은 식별되지 않는다. 발견사항 3건 모두 INFO 수준이다: (1) `verifyReauth`(private) vs `reauthenticate`(public) 의 메서드명 혼용은 spec 내 기술 정확성 문제이며 설계 자체와는 충돌하지 않는다. (2) `user.email_changed` 가 audit-actions.md · data-flow/1-audit.md 에는 "구현"으로 등재됐으나 1-auth.md §4.1 의 "현재 구현된 액션" 표 본문에 명시되지 않은 비일관성이 있다. (3) data-flow 문서에 4-depth 부절이 처음 도입됐으나 구조적 충돌은 아니다. Critical·WARNING 발견 없음.

## 위험도

NONE
