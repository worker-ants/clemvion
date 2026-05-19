# Plan 정합성 검토 결과

**대상 plan**: `plan/in-progress/spec-followup-cron-7d-statemachine.md`
**worktree**: `spec-followup-cron-7d-statemachine-868886`
**검토 일시**: 2026-05-19

---

## 발견사항

### [WARNING] `spec/0-overview.md §6.2` Cafe24 항목 동시 수정 가능성

- **target 위치**: target plan A-3 — `spec/0-overview.md §6.2 cafe24 항목 (line 90)` "10일 임계 백그라운드 갱신" → "7일 임계 + 6h cron 백그라운드 갱신"
- **관련 plan**: `plan/in-progress/spec-overview-followups-2026-05-18.md §2` — "spec/0-overview.md §6.2 Cafe24 분류 정합화 (I-1)" 항목 (미완료 `[ ]` 상태). 이 항목은 Cafe24 통합 행 자체를 §6.2 → §6.1 로 이동하거나, §6.2 안에서 Cafe24의 분류 컬럼을 변경하는 구조적 재배치를 다룬다.
- **상세**: 두 plan 이 `spec/0-overview.md §6.2` 의 Cafe24 항목 동일 라인을 각각 다른 속성으로 수정한다. target plan 은 "10일" 숫자를 "7일"로 교체하고, `spec-overview-followups-2026-05-18.md §2` 는 항목 위치(§6.1로 이동) 또는 분류 컬럼 값을 변경한다. 두 PR 의 머지 순서에 따라 어느 한쪽이 다른 쪽 변경을 덮어쓸 수 있다. `spec-overview-followups-2026-05-18.md` 의 worktree 는 `TBD (per-item)` 으로 아직 활성화되지 않았으므로 실제 worktree 경합은 아니지만, 선행 작업 순서 조율이 필요하다.
- **제안**: target plan 의 §6.2 변경을 먼저 머지하고, `spec-overview-followups-2026-05-18.md §2` 가 그 이후 착수하면 갱신된 텍스트("7일 임계 + 6h cron 백그라운드 갱신")를 보존한 채로 분류 재배치를 수행할 수 있다. 대안으로, target plan 완료 후 `spec-overview-followups-2026-05-18.md §2` plan 의 배경 설명에 "텍스트는 이미 7일 임계로 갱신됨 — 분류 재배치만 수행" 메모를 추가한다.

---

### [INFO] `spec/2-navigation/4-integration.md` 와 `cafe24-backlog-residual.md` F-2 의 관계 미명시

- **target 위치**: target plan A-1 — `spec/2-navigation/4-integration.md §11.1 표`, `§10.5 본문`, `§1.4 Rationale`, `기타 인라인 참조 (line 1384)` 갱신. side-effect 점검 항목에 "F-2 가 해소되는지" 여부를 확인하도록 명시되어 있으나, 확인 결과의 기록이 없음.
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md` F-2 (미완료 `[ ]`) — `spec/2-navigation/4-integration.md §6` mermaid 에 `install_token` 보존 정책 명시. target plan 이 수정하는 §11.1 / §10.5 / §1.4 Rationale / line 1384 는 §6 mermaid 와 다른 섹션이므로 F-2 는 본 작업으로 해소되지 않는다.
- **상세**: target plan 의 "side-effect 점검 항목" 에서 이미 F-2 를 확인하도록 언급하고 있으나, 결론이 plan 본문에 기록되어 있지 않다. F-2 는 §6 mermaid (install_token 보존 정책) 를 다루고 target plan 은 §10.5 / §11.1 / Rationale 을 다루므로 영역이 분리된다. F-2 는 여전히 미해소로 남는다.
- **제안**: target plan 의 "side-effect 점검 항목" 에 "F-2 해소 여부: §6 mermaid 와 영역이 다르므로 해소 안 됨, cafe24-backlog-residual F-2 는 별도 처리 필요" 라는 결론을 추가 기록한다.

---

### [INFO] `ai-agent-turn-fail-finalize.md` 의 spec 후속 항목 — 본 plan 이 그 위임을 수행

- **target 위치**: target plan B-1 — `spec/5-system/4-execution-engine.md §1.1` 에 `waiting_for_input → failed` 전이 추가.
- **관련 plan**: `plan/in-progress/ai-agent-turn-fail-finalize.md` (worktree: `ai-agent-turn-fail-finalize-a22724`) 의 "후속 (별개 PR)" 항목 첫 번째: `spec/5-system/4-execution-engine.md §1.2` 상태머신 다이어그램에 `waiting_for_input → failed` 전이 명시 (project-planner 위임). 해당 항목은 미완료 `[ ]` 상태.
- **상세**: `ai-agent-turn-fail-finalize.md` 의 후속 항목이 "§1.2 상태머신 다이어그램" 이라고 표현하고 있으나, target plan 은 "§1.1 허용되는 상태 전이 표" 가 정확한 위치라고 결정 사항에 명시하고 있다. 이는 위치 표현 불일치로, 내용상 target plan 이 그 위임 작업을 올바르게 수행하고 있다. `ai-agent-turn-fail-finalize-a22724` worktree 는 PR #209 가 이미 머지(commit `e5f67670` 확인) 되었으며, 해당 항목의 미완료 체크박스는 현재 target plan 이 처리 중임을 의미한다.
- **제안**: target plan 완료 후 `ai-agent-turn-fail-finalize.md` 의 해당 후속 항목을 `[x]` 로 갱신하고, 위치 표현을 "§1.1 허용되는 상태 전이 표 (§1.2 가 아님)" 로 정정하는 chore commit 을 추가한다. target plan 의 "후속 항목 없음" 설명에 이 체크박스 갱신 chore 를 명시하면 추적이 명확해진다.

---

### [INFO] `node-output-redesign/ai-agent.md` P0 항목과의 관계

- **target 위치**: 해당 없음 (target plan 은 spec 정합화만 수행, node-output-redesign 범위 무관).
- **관련 plan**: `plan/in-progress/node-output-redesign/ai-agent.md` P0 — "ai-agent `buildErrorOutput` + `port:'error'` 추가" (single-turn LLM throw 엔진 FAILED 비대칭 해소). `ai-agent-turn-fail-finalize` PR (#209) 은 multi-turn turn-fail finalize 만 처리했고, single-turn 의 `output.error` + `port:'error'` 라우팅은 여전히 미구현이다.
- **상세**: target plan B-1 이 `spec/5-system/4-execution-engine.md §1.1` 에 추가하는 `waiting_for_input → failed` 전이는 multi-turn 경로만 명시한다. single-turn 의 `running → failed` 경로에서 `output.error` 라우팅을 추가하는 P0 구현이 나중에 착수될 때, 동일 spec 파일의 다른 절에 별도 전이 또는 주석이 필요할 수 있다. 현재 target plan 은 이를 범위 밖으로 명시하지 않고 있어 향후 혼동 가능성이 있다.
- **제안**: target plan 의 "후속 (본 plan 범위 외)" 절에 "single-turn LLM 에러의 `port:'error'` 라우팅은 `node-output-redesign P0` 범위로 별도 처리 — spec §1.1 에 추가 전이가 필요할 수 있음" 메모를 추가하면 추적이 명확해진다.

---

## 요약

target plan `spec-followup-cron-7d-statemachine.md` 는 코드 PR #212 / #209 에 대한 순수 spec 정합화 작업으로, 미해결 결정을 우회하거나 새로운 결정을 일방적으로 내리는 항목은 없다. 주요 관련 plan(`ai-agent-turn-fail-finalize.md`) 이 명시적으로 이 spec 갱신을 project-planner 에 위임한 항목이므로 선행 조건도 충족된다. 단, `spec/0-overview.md §6.2` 를 동일하게 수정하려는 `spec-overview-followups-2026-05-18.md §2` 와의 순서 조율이 필요하며 (WARNING 1건), F-2 해소 여부 확인 결론 기록과 후속 체크박스 갱신 chore 2건의 추적 메모(INFO 2건)가 권장된다. worktree 간 실제 파일 경합은 발생하지 않으며 (`spec-overview-followups-2026-05-18.md §2` 의 worktree 가 TBD 로 미활성), CRITICAL 차단 사유는 없다.

## 위험도

LOW

---

STATUS: OK
