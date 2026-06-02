# Plan 정합성 검토 결과

검토 모드: `--impl-prep`  
Target: `spec/2-navigation/` (전체)  
검토 일시: 2026-06-02

---

## 발견사항

### [INFO] cafe24-install-ratelimit-2891d1 — 동일 파일 다른 섹션 수정 중

- **target 위치**: `spec/2-navigation/4-integration.md` (target plan 의 구현 의존 spec)
- **관련 plan**: 없음 (plan 파일이 별도로 없으나 worktree `cafe24-install-ratelimit-2891d1` 가 해당 파일 수정 중)
- **상세**: `cafe24-install-ratelimit-2891d1` branch 가 `spec/2-navigation/4-integration.md` 의 API 표 (~line 734, 781) 와 Rationale section (~line 1172+) 에 install endpoint rate limiting 내용을 추가·수정하고 있다. target plan (`cafe24-oauth-invalid-scope`) 이 구현할 내용은 `§10.4 에러 매핑` (~line 844-852) — 이미 spec 에 완전히 명세되어 있고 target plan 은 "코드만; spec 이미 명세" 로 명시하여 spec 파일을 수정하지 않는다. 두 worktree 가 동일 파일의 **서로 다른 섹션**을 건드리며, target plan 은 spec 파일을 write 하지 않으므로 실질적인 충돌은 없다.
- **제안**: 조치 불요. 단, target plan 이 예상 외로 `spec/2-navigation/4-integration.md` 를 수정하게 된다면 `cafe24-install-ratelimit-2891d1` branch 와 rebase 충돌 가능성을 확인해야 한다.

---

### [INFO] auth-config-webhook-wiring plan — spec/2-navigation/ 파일 예정 수정 (미착수)

- **target 위치**: 해당 없음 (target plan 은 spec 파일 수정 없음)
- **관련 plan**: `plan/in-progress/auth-config-webhook-wiring.md` (status: in-progress, worktree: 미생성)
- **상세**: `auth-config-webhook-wiring.md` 가 `spec/2-navigation/2-trigger-list.md` 와 `spec/2-navigation/6-config.md` 를 Phase 0 수정 대상으로 명시하고 있으나, 해당 plan 에 대한 branch 와 worktree 가 현재 생성되지 않았음(git branch / worktree 모두 확인 완료). target plan 이 건드리는 파일과 겹치지 않으므로 현재 시점의 경합 위험은 없다.
- **제안**: 조치 불요. 단, `auth-config-webhook-wiring` 착수 시 두 plan 이 진행 중이어도 파일 경합은 없다.

---

### [INFO] cafe24-restricted-scopes-followups.md — §2 작업이 현재 worktree 에서 분리 진행

- **target 위치**: 해당 없음
- **관련 plan**: `plan/in-progress/cafe24-restricted-scopes-followups.md §2`
- **상세**: `cafe24-restricted-scopes-followups.md §2` 가 target plan (`cafe24-oauth-invalid-scope.md`) 의 원본 출처 plan 이다. §2 의 작업 목록이 target plan (`cafe24-oauth-invalid-scope.md`) 과 동일 항목을 열거하고 있으며, target plan 의 worktree 가 `cafe24-oauth-invalid-scope-408b14` 로 설정되어 정상적으로 분리 진행 중이다. 두 plan 이 동일 작업을 이중으로 추적하는 구조이나, target plan 이 parent plan 의 §2 를 승격(split-out)한 정상 패턴이다. 작업 완료 후 `cafe24-restricted-scopes-followups.md` 의 §2 체크박스를 `[x]` 로 갱신하고, §1/§3 도 완료되면 plan 을 `plan/complete/` 로 이동해야 한다.
- **제안**: target plan 완료 시 `plan/in-progress/cafe24-restricted-scopes-followups.md §2` 의 체크박스를 갱신할 것.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 (`cafe24-install-ratelimit-2891d1` — `spec/2-navigation/4-integration.md` 수정 중) 1건에 대해 stale 판정 cascade 를 수행했다:

- `cafe24-install-ratelimit-2891d1` (branch `claude/cafe24-install-ratelimit-2891d1`) — Step 1: `ACTIVE` (ancestor 검사 음성). Step 2: 미수행 (Step 1 에서 ACTIVE 확정). **active 로 처리** — 단, target plan 이 spec 파일을 수정하지 않으므로 실질적 worktree 충돌 없음 (INFO 로만 보고).

그 외 worktree 충돌 후보 없음 — stale skip 된 항목: 0건.

---

## 요약

`spec/2-navigation/` 전체를 대상으로 한 impl-prep 검토에서 CRITICAL 또는 WARNING 등급의 발견사항은 없다. target plan (`cafe24-oauth-invalid-scope`) 이 구현할 `§10.4 invalid_scope callback` 분기는 이미 `spec/2-navigation/4-integration.md §10.4` 에 완전히 명세되어 있으며, 미해결 결정이 남아있지 않다. 동일 spec 파일(`4-integration.md`)을 수정 중인 `cafe24-install-ratelimit-2891d1` worktree 는 서로 다른 섹션(API 표 / Rationale install rate limiting)을 건드리고 있고, target plan 은 spec 파일을 수정하지 않으므로 충돌 위험이 없다. `auth-config-webhook-wiring` plan 이 `spec/2-navigation/2-trigger-list.md` 와 `6-config.md` 를 예정 수정 대상으로 명시하고 있으나 branch 미생성 상태이며 target 파일과 겹치지 않는다. worktree 충돌 후보 1건 중 stale skip 0건, active 1건 분석 — 실질 충돌 없음.

---

## 위험도

NONE
