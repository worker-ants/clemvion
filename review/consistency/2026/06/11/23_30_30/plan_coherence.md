## 발견사항

### [INFO] spec-sync-integration-common-gaps.md 의 Missing Integration 배지 — 미해결 아키텍처 결정, target 무관

- **target 위치**: spec/4-nodes/4-integration/0-common.md §5 캔버스 요약 "계획 (미구현)" 노트
- **관련 plan**: `plan/in-progress/spec-sync-integration-common-gaps.md` — `§5 ⚠ Missing integration 배지` 항목이 `worktree: spec-sync-audit` 에서 **티어3 (아키텍처 결정 필요, 보류)** 미해결 상태
- **상세**: target spec 이 "Missing integration 배지는 미구현" 을 노트로 명시하고 있으며 이 항목은 plan 에서 결정을 보류 중이나, target 은 배지 구현을 강제하거나 결정을 내리지 않고 단순 현황 기술로 처리한다. 충돌 없음.
- **제안**: 이슈 없음 — 현재 표현 유지. spec-sync-audit worktree 에서 해당 항목이 의도적으로 보류된 상태임을 확인.

---

### [INFO] node-output-redesign/http-request.md 잔여 Phase 3 항목 — target 과 무충돌

- **target 위치**: spec/4-nodes/4-integration/1-http-request.md §5.3.2 transport 실패 케이스
- **관련 plan**: `plan/in-progress/node-output-redesign/http-request.md` Phase 3 (P3) — `output.response: { error: <message> }` legacy 잔재 제거가 P3 미착수로 남음
- **상세**: target 이 §5.3.2 에서 `output.response: { error: <message> }` 를 "legacy 호환 잔재 — 신규 코드는 `output.error` 를 사용" 로 기술한 것은 node-output-redesign plan 이 이미 "deprecation 의도 명시됨 / P3 잔여" 로 추적 중인 항목과 일치한다. target 은 이 잔재를 제거하지 않고 현황 기술로 유지해 plan 과 충돌하지 않는다.
- **제안**: 이슈 없음. node-output-redesign Phase 3 착수 시 해당 항목과 target spec §5.3.2 를 함께 처리.

---

### [INFO] prod-fail-closed-guards worktree — MERGED, stale 처리 권장 (http-ssrf-all-auth-followups.md 에 이미 등재)

- **관련 plan**: `plan/in-progress/prod-fail-closed-guards.md` (worktree `prod-fail-closed-guards`) — `claude/prod-fail-closed-guards` 브랜치
- **상세**: Step 2 (GitHub PR state) 확인 결과 PR state = `MERGED`. Step 1 (ancestor 검사)에서는 ACTIVE 로 나왔으나 이는 squash merge 로 commit hash 가 달라진 케이스. stale worktree 로 판정하여 skip. 이 worktree 는 `spec/4-nodes/4-integration/` 파일을 수정하지 않으므로 워크트리 충돌 후보가 아님. 단 `spec/5-system/1-auth.md`, `spec/conventions/secret-store.md`, `spec/5-system/11-mcp-client.md` 를 수정하며, target 의 SSRF opt-out callout (`spec/4-nodes/4-integration/1-http-request.md §4` 의 `MCP_ALLOW_INSECURE_URL` 분리 언급) 과 교차 참조 관계만 존재 — 충돌 아님. `http-ssrf-all-auth-followups.md §타 plan/worktree 정리` 에 이미 cleanup 대상으로 등재됨.
- **제안**: `./cleanup-worktree-all.sh --yes --force` 실행 권장 (http-ssrf-all-auth-followups.md 항목 병행 처리).

---

### [INFO] refactor/04-security.md C-3 항목 — target 이 완수, 체크박스 갱신 필요

- **target 위치**: `plan/in-progress/http-ssrf-all-auth.md` (현재 worktree 의 plan)
- **관련 plan**: `plan/in-progress/refactor/04-security.md §C-3` — 현재 `- [ ] 미착수`
- **상세**: target plan (`http-ssrf-all-auth.md`) 의 체크리스트 상 구현·테스트·consistency-check 가 완료됐으나 `/ai-review` 와 `/consistency-check --impl-done` 는 아직 미완([ ]). `refactor/04-security.md` C-3 는 여전히 `- [ ] 미착수` 로 표시되어 있어 stale 상태. C-1 의 완료 패턴(`- [x] ✅ 완료 (2026-06-11, worktree ...)`)으로 갱신 필요.
- **제안**: `/ai-review` + `/consistency-check --impl-done` 완료 후 `refactor/04-security.md §C-3` 를 `- [x] ✅ 완료` 로 갱신하고 `http-ssrf-all-auth.md` 를 `plan/complete/` 로 이동.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

- `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`) — Step 1: ACTIVE (squash merge 로 ancestor 불일치), Step 2: PR state = `MERGED` → **stale 판정**. `spec/4-nodes/4-integration/` 파일 수정 없으므로 §5번 충돌 후보 아님. 단 stale worktree 로 cleanup 권장.

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/4-nodes/4-integration/` target 문서는 진행 중 plan 과 전반적으로 정합하다. `spec-sync-integration-common-gaps.md` 의 미해결 Missing Integration 배지 항목은 target 이 결정을 내리지 않고 현황 기술로 유지하므로 충돌 없다. `node-output-redesign` Phase 3 의 transport-failed legacy 잔재 항목도 target 이 동일한 입장(deprecation 의도 명시 + 미제거)을 취해 conflict 없다. active worktree 중 `spec/4-nodes/4-integration/` 파일을 동시에 수정하는 브랜치는 현재 worktree(`http-ssrf-all-auth`) 외에 없음. worktree 충돌 후보 1건(`prod-fail-closed-guards`) 은 Step 2 PR MERGED 로 stale 판정 skip. 유일한 후속 조치는 C-3 완료 표시 갱신과 stale worktree cleanup. **worktree 충돌 후보 1건 중 stale 1건 skip, active 0건 분석.**

---

## 위험도

NONE
