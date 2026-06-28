# Plan 정합성 검토 결과

**검토 모드**: `--impl-done` (scope=`spec/5-system/`, diff-base=`acfa6735b`)
**검토 일시**: 2026-06-28

---

## 검토 요약 (선행)

diff-base(`acfa6735b`)는 `fix(triggers,workspaces): trigger endpoint_path v4 UUID 강제 + 만료 초대 pruner 연결 (W1·W7)` 커밋이다. 이 커밋은 `plan/in-progress/trigger-review-deferred-fixes.md` 의 W1(보안)·W7(데이터 위생)을 해소하며 `spec/5-system/12-webhook.md` (WH-SC-01·WH-MG-02 CSPRNG 명문화)를 함께 갱신했고, 해당 plan 은 worktree 내에서 `plan/complete/trigger-review-deferred-fixes.md` 로 이동·완료 처리됐다. `spec_impact` frontmatter 에도 `spec/5-system/12-webhook.md` 가 명시돼 있다.

target(`spec/5-system/`)에서 미해결 결정을 우회하거나 선행 조건 미해소 상태를 가정하는 항목은 발견되지 않았다.

---

## 발견사항

- **[INFO]** `spec-sync-webhook-gaps.md` — WH-NF-02 본문 크기 결정 미완
  - target 위치: `spec/5-system/12-webhook.md` §3.1·WH-NF-02·§8 (현재 "1MB" 약속 vs 구현 32KB/미지정 불일치)
  - 관련 plan: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-frontend/plan/in-progress/spec-sync-webhook-gaps.md` — `[ ] WH-NF-02 / §8 — 1MB 본문 크기 통일 임계`
  - 상세: WH-NF-02 결정은 옵션 A/B/C 분석(권장 C)까지 제시됐으나 아직 사용자 결정이 없다. 이번 구현(WH-SC-01·WH-MG-02 UUID 보안 강화)은 이 결정과 **직교**하며 충돌하지 않는다. 다만 같은 spec 파일을 수정했으므로 WH-NF-02 의 미결 상태가 계속 누적 중임을 인지할 필요가 있다.
  - 제안: 현재 무관한 변경이므로 plan 갱신 불필요. WH-NF-02 결정은 `spec-sync-webhook-gaps.md` 의 열린 `[ ]` 항목에서 별도로 진행한다.

- **[INFO]** `spec-update-gap-callout-plan-links.md` — `spec/data-flow/12-workspace.md §3.1` 항목 잠재적 stale
  - target 위치: 해당 파일은 `spec/data-flow/` 이므로 target 범위 밖이나, 동일 커밋(acfa6735b)의 부수 spec_impact
  - 관련 plan: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-frontend/plan/in-progress/spec-update-gap-callout-plan-links.md` — `spec/data-flow/12-workspace.md §3.1 — pruneExpired 스케줄러 없음`
  - 상세: `spec-update-gap-callout-plan-links.md` 는 `spec/data-flow/12-workspace.md §3.1` 의 pruneExpired 갭 callout 에 plan 링크를 추가하는 작업을 열어 두고 있다. 그러나 acfa6735b 의 W7 구현으로 `WorkspaceInvitationsPrunerService` 가 신설되고 해당 spec 섹션이 이미 구현 완료 기술로 갱신됐다. 결과적으로 "갭 callout" 자체가 제거돼 이 plan 항목의 실행 대상이 사라졌다.
  - 제안: `spec-update-gap-callout-plan-links.md` 의 `spec/data-flow/12-workspace.md §3.1` 행을 "W7 해소로 callout 제거됨, 스킵" 으로 표기하거나 해당 행을 삭제한다. target 범위(`spec/5-system/`) 밖이므로 낮은 우선순위.

---

## 요약

`spec/5-system/` target 은 진행 중 plan 과 구조적으로 정합하다. WH-SC-01·WH-MG-02 갱신은 `plan/complete/trigger-review-deferred-fixes.md`(W1) 에 추적되고 `spec_impact` 에 명시되어 있어 미추적 변경이 없다. `spec-sync-auth-gaps.md` 의 LDAP/SAML 미구현 항목은 auth spec §1.3 "(미구현 · Planned)" 기술과 정합하고, `spec-sync-webhook-gaps.md` 의 WH-NF-02(본문 크기 결정)는 이번 변경과 직교하여 충돌이 없다. 유일한 주의 사항은 `spec-update-gap-callout-plan-links.md` 의 workspace §3.1 항목이 W7 구현으로 실행 대상을 잃었으나 plan 이 갱신되지 않은 점이다(target 범위 밖, INFO 수준).

---

## 위험도

NONE
