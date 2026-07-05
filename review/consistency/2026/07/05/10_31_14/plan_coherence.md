# Plan 정합성 검토 — spec-draft-auth-webauthn-list-format.md

## 검토 범위

- Target: `plan/in-progress/spec-draft-auth-webauthn-list-format.md` (spec draft, `--spec` 모드)
- 변경 대상 spec: `spec/5-system/1-auth.md` (line 469 응답 포맷 정정), `spec/5-system/2-api-convention.md` (§5.2 후 note 추가 + Rationale subsection 추가)
- 대조 대상: `plan/in-progress/**` 전체 68개 문서 (webauthn/api-convention/auth 관련 항목 grep + 개별 확인)

## 발견사항

없음 (CRITICAL/WARNING 없음).

### 정합성 확인 근거 (참고용 INFO)

- **exec-intake 후속과의 연결 정합** — `plan/in-progress/exec-intake-followups.md` §"exec-engine 무관 (별도 트랙)" (25행)이 "auth Critical 2건(초대 에러코드 casing·WebAuthn 응답 포맷)"을 명시적으로 "project-planner 트랙으로 위임"해 둔 상태이며, target draft 는 정확히 이 위임을 이행하는 문서다. target 의 체크리스트 4번째 항목("followups auth Critical 2건 close 반영 + memory")이 이 후속 checkbox 를 닫는 작업을 스스로 계획하고 있어 후속 항목 처리가 draft 내에 이미 반영돼 있다.
- **미해결 결정과의 충돌 없음** — `plan/in-progress/spec-sync-auth-gaps.md` (auth spec 의 `pending_plans` 유일 항목)는 LDAP/SAML 미구현 surface 만 추적하며 WebAuthn 응답 포맷과 무관. target 이 다루는 이슈는 이 plan 의 범위 밖이고 충돌하는 결정도 없다.
- **선행 조건 검증** — target 이 인용하는 `1-auth.md` line 469 의 기존 텍스트(`[{...}]` bare array)와 `2-api-convention.md` §5.2 (페이징 전용, pass-through 메커니즘 note 포함)의 현재 위치·문구를 코드베이스에서 직접 대조 확인했다. draft 가 전제하는 "삽입 위치"(§5.2 pagination note 문단 뒤, §5.3 앞)와 "line 469 현재 텍스트"가 실제 파일과 정확히 일치 — 선행 조건이 이미 충족된 상태다.
- **frontmatter `pending_plans` 정합** — `1-auth.md` 는 `status: partial` 로 `pending_plans: [spec-sync-auth-gaps.md]` 를 가지나, target draft 는 "미구현 surface" 가 아닌 기존 구현과 spec 텍스트 간의 정정이므로 `pending_plans` 편입 대상이 아니다(`spec/conventions/spec-impl-evidence.md` §3: `pending_plans` 는 미구현 surface 책임 plan 전용). `2-api-convention.md` 는 `status: implemented` 로 애초에 `pending_plans` 대상이 아니다. 두 frontmatter 모두 갱신 불요 — 규약과 일치.
- **후속 항목 무효화 없음** — draft 가 "결정: 신설 아님/변경 아님, 이미 존재하는 계약을 spec 텍스트로만 추인"하는 방향이라 다른 in-progress plan 의 후속 항목을 무효화하거나 새로 만들 필요가 없다. `§5.2`/`bare-array`/`Option B` 관련 문자열을 다른 67개 in-progress 문서 전체에서 grep 했으나 draft 자신 외에는 참조·의존이 전혀 없다 — 병행 진행 중인 다른 작업이 이 결정의 반대 방향(bare-array 정규화)을 가정하고 있지 않음을 확인.

## 요약

Target spec draft 는 `exec-intake-followups.md` 가 명시적으로 위임해 둔 "auth Critical 2건" 중 WebAuthn 응답 포맷 이슈를 다루며, 그 위임의 존재와 범위를 draft 본문이 스스로 인용·계승하고 있다. 변경 내용(코드 현황 추인 + spec 텍스트 정정, Option B 는 명시적 defer)은 다른 in-progress plan 의 미해결 결정과 충돌하지 않고, 전제하는 spec 텍스트 위치·현재 문구도 실제 파일과 일치해 선행 조건이 이미 충족돼 있다. frontmatter `pending_plans` 처리도 규약(spec-impl-evidence.md §3)과 정합하며, 다른 어떤 in-progress 문서도 이 결정과 반대되는 전제(bare-array 정규화 등)를 세우고 있지 않아 후속 항목 누락도 없다.

## 위험도

NONE
