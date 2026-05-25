# Plan 정합성 검토 결과

검토 모드: spec draft (--spec)
검토 대상: `plan/in-progress/spec-fix-presentation-common-frontmatter.md`
검토 일시: 2026-05-25
worktree: `telegram-carousel-button-click-5b52c1`

---

## 발견사항

### [INFO] 전이 경로 — spec-only → implemented 직접 승격의 적법성

- **target 위치**: plan §제안 변경 W6, 특히 "→ `status: implemented` 승격" 주장 및 `spec-impl-evidence §3.1` 전이 규칙 언급
- **관련 plan**: `plan/in-progress/spec-harness-impl-coverage.md` (완료되어 `plan/complete/spec-frontmatter-rollout.md` 에 반영됨)
- **상세**: `spec/conventions/spec-impl-evidence.md §3.1` 의 공식 전이 규칙은 `spec-only → partial` (최초 코드 머지 시점) → `partial → implemented` (마지막 pending_plans complete 시) 의 2단계 경로를 정의한다. 그러나 동 문서 §6 Rollout 정책은 "기존 머지된 PR 로 구현 완료된 spec → `implemented` + `code:` 채움" 을 별도 rollout 경로로 명시한다. `spec/4-nodes/6-presentation/0-common.md` 는 2022~2026 에 걸쳐 이미 광범위하게 구현이 완료된 상태이므로, `spec-only → implemented` 직접 승격은 롤아웃 정책의 명시적 예외에 해당한다. 가드 `spec-status-lifecycle.test.ts` 도 `spec-only → implemented` 직접 전이 자체를 차단하는 규칙을 포함하지 않는다 (TTL, partial pending_plans, backlog 매칭만 검사). 따라서 단계 skip 은 규약 위반이 아니다.
- **제안**: 차단 사항 없음. 단, plan 본문에 "rollout 정책(§6) 적용 — 구현 완료 기존 spec 의 소급 갱신" 이라는 사유 한 줄을 명시하면 향후 검토자의 혼동을 예방할 수 있다.

---

### [INFO] id 변경 부분 적용 — 타 카테고리 0-common.md 들은 id: common 유지

- **target 위치**: plan §W6 "id: common → id: presentation-common 변경"
- **관련 plan**: 없음 (다른 plan 에서 타 카테고리 0-common.md id 변경을 추적하지 않음)
- **상세**: 현재 `spec/4-nodes/{1-logic, 2-flow, 3-ai, 4-integration, 5-data}/0-common.md` 5개 파일이 모두 `id: common` 을 사용 중이다. target plan 은 이 중 presentation 카테고리 1개만 `id: presentation-common` 으로 변경한다. `spec-frontmatter.test.ts` 는 id 전역 유일성을 검증하지 않으므로 빌드 차단은 없다. 그러나 나머지 5개 파일의 `id: common` 중복은 convention_compliance INFO #I2 가 지목한 바와 같이 tooling 이 `id` 를 전역 키로 사용할 경우 오탐 위험이 남는다. 본 plan 은 부분 해소만 수행하며, 나머지 5개에 대한 후속 처리 plan 이 없다.
- **제안**: target plan 의 Side-effect 점검 절에 "타 카테고리 0-common.md 5개의 `id: common` 중복은 본 PR 범위 외 — 별도 일괄 정합화 plan 필요 여부 결정" 한 줄 추가 권장. 즉각 차단 사항은 아님.

---

### [INFO] spec-drift-ws-button-config.md — 직교 확인

- **target 위치**: plan §Side-effect 점검 마지막 bullet "consistency-check W1/W2 (WS spec §4.4 buttonConfig.timeout / nodeOutput.type) 는 별도 plan spec-drift-ws-button-config.md 가 추적 중 — 본 PR 변경과 직교"
- **관련 plan**: `plan/in-progress/spec-drift-ws-button-config.md` (worktree: `pending-assignment`)
- **상세**: target plan 이 직교성을 올바르게 식별했다. `spec-drift-ws-button-config.md` 는 `spec/4-nodes/6-presentation/0-common.md` 의 §3/§4/§6.1 *본문 내용* (timeout 정책, Principle 1.1.4) 을 인용하지만, 변경 대상은 `spec/5-system/6-websocket-protocol.md §4.4` 이다. target plan 의 변경 범위는 `0-common.md` frontmatter 와 §9 CHANGELOG 만이므로 내용 충돌이 없다.
- **제안**: 차단 사항 없음.

---

### [INFO] workflow-resumable-execution plan — stale worktree skip

- **관련**: `plan/in-progress/workflow-resumable-execution.md` 가 `spec/4-nodes/6-presentation/0-common.md §10.9` 내용 변경을 Phase 0 완료 항목으로 포함한다. 해당 plan 의 worktree `workflow-resumable-execution-phase2-cont-64f537` 이 worktree 충돌 후보.
- **stale 판정**: Step 1 — `git merge-base --is-ancestor claude/workflow-resumable-execution-phase2-cont-64f537 origin/main` 결과 ACTIVE_OR_MISSING (exit 1). Step 2 — `gh pr list --state all --head claude/workflow-resumable-execution-phase2-cont-64f537 --json state` 결과 **MERGED**. → **stale** 판정.
- **처리**: CRITICAL 분류 제외. §9 CHANGELOG 신규 항목과 frontmatter 변경은 이미 main 에 머지된 해당 PR 과 충돌 없음. 현재 main 에 있는 `0-common.md` frontmatter (`id: common`, `status: spec-only`, `code: []`) 가 SoT 이며 target plan 이 그 위에서 신규 변경을 적용한다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `workflow-resumable-execution-phase2-cont-64f537` (branch `claude/workflow-resumable-execution-phase2-cont-64f537`) — Step 1 ancestor check 음성 (exit 1), Step 2 PR MERGED

해당 worktree 가 `.claude/worktrees/` 에 물리적으로 잔류하고 있을 경우 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`plan/in-progress/spec-fix-presentation-common-frontmatter.md` 는 `spec/4-nodes/6-presentation/0-common.md` 의 frontmatter (`status: spec-only → implemented`, `id: presentation-common`, `code:` 4개 glob) 와 §9 CHANGELOG 신규 항목을 변경하는 좁은 scope 의 spec 정비 plan 이다. 미해결 결정과의 충돌 없음 — `spec-drift-ws-button-config.md` 가 동일 파일의 본문 내용 정합화를 추적하지만 대상 레이어(frontmatter/CHANGELOG vs 본문)가 완전히 직교한다. 병렬 worktree 경합 위험 없음 — 유일한 충돌 후보인 `workflow-resumable-execution-phase2-cont-64f537` 이 PR MERGED 로 stale 판정되어 제외. 선행 plan 미해소 사항 없음 — spec-frontmatter-rollout 이 `plan/complete/` 로 이동 완료되어 frontmatter 규약이 이미 발효된 상태. 후속 항목으로는 타 카테고리 `0-common.md` 5개의 `id: common` 중복 해소 plan 이 없다는 점이 INFO 수준 추적 권장 사항으로 남는다. worktree 충돌 후보 1건 중 stale 1건 skip, active 0건 분석.

---

## 위험도

NONE
