# Plan 정합성 검토 결과

검토 모드: `--impl-done`
Target: `spec/conventions/spec-impl-evidence.md`
검토 범위: 해당 spec 을 건드리거나 그 가드 구현을 추가하는 `plan/in-progress/**` 와의 정합

---

## 발견사항

### [WARNING] spec-drift-gates.md 의 Gate C 보류 결정을 target 이 구현으로 해소 — plan 갱신 미반영

- **target 위치**: `spec/conventions/spec-impl-evidence.md §4.2` 및 frontmatter `code:` 에 `spec-plan-completion.test.ts` 추가. 구현 파일 `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 신설.
- **관련 plan**: `plan/in-progress/spec-drift-gates.md §C` — "plan 완료 시 spec 정합 결정 강제 (**보류**)"가 `[ ]` 상태로 남아있고, 완료 조건도 "C 구현 + 테스트" 가 미체크.
- **상세**: `spec-drift-gates.md` 는 Gate C 를 "보류" 로 선언하고 "착수 안 하기로 결정하면 plan 에 drop 결정 명시 후 complete 이동 가능" 이라는 위임 문구를 두었다. target(kb-quality 워크트리) 은 Gate C(`spec-plan-completion.test.ts`) 와 Gate D(advisory `--mode reverse`) 모두를 실제로 구현했다. Gate C 의 구현 접근 방식도 달라졌다 — `spec-drift-gates.md` 는 "건드린 `code:` 연결 코드 변경 여부" 를 git history 로 검사하는 fragile 안을 기술했으나, target 은 대신 `spec_impact` frontmatter 선언(date cutoff 2026-06-04 이후 grandfather) 방식으로 대체했다. 이 설계 변경은 target spec 의 R-8 에 기재돼 있으나 `spec-drift-gates.md` 에는 반영되지 않았다.
- **충돌 성격**: `spec-drift-gates.md` 에서 "보류" 였던 결정을 target 이 일방적으로 구현으로 해소한 것이 아니라, plan 이 "사용자 판단으로 착수 시점 결정" 을 위임한 형태이므로 **의사결정 충돌은 아님**. 다만 `spec-drift-gates.md` 체크박스·완료 조건이 여전히 `[ ]` 인 채로 in-progress 에 남아 있어 plan 정합성이 깨진다.
- **제안**: `spec-drift-gates.md` 의 §C·§D 체크박스를 `[x]` 로 갱신하고, 완료 조건을 체크, Gate C 구현 방식 변경(`spec_impact` 선언 방식, R-8 참조)을 "결정 기록" 으로 추가한 뒤 plan 을 `plan/complete/` 로 이동. (Gate C·D 완료로 `spec-drift-gates.md` 의 완료 조건이 모두 충족됨.)

---

### [INFO] fix-spec-frontmatter-catalog 워크트리 — spec-impl-evidence.md 동시 수정 후보 (stale 확인 skip)

- **관련 plan**: `plan/in-progress/fix-spec-frontmatter-catalog.md` (worktree `fix-spec-frontmatter-catalog`)
- **상세**: 해당 워크트리가 `spec/conventions/spec-impl-evidence.md` 를 수정한다. 그러나 Step 2(GitHub PR state) 에서 PR #453 `MERGED` 확인 → stale 판정. active 충돌 없음.
- **제안**: cleanup 불요 시 무시. 워크트리 잔류가 불편하면 `./cleanup-worktree-all.sh --yes --force` 실행.

---

### [INFO] fix-bg-context-followups 워크트리 — spec-impl-evidence.md 동시 수정 후보 (stale 확인 skip)

- **관련 plan**: `plan/in-progress/background-context-key-followups.md` (worktree `fix-bg-context-followups`)
- **상세**: 해당 워크트리가 `spec/conventions/spec-impl-evidence.md` 를 수정한다. Step 2에서 PR #451 `MERGED` 확인 → stale 판정. active 충돌 없음.
- **제안**: 마찬가지로 cleanup 트리거만 필요하면 `./cleanup-worktree-all.sh` 실행.

---

### [INFO] spec-drift-gates-b26bce 워크트리 — 관련 plan 의 worktree 참조 (stale)

- **관련 plan**: `plan/in-progress/spec-drift-gates.md` (worktree `spec-drift-gates-b26bce`)
- **상세**: Step 2에서 PR #449 `MERGED` 확인 → stale 판정. 해당 워크트리 자체는 `spec-impl-evidence.md` 를 수정하지 않으므로 직접 충돌 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 1 non-ancestor (ACTIVE), Step 2 PR #453 MERGED → stale
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 1 non-ancestor (ACTIVE), Step 2 PR #451 MERGED → stale
- `spec-drift-gates-b26bce` (branch `claude/spec-drift-gates-b26bce`) — Step 1 non-ancestor (ACTIVE), Step 2 PR #449 MERGED → stale
- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 1 ancestor → stale (non-squash merge 포함 main)
- `rag-rerank-decisions-dd1d68` (branch `claude/rag-rerank-decisions-dd1d68`) — Step 1 ancestor → stale
- `spec-inprogress-impl2` (branch `claude/spec-inprogress-impl2`) — Step 1 ancestor → stale

이 워크트리들이 더 이상 활성 작업 없이 남아있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target(`spec/conventions/spec-impl-evidence.md`)은 4개의 신규 build 가드(plan-frontmatter, spec-link-integrity, spec-area-index, spec-plan-completion)와 advisory Gate D를 §4.2 family로 추가하며, 이 가드들에 대한 Rationale R-8·R-9를 신설한다. 미해결 결정 우회나 active worktree 경합은 없다. 주요 정합 이슈는 `plan/in-progress/spec-drift-gates.md` 가 Gate C·D를 "보류" 상태(`[ ]`)로 남겨둔 채 in-progress에 있는 반면, target이 이를 이미 구현했다는 것이다 — 의사결정 충돌이 아니라 plan 추적 갱신 누락이므로 WARNING 수준이다. worktree 충돌 후보 6건 중 stale 6건 skip, active 0건으로 실제 경합 없음.

---

## 위험도

LOW
