# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-code-node-followups.md`  
worktree: `code-followups-spec-4f035f`

---

## 발견사항

### [INFO] 변경 1 (dayjs 스냅샷) — code-node-isolated-vm-followups 의 위임 항목과 정합

- target 위치: 변경 1 전체 (§1-a·§1-b·§1-c)
- 관련 plan: `plan/in-progress/code-node-isolated-vm-followups.md` Spec 섹션 마지막 open 항목 "§4 step3 / §7.1 snapshot 경로 기술 (그룹4 ai-review SPEC-DRIFT INFO #1·#2) — planner 위임"
- 상세: target 의 변경 1 은 follwups plan 이 `planner 위임 — code-only PR(code-snapshot-perf) 범위 밖, 비차단 INFO` 로 열어둔 spec 보강 요청을 그대로 이행한다. 충돌 없음. follwups plan 의 해당 항목을 `[x]` 로 닫아야 한다.
- 제안: 본 spec PR 머지 후 `code-node-isolated-vm-followups.md` 의 해당 open 항목을 완료 처리 필요. 누락 시 미완 추적이 잔류.

---

### [INFO] 변경 2 (base64 TypeError) — followups plan 의 "변경 시 spec 동반" 조건 충족

- target 위치: 변경 2 전체 (§2-a·§2-b)
- 관련 plan: `plan/in-progress/code-node-isolated-vm-followups.md` 코드 섹션 "INFO — `$helpers.base64` 비문자열 일관성" (open, `[ ]`)
- 상세: followups plan line 20 은 "현 silent-string 은 spec §2.2 NOTE 로 문서화된 의도 — 변경 시 spec 동반" 이라고 적었다. 그러나 현재 `spec/4-nodes/5-data/2-code.md §2.2` 에는 그 NOTE 가 존재하지 않는다 (grep 확인). 즉 "기존 문서화된 의도" 라는 설명은 사실과 다르며, spec 에 계약이 명시되지 않은 미정의 동작이다. target plan 이 TypeError 계약을 spec 에 신규 등재하는 것은 정당하다. spec-code 갭(code 구현 변경 대기)을 target 이 명시적으로 "후속 code PR (developer)" 섹션에서 추적하고 있어 패턴 정합. 충돌 없음.
- 제안: followups plan 의 해당 항목 설명("spec §2.2 NOTE 로 문서화된 의도") 은 spec 에 NOTE 가 없으므로 사실과 달라 오해를 유발한다. 본 spec PR 머지 후 followups plan 의 해당 행에 "spec §2.2 NOTE 를 신규 등재 완료(spec-draft-code-node-followups PR)" 로 갱신 권장.

---

### [INFO] 변경 3 (메모리 env) — followups plan open 항목과 정합, env var 명칭 불일치 관찰

- target 위치: 변경 3 전체 (§3-a·§3-b·§3-c)
- 관련 plan: `plan/in-progress/code-node-isolated-vm-followups.md` 코드 섹션 "INFO — 메모리 한도 env: `ISOLATE_MEMORY_LIMIT_MB` → `CODE_NODE_MEMORY_LIMIT_MB` env"
- 상세: followups plan 은 env var 이름을 `ISOLATE_MEMORY_LIMIT_MB` → `CODE_NODE_MEMORY_LIMIT_MB` 로 변경한다고 명시한다. target spec-draft 는 `CODE_NODE_MEMORY_LIMIT_MB` 를 사용하고 있어 최종 이름이 일치. 단, 현재 코드에 `ISOLATE_MEMORY_LIMIT_MB` 가 이미 사용되고 있을 가능성이 있으며 후속 code PR 에서 실제 rename 이 이뤄질 때 이름 변경이 동반되어야 한다. target 의 "후속 code PR" 섹션이 이를 추적하고 있어 충돌 없음.
- 제안: 충돌 없음. followups plan 의 해당 항목도 본 spec PR 머지 후 "spec 선행 완료" 주석 추가 권장.

---

### [INFO] plan-cleanup-impl-done-4c9d96 worktree — plan 파일 겹침 없음 (spec 파일 무변경)

- target 위치: 전반 (spec/4-nodes/5-data/2-code.md 수정 예정)
- 관련 plan: `plan/in-progress/code-node-isolated-vm-followups.md` — `plan-cleanup-impl-done-4c9d96` 브랜치가 동일 파일을 수정
- 상세: `plan-cleanup-impl-done-4c9d96` worktree 의 변경 파일 목록을 확인했다. 해당 브랜치는 `plan/in-progress/code-node-isolated-vm-followups.md`를 수정하고 있으나, `spec/` 파일은 일절 변경하지 않는다. target 이 수정할 `spec/4-nodes/5-data/2-code.md` 와의 직접 충돌은 없다. PR #이 MERGED 상태임을 확인: 해당 브랜치의 PR 상태는 MERGED — stale worktree.
- 제안: stale worktree cleanup 대상 (`cleanup-worktree-all.sh` 실행 권장, 아래 §Stale skip 목록 참고).

---

### [WARNING] code-node-isolated-vm-followups 의 open 항목 체크박스 미닫힘 위험 (후속 누락)

- target 위치: target plan `## 후속 code PR (developer)` 섹션
- 관련 plan: `plan/in-progress/code-node-isolated-vm-followups.md` — Spec 섹션 open 항목 3건 (§4 step3/§7.1 snapshot, §3-error-handling 계층, code 관련 미완 항목)
- 상세: target spec-draft plan 은 완료 후 `code-node-isolated-vm-followups.md` 의 spec 관련 open 항목들을 닫아야 함을 명시하지 않는다. 변경 1·2·3 이 각각 followups plan 의 특정 open 항목에 대응하므로, spec PR 머지 후 followups plan 을 동기화하지 않으면 완료된 항목이 미완으로 남아 혼란을 유발한다. 특히 "후속 code PR (developer)" 섹션의 체크리스트가 followups plan 의 code open 항목과 이름이 다르게 기술되어 있어 추적 가능성이 낮다.
- 제안: target plan 의 `## 후속 code PR (developer)` 섹션에, 본 spec PR 머지 후 `code-node-isolated-vm-followups.md` 의 spec 관련 항목 (snapshot 경로·base64 TypeError 관련)을 `[x]` 로 닫는 작업을 명시하는 항목을 추가. 또는 spec PR 커밋 시 followups plan 파일도 동시 갱신.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `code-snapshot-perf-ff751c` (branch `claude/code-snapshot-perf-ff751c`) — Step 2 PR MERGED. `spec/4-nodes/5-data/2-code.md` 를 변경하지 않으므로 실제 충돌 후보가 아님. 단 `plan/in-progress/code-node-isolated-vm-followups.md` 를 변경하고 있어 target spec-draft 와 plan 동기화 시 merge 주의.
- `test-code-http-hardening-10aad3` (branch `claude/test-code-http-hardening-10aad3`) — Step 2 PR MERGED. spec 파일 미변경, 충돌 없음.
- `plan-cleanup-impl-done-4c9d96` (branch `claude/plan-cleanup-impl-done-4c9d96`) — Step 2 PR MERGED. spec 파일 미변경, 충돌 없음.
- `spec-audit-action-prose` (branch `claude/spec-audit-action-prose`) — Step 2 PR MERGED. `spec/5-system/1-auth.md`·`spec/data-flow/1-audit.md` 변경, `spec/4-nodes/5-data/2-code.md` 미변경 — 충돌 없음.
- `spec-auth-hygiene` (branch `claude/spec-auth-hygiene`) — Step 2 PR MERGED. `spec/5-system/1-auth.md`·`spec/data-flow/1-audit.md` 변경, `spec/4-nodes/5-data/2-code.md` 미변경 — 충돌 없음.

해당 stale worktree 들이 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

active worktree 충돌 후보: 0건 (나머지 활성 worktree `audit-sot-hygiene-8fc5f1`·`spec-ragsources-content`·`pr4b-kb-embedding-retire` 는 `spec/4-nodes/5-data/2-code.md` 미변경).

---

## 요약

`spec-draft-code-node-followups.md` (worktree `code-followups-spec-4f035f`) 의 3가지 변경은 모두 `code-node-isolated-vm-followups.md` 가 `planner 위임` 또는 `변경 시 spec 동반` 으로 열어둔 항목을 적법하게 이행하는 것으로, 미해결 결정과의 충돌·선행 plan 미해소·active worktree 경합은 발견되지 않았다. 주요 주의점은 (1) followups plan 의 open 항목 체크박스가 spec PR 머지 후 자동으로 닫히지 않는 구조적 누락(WARNING), (2) base64 §2.2 NOTE 가 현 spec 에 존재하지 않는다는 follwups plan 의 사실 오류(INFO) 두 가지다. 위험도는 LOW. worktree 충돌 후보 5건 전부 stale(PR MERGED) 확인 후 skip, active 충돌 0건.

## 위험도

LOW

STATUS: SUCCESS
