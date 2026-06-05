# Plan 정합성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
대상 plan: `plan/in-progress/exec-park-durable-resume.md` (worktree `exec-park-durable-resume`, branch `claude/exec-park-a3-variables`)

---

## 발견사항

### [WARNING] rag-rerank-followup: spec/5-system/1-auth.md 미반영 후속 항목

- **target 위치**: `spec/5-system/1-auth.md §3.2` 권한 매트릭스, `§4.1` 감사 로그 목록
- **관련 plan**: `plan/in-progress/rag-rerank-followup.md` — "RerankConfig RBAC 행 추가 (LLMConfig 패턴, I1)" 및 "감사 로그에 `rerank_config.*` 추가 (I2)"
- **상세**: `rag-rerank-impl.md` 구현(PR #465, MERGED)이 완료됐으나 `rag-rerank-followup.md` 가 열거한 `spec/5-system/1-auth.md` 후속 항목들이 아직 spec 에 반영되지 않았다. §3.2 RBAC 매트릭스에 `Rerank Config` 행이 없고, §4.1 감사 로그에 `rerank_config.create/update/delete` 가 없다. 이 갭은 `rag-rerank-followup.md` 에 명시된 미완료 항목으로 추적되고 있으나, `spec/5-system/` 범위의 `--impl-done` 검토 시 spec 불완전 지점이 된다.
- **제안**: `rag-rerank-followup.md` 에서 해당 항목(I1·I2)을 처리하는 별도 PR 을 조기 진행하거나, `spec/5-system/1-auth.md` 를 `project-planner` 가 갱신해 `rag-rerank-followup.md` pending_plans 해소로 이어지게 한다. 현 상태에서 `exec-park-durable-resume` 작업 자체는 차단되지 않음 — 단 다음 `--impl-done` spec/5-system 전체 검토 전 처리 권장.

---

### [WARNING] spec-update-pr2a-active-running-invariants.md: 이미 반영된 항목이 in-progress에 잔존

- **target 위치**: `spec/5-system/4-execution-engine.md §8`, §Rationale `>=` 보수적 판정 명시
- **관련 plan**: `plan/in-progress/spec-update-pr2a-active-running-invariants.md` (worktree `impl-exec-concurrency-cap`)
- **상세**: 이 plan 이 제안한 핵심 변경(INFO #1 — `>=` 보수적 판정 명시)은 `spec/5-system/4-execution-engine.md §Rationale` 에 이미 반영됐다 ("`activeNow >= maxActiveRunningMs`…보수적으로 안전하다" 문구 확인). plan 이 `in-progress/` 에 잔존하나 주요 작업이 완료 상태다. `plan/complete/` 이동 또는 잔여 항목(INFO #2·#3 Rationale 보강) 확인 필요.
- **제안**: `plan/in-progress/spec-update-pr2a-active-running-invariants.md` 의 미완료 항목(INFO #2·#3)을 검토하고, 완료됐다면 `plan/complete/` 로 이동. `spec/5-system/4-execution-engine.md` 의 `pending_plans` 에서 제거 여부도 함께 판단.

---

### [INFO] exec-park-durable-resume plan의 D3 미결정 — spec 충돌 없음

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5` rehydration 실패 케이스 표
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` — "D3: park 중 워크플로 정의 편집 시 재개 정책"
- **상세**: D3 는 명시적으로 미결정(미확정)이며, 현재 spec 은 `RESUME_INCOMPATIBLE_STATE` 를 "schema drift 로 재구성 실패" 케이스로만 기술하고 워크플로 정의 편집 시나리오를 별도로 다루지 않는다. Phase B 착수 전 결정 사항이며, 현 spec 이 D3 를 일방적으로 결정하거나 충돌하지 않는다 — 현재 정합. Phase B 착수 전 D3 를 확정하고 spec §7.5 또는 §Rationale 에 반영하면 된다.
- **제안**: Phase B 착수 전 D3 결정 후 `4-execution-engine.md` §Rationale 에 "워크플로 정의 편집 시 재개 정책" 항목을 추가한다 (plan 에 이미 명기됨).

---

### [INFO] Phase B spec 선행 의무 (D4 Rationale 명문화) — 아직 미착수 상태로 정합

- **target 위치**: `spec/5-system/4-execution-engine.md §4.x` (park 즉시 해제 모델)
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` "Phase B 선행 — 구현 착수 전 의무" 항목
- **상세**: D4 "turn-단위 park Rationale 명문화" 는 Phase B 착수 전 의무로 plan 에 명시됐다. Phase B 항목 전체가 `[ ]` (미착수)이므로 아직 spec 갱신이 없는 것은 정상이다. 충돌 없음.
- **제안**: Phase B 착수 직전에 plan §"Spec 변경" 에서 언급한 spec 항목들(`4-execution-engine.md §4.x Rationale`, `§7.4`, `§7.5` fast-path 제거 반영)을 순서대로 진행. consistency-check `--spec` 의무 이행 시 자동 확인됨.

---

### [INFO] impl-exec-concurrency-cap worktree: 구 main base 로 인한 base-skew

- **target 위치**: `spec/5-system/4-execution-engine.md` 및 인접 파일들
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b`)
- **상세**: `git diff --name-only main...claude/impl-concurrency-cap-pr2b` 가 `spec/5-system/4-execution-engine.md` 를 포함하는 것처럼 보이나, 실제로 해당 브랜치는 A1 PR (#470) 머지 이전의 구 main base 에서 분기한 docs-only 커밋(plan 갱신 1개)만 가지고 있다. 실제 코드·spec 변경 없음 — A3 consistency check 가 이를 "stale-baseline 거짓양성" 으로 기록했다. 실질 spec/5-system 충돌 없음.
- **제안**: PR2b 착수 전 리베이스(현 A3 HEAD 기준) 시 false-positive 해소됨.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 2 PR #443 MERGED. `spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md` 포함 다수 변경 포함.
- `rag-rerank-impl` (branch `claude/rag-rerank-impl`) — Step 2 PR #465 MERGED. `spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md` 변경 포함.
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR #451 MERGED. `spec/5-system/4-execution-engine.md` 변경 포함.
- `kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) — Step 2 PR #457 MERGED.
- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 2 PR #463 MERGED.
- `makeshop-api-catalog-730deb` (branch `claude/makeshop-api-catalog-730deb`) — Step 2 PR #456 MERGED. `spec/5-system/11-mcp-client.md` 변경 포함.
- `rag-rerank-decisions-dd1d68` — Step 2 squash-merge PR #460 (plan 기록 확인).
- `rag-quality-proposal-0c618c` — Step 2 squash-merge PR #455 (plan 기록 확인).
- `rag-rerank-followup-864891` (branch `claude/rag-rerank-followup-864891`) — Step 1·2 모두 ACTIVE(미merge), 단 실제 새 커밋 2개는 `spec/5-system/` 미수정 확인(테스트 파일만). base-skew artifact. skip 처리.

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`exec-park-durable-resume` plan 의 실제 새 커밋(`claude/exec-park-a3-variables`)은 `spec/5-system/4-execution-engine.md` 만 수정하며, 다른 active worktree 와 동일 파일을 동시 편집하는 실질적 충돌은 없다. 주요 발견사항은 두 가지 WARNING이다: (1) `rag-rerank-followup.md` 의 미해소 후속 항목(`spec/5-system/1-auth.md` RerankConfig RBAC·audit 행 누락)이 현재 spec 에 반영되지 않아 spec/5-system 전체 범위 impl-done 의 완결성 갭이 존재하며, (2) `spec-update-pr2a-active-running-invariants.md` 가 이미 반영된 항목을 in-progress 에 남긴 채 plan 생명주기 정리가 지연되고 있다. exec-park 자체의 Phase B / D3·D4 미결 사항은 의도된 순서 의존성으로 현재 spec 과 충돌하지 않는다. worktree 충돌 후보 9건 중 stale 9건 skip, active(실질 spec 충돌) 0건.

---

## 위험도

LOW
