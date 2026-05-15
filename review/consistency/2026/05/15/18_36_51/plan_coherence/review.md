# Plan 정합성 Review — spec-draft-brand-refresh

**검토 대상**: `plan/in-progress/spec-draft-brand-refresh.md`
**worktree**: `brand-refresh-7a3f12`
**검토 일시**: 2026-05-15

---

### 발견사항

- **[INFO]** `spec/2-navigation/` 동일 디렉토리 내 동시 수정 — 파일 레벨 충돌 없음
  - target 위치: `## Stage 1 동기화 대상` → S1-A (`spec/2-navigation/_layout.md`), S1-B (`spec/2-navigation/10-auth-flow.md`)
  - 관련 plan: `plan/in-progress/cafe24-app-url-3rdparty-shorten.md` Phase 3 (worktree: `cafe24-3rdparty-url-503aa0`) — `spec/2-navigation/4-integration.md` 수정 진행 중
  - 상세: brand-refresh 가 수정하는 `_layout.md`·`10-auth-flow.md` 와 cafe24 plan 이 수정하는 `4-integration.md` 는 **서로 다른 파일**이므로 git merge 충돌 위험은 없다. 그러나 두 plan 이 같은 `spec/2-navigation/` 하위에서 동시 진행 중이라는 사실을 integration PR 리뷰·merge 시 주의해야 한다.
  - 제안: 별도 조치 불필요. merge-coordinator 가 두 branch 통합 시 `spec/2-navigation/` 영역 변경 목록을 교차 확인하면 충분.

- **[INFO]** Stage 2 plan(`brand-refresh-impl.md`) 미존재 — 선행 조건 아님, 원자적 생성 예정
  - target 위치: `## 다음 액션` 3항 — "Stage 2 plan 없이 본 draft 만 complete 로 이동 금지"
  - 관련 plan: 없음 (아직 미생성)
  - 상세: target 스스로 `brand-refresh-impl.md` 를 이 draft 와 원자적으로 생성하도록 명시하고 있으므로, 현재 미존재는 계획된 상태다. 다만 Stage 2 plan 생성 전에 본 draft 가 실수로 `plan/complete/` 로 이동되는 사고를 방지하기 위해, 이 조건이 plan 내에 이미 명기되어 있음을 확인.
  - 제안: target plan 의 "다음 액션 3항" 준수로 충분. 추가 조치 불필요.

- **[INFO]** `spec/2-navigation/10-auth-flow.md` 배경색 정의 — 다른 plan 과의 충돌 없음 확인
  - target 위치: S1-B — "배경: 제품 브랜드 색상 또는 그래디언트" → `soil-50` 단색으로 변경
  - 관련 plan: `plan/in-progress/2fa-webauthn.md` — `spec/5-system/1-auth.md` 와 `spec/2-navigation/9-user-profile.md` 를 수정할 예정이나, `10-auth-flow.md` 는 범위 외임을 확인
  - 상세: WebAuthn plan 의 "5. spec / PRD 갱신" 항목 중 `spec/2-navigation/9-user-profile.md` 수정이 포함되어 있으나 `10-auth-flow.md` 는 포함되지 않는다. 충돌 없음.
  - 제안: 추적 메모 수준. brand-refresh Stage 1 적용 후 WebAuthn plan 이 인증 화면(10-auth-flow.md) 을 참조할 경우 신 배경색(`soil-50`) 을 그대로 사용하면 됨.

---

### 요약

`plan/in-progress/spec-draft-brand-refresh.md` (worktree: `brand-refresh-7a3f12`) 는 진행 중인 다른 plan 들과 실질적인 충돌이 없다. `spec/6-brand.md`, `spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md` 를 대상으로 하는 이번 변경은 현재 활성 worktree 들(`cafe24-3rdparty-url-503aa0`, `cafe24-data-model-strengthen-464de9`, `ai-review-subagent-b7c8d9`)이 다루는 파일 영역과 겹치지 않는다. `spec/2-navigation/4-integration.md` 를 수정 중인 cafe24 plan 과 동일 디렉토리를 공유하지만 파일 수준 충돌은 없다. 미해결 결정 우회, 중복 작업, 선행 plan 미해소 항목은 발견되지 않았다. Stage 2 plan 미존재는 target plan 자체가 원자적 생성을 명시한 계획된 상태다.

### 위험도

NONE
