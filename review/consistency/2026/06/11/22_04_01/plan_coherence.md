# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
Target: `spec/4-nodes/5-data/` (0-common.md · 1-transform.md · 2-code.md)
Worktree: `code-node-isolated-vm` (branch `claude/code-node-isolated-vm`)
기준: `plan/in-progress/**` 대비

---

## 발견사항

### [WARNING] `plan/in-progress/refactor/04-security.md` C-2 가 "결정 대기" 상태이나 target 이 결정을 이미 집행

- **target 위치**: `spec/4-nodes/5-data/2-code.md §Rationale "격리 방식 isolated-vm 전환 — 위협 모델과 결정 (2026-06-11)"` + `code.handler.ts` 전면 재작성
- **관련 plan**: `plan/in-progress/refactor/04-security.md` §C-2 라인 41: `- [ ] 결정 대기 (사용자) — nodes/data/code/code.handler.ts:212-233`
- **상세**: `refactor/04-security.md` C-2 는 `isolated-vm` 전환을 "사용자 보고 대상" · "결정 대기" 로 표기하고 있다. target 의 spec Rationale 은 "사용자 결정(2026-06-11)" 으로 결정이 내려졌음을 명시하고 있고, 구현도 완료되어 PR 이 진행 중이다. plan 의 체크박스가 여전히 미완(`- [ ]`) 상태이므로, 결정 집행 사실이 plan 에 반영되지 않았다. 같은 파일 C-2 § "spec 갱신: §7.1 에 위협 모델과 운영 경계 Rationale 명시, 전환 시 '현재 구현' 행 교체 (planner)" 도 target 에서 이미 처리되었다.
- **제안**: `plan/in-progress/refactor/04-security.md` C-2 항목을 `- [x] ✅ 완료 (2026-06-11, worktree code-node-isolated-vm)` 로 갱신하고 결정 내용(사용자 결정 2026-06-11, 옵션 A isolated-vm 전환)을 기록. M-2 ("C-2 에 흡수") 도 함께 완료 처리.

---

### [WARNING] `plan/in-progress/node-output-redesign/code.md` 의 `CODE_MEMORY_LIMIT` "로드맵 미구현" 표기가 현재 구현과 불일치

- **target 위치**: `spec/4-nodes/5-data/2-code.md §5.3.3` (`CODE_MEMORY_LIMIT` 케이스 정의됨) + `code.handler.ts` 의 `classifyError` + `error-codes.ts` 에 `CODE_MEMORY_LIMIT` 등재
- **관련 plan**: `plan/in-progress/node-output-redesign/code.md` 라인 82: `"code": "CODE_EXECUTION_FAILED" | "CODE_TIMEOUT" | "CODE_MEMORY_LIMIT" /* 로드맵 */` + 라인 132: "메모리 초과는 spec §5.3 footnote 에 `CODE_MEMORY_LIMIT` 로드맵 — 현재 `node:vm` 한계로 미구현. handler 코드에 `EXECUTION_MEMORY_EXCEEDED` 케이스 분기 없음. 일관."
- **상세**: `node-output-redesign/code.md` 는 `CODE_MEMORY_LIMIT` 를 "로드맵"으로 남겨두었으나, target 구현은 이를 완전히 구현했다 (`§5.3.3` 케이스 추가, `classifyError` 에 `EXECUTION_MEMORY_EXCEEDED→CODE_MEMORY_LIMIT` 매핑, `error-codes.ts` 등재, i18n `backend-labels.ts` 추가, 문서 `.en.mdx`·`.mdx` 에도 반영). plan 의 "미구현" 설명이 현실과 역전되어 후속 개발자에게 오해를 줄 수 있다.
- **제안**: `plan/in-progress/node-output-redesign/code.md` 의 `CODE_MEMORY_LIMIT` 관련 표기를 "구현 완료 (isolated-vm 전환 PR)" 로 갱신하거나, 본 plan 자체가 완료 후 `plan/complete/` 로 이동할 때 반영.

---

### [WARNING] `spec/4-nodes/0-overview.md §5 샌드박싱` 이 `node:vm` 기술로 남아 있고 메모리 제한이 "미구현(Planned)" 으로 표기됨

- **target 위치**: `spec/4-nodes/5-data/2-code.md §7` 이 `isolated-vm` 으로 교체됨. 구현 diff 에서 `node:vm` 이 완전히 제거됨.
- **관련 plan**: `plan/in-progress/refactor/04-security.md` C-2 "spec 갱신: §7.1 에 위협 모델과 운영 경계 Rationale 명시, 전환 시 '현재 구현' 행 교체"
- **상세**: `spec/4-nodes/0-overview.md:298` 의 "실행 격리" 행이 여전히 "`node:vm` 컨텍스트에서 격리 실행" + `buildSandbox` 로 기술되어 있다. 또한 "메모리 제한" 행이 "**미구현 (Planned)**" 으로 남아 있는데, target 구현은 `isolated-vm` `memoryLimit: 128` 으로 메모리 제한을 실현했다. `0-overview.md §5` 와 `2-code.md §7.1` 이 불일치 상태가 된다. target PR 이 머지되면 이 불일치가 main 에 노출된다.
- **제안**: target PR 의 spec 변경 범위에 `spec/4-nodes/0-overview.md §5` 의 "실행 격리" 행(`node:vm` → `isolated-vm (V8 Isolate)` + 코드 참조 `code.handler.ts`)과 "메모리 제한" 행 구현 상태(`미구현` → `구현됨 (128MB, isolated-vm isolate)`) 갱신을 포함시킨다. developer 는 spec 쓰기 금지이므로 planner 위임이 필요하며, target PR 머지 전 또는 직후 처리 대상으로 추적.

---

### [INFO] `plan/in-progress/refactor/04-security.md` M-2 ("Promise 노출 — C-2 에 흡수") 도 target 에서 해소됨

- **target 위치**: `spec/4-nodes/5-data/2-code.md §7.3` Promise 허용 표 + `code.handler.ts` bootstrap script 에서 Promise(async/await) 유지
- **관련 plan**: `plan/in-progress/refactor/04-security.md` M-2 라인 125: `- [ ] 결정 대기 (사용자)`. 개선 방안 "(근본) C-2 의 isolated-vm/컨테이너 전환에 흡수"
- **상세**: M-2 는 "단독 처리 금지 — C-2 에 흡수" 로 설계되었다. target 은 `isolated-vm` 으로 전환하여 Promise 를 유지하면서 탈출면을 구조적으로 차단했다 (spec Rationale §격리방식 "Promise(async/await) 는 §4.1 의 기능 약속이라 유지하되, 격리 계층이 그로 인한 탈출면을 무력화한다"). M-2 도 C-2 와 함께 완료 처리가 필요하다.
- **제안**: `refactor/04-security.md` M-2 를 `- [x] ✅ C-2 와 함께 완료 (isolated-vm 전환으로 흡수, 2026-06-11)` 로 갱신.

---

### [INFO] `plan/in-progress/marketplace-and-plugin-sdk.md` 의 외부 노드 샌드박싱 로드맵 참조가 target 으로 부분 해소됨

- **target 위치**: `spec/4-nodes/5-data/2-code.md §7.1` isolated-vm 전환 + 로드맵("컨테이너/gVisor 강화는 후속")
- **관련 plan**: `plan/in-progress/marketplace-and-plugin-sdk.md` 라인 80: `[ ] 샌드박싱 — 외부 노드 실행 시 isolated-vm / Docker 격리 (spec 5-data/2-code.md §로드맵에 isolated-vm 언급)`
- **상세**: marketplace plan 이 "spec §로드맵에 isolated-vm 언급" 을 전제로 isolated-vm 도입을 미래 작업으로 등재하고 있으나, target 은 code 노드에 이미 isolated-vm 을 도입했다. marketplace 외부 노드의 샌드박싱을 code 노드와 동일한 isolated-vm 레이어를 재사용할 수 있는지, 별도 추가 작업이 필요한지 재검토가 필요하다. 실질 차단은 아니나 로드맵 근거 표현이 과거형으로 전환될 필요가 있다.
- **제안**: marketplace plan 해당 항목의 괄호 주석을 "spec 5-data/2-code.md §7.1 에 isolated-vm 이미 도입됨 — code 노드 레이어 재사용 여부 검토" 로 갱신하거나, 해당 plan 착수 시 확인.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

- `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`) — Step 1 ancestor: ACTIVE (squash merge 케이스) → Step 2 PR: **MERGED**. stale 판정.
  `spec/4-nodes/5-data/` 와 겹치는 영역 없음 (해당 plan 은 `spec/5-system/1-auth.md`, `spec/conventions/secret-store.md`, `spec/5-system/11-mcp-client.md` 만 수정). worktree 충돌 후보에서 제외.

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target `spec/4-nodes/5-data/` 는 `isolated-vm` 전환이라는 사용자 결정(2026-06-11)을 spec 과 구현에 일관되게 반영했으며, `plan/in-progress/refactor/04-security.md` C-2 가 사전에 권장한 경로(옵션 A)와 정확히 일치한다. 핵심 plan 정합 문제는 C-2·M-2 체크박스가 여전히 미완(`- [ ]`)인 것, `node-output-redesign/code.md` 의 `CODE_MEMORY_LIMIT` "로드맵 미구현" 기술이 구현 현실과 역전된 것, 그리고 `spec/4-nodes/0-overview.md §5` 의 `node:vm` 기술과 메모리 제한 "미구현" 표기가 target 구현 후 불일치 상태가 된 것이다. worktree 충돌 후보 1건 중 stale 1건 skip, active 0건 분석.

---

## 위험도

LOW
