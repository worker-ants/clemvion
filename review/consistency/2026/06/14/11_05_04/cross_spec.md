# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/2-navigation/6-config.md`
검토 일시: 2026-06-14

---

## 발견사항

### [INFO] `action='auth_config.reveal'` 표기 방식 — 문자열 리터럴 vs 규약 표기

- target 위치: `spec/2-navigation/6-config.md` §A.4 Reveal 흐름 5번 항목 (line 119)
- 충돌 대상: `spec/conventions/audit-actions.md §3 도메인별 분류 레지스트리`
- 상세: config spec 은 `action='auth_config.reveal'` 로 SQL 문자열 할당 형태로 표기한다. conventions 와 `spec/5-system/1-auth.md §4.1` 은 `auth_config.reveal` (따옴표 없음, 규약 표기) 로 기술한다. 두 표기가 가리키는 값은 동일하지만, 표기 스타일 혼용이 spec 독자에게 혼동을 줄 수 있다.
- 제안: target §A.4 Reveal 흐름 5번을 `audit_log 에 action = auth_config.reveal 기록` 또는 `audit_log 에 \`auth_config.reveal\` 액션 기록` 형태로 정렬 권장. 기능 충돌 없음.

---

### [INFO] Auth Config 편집 폼(PATCH) 미구현 상태가 API 표와 괴리 — spec 내 현황 주석과 API 표 불일치

- target 위치: `spec/2-navigation/6-config.md` §3 Authentication API 표 (`PATCH /api/auth-configs/:id`)와 §A.2 구현 현황 주석 (line 55)
- 충돌 대상: 없음 (spec 내부 일관성 문제). `plan/in-progress/spec-sync-config-gaps.md` §미구현 마지막 항목
- 상세: §A.2 구현 현황 주석은 "생성 후 편집 폼은 별도 — 현 UI 는 생성·토글·재생성·삭제만 제공"으로 편집 폼 미구현을 명시한다. §3 API 표에는 `PATCH /api/auth-configs/:id`가 구현 상태 표시 없이 기재되어 있다. 본 worktree(`config-auth-edit-form-7a5631`)가 편집 폼을 구현하는 작업이므로 구현 후에는 API 표와 현황 주석이 자동으로 정합해진다. 구현 전 상태에서는 API 표의 `PATCH` 항목에 미구현 표시가 없어 구현 완료 여부가 불분명하다.
- 제안: 구현 완료 시 §A.2 구현 현황 주석의 괄호 부분을 `(편집 폼 포함 ✅ 구현)`으로 갱신하면 정합된다. 기능 충돌 아님.

---

### [INFO] Model Config API 표 — `PATCH /api/model-configs/:id/set-default` 의 HTTP 메서드

- target 위치: `spec/2-navigation/6-config.md` §3 Model Config API 표 (line 277)
- 충돌 대상: 없음 (타 spec 과 충돌 없음). 단, RESTful 규약 측면 메모
- 상세: `set-default` 는 상태 변경(비멱등)이나 `PATCH` 로 기술되어 있다. `spec/5-system/2-api-convention.md` 에는 이 패턴에 대한 명시 금지·허용 규칙이 없으며, 구현 코드도 이미 `PATCH` 를 사용한다. 다른 spec 영역과의 직접 충돌은 없다.
- 제안: 현 상태 유지. 기능 충돌 없음.

---

### [INFO] Auth Config mutation 권한 — API 표에 명시적 권한 표기 부재

- target 위치: `spec/2-navigation/6-config.md` §3 Authentication API 표 (lines 258–265)
- 충돌 대상: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스` (Auth Config: Owner/Admin = CRUD, Editor/Viewer = R)
- 상세: Model Config API 표(line 269)는 "mutation (POST / PATCH / DELETE) 은 Editor+"를 명시하는 반면, Authentication API 표에는 mutation 권한에 대한 명시적 표기가 없다. auth spec §3.2 에서 Auth Config CRUD 는 Admin+ (Owner·Admin) 로 정의되어 있어, 구현자가 API 표만 보면 권한 기준을 놓칠 수 있다. 두 spec 간 충돌은 아니지만 Auth Config API 표에 권한 주석이 누락된 상태다.
- 제안: Authentication API 표 위에 "mutation (POST / PATCH / DELETE) 은 Admin+ ([Spec 인증 §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스)). 조회는 Viewer 이상." 한 줄 추가. Model Config 표 형식과 대칭. 기능 충돌 없음.

---

## 요약

`spec/2-navigation/6-config.md` 는 데이터 모델(`spec/1-data-model.md §2.16-2.17`), 인증/인가 규약(`spec/5-system/1-auth.md §3.2`, `§4.1`), 감사 액션 규약(`spec/conventions/audit-actions.md`), Webhook 연동(`spec/5-system/12-webhook.md`) 과 전반적으로 정합하며, CRITICAL 또는 WARNING 수준의 충돌은 발견되지 않았다. AuthConfig / ModelConfig 엔티티 정의·API shape·마스킹 정책·RBAC 매트릭스·비밀 값 prefix 규칙이 각 영역 spec 과 일치한다. INFO 수준 3건은 표기 스타일 통일 및 API 표 권한 주석 보완에 관한 것으로, 기능 동작에는 영향 없다. 본 worktree(`config-auth-edit-form-7a5631`)가 Auth Config 편집 폼을 구현하는 맥락에서, 구현 완료 후 §A.2 구현 현황 주석만 갱신하면 spec 내부 표현이 완전히 정합된다.

## 위험도

NONE
