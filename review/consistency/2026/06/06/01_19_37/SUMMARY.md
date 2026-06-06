# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. PR-B2 착수 차단 사유 없음.

## 전체 위험도
**LOW** — Critical 0 / Warning 4 (중복 통합) / Info 5. 모든 Warning 은 문서 currency 갭 또는 머지 조율 이슈이며 구현을 차단하지 않는다.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Rationale Continuity / Cross-Spec (통합) | D3 "fresh-config-per-turn" 번복이 §6.3 Multi-turn resume 행 및 `13-replay-rerun.md §14.3` 에 미전파 — 독자가 옛 "per-conversation frozen" 모델로 오인 가능 | `spec/5-system/4-execution-engine.md §6.3` 표 Multi-turn resume 행; `spec/5-system/13-replay-rerun.md §14.3` | `4-execution-engine.md §6.2 L672` + `§Rationale L1255` (D3 이미 기록) | PR-B2 spec 동기 갱신 시 §6.3 표에 "frozen 범위 = 한 turn(D3)" cross-ref 추가; §13 §14.3 에 D3 한 줄 단서 + §6.2 링크 추가. developer 는 spec write 불가 — project-planner 위임 필요 |
| W2 | Rationale Continuity | plan `exec-park-durable-resume.md §Spec 변경` 목록이 §6.3 / §13 §14.3 D3 정합화 앵커를 미열거 (W1 의 근본 원인) | `plan/in-progress/exec-park-durable-resume.md §Spec 변경` | — | PR-B2 착수 전 plan spec-갱신 체크리스트에 §6.3 표 행 + §13 §14.3 두 앵커를 추가 → W1 자연 해소 |
| W3 | Plan Coherence / Convention Compliance (통합) | 병렬 worktree `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) 가 동일 `spec/5-system/4-execution-engine.md` 를 Phase B 이전 baseline 으로 수정 중 — 라인 충돌 없으나 content-staleness 로 인한 Phase B 서술 덮어쓰기 위험 | `spec/5-system/4-execution-engine.md` (pr2b diff: §4.2/§8/§10.2/§7.5 Rationale/末 Rationale, 23ins/8del) | `claude/impl-concurrency-cap-pr2b` (merge-base `9f30216f` #468) | PR-B2 머지 전 pr2b 의 main rebase 선행을 머지 조건으로 명기; PR-B2 는 변경 범위를 Phase B turn-park/barrier 제거에 한정해 pr2b 텍스트 교집합 최소화 |
| W4 | Plan Coherence | `pendingContinuations`/barrier 제거(B3) 와 `node-cancellation-infrastructure.md §2`(미착수 worktree) 간 dispatch-경로 코드 영역 겹침; `exec-intake-queue-impl.md` PR3 이관 표기 미완 (Phase 0 L143 `[ ]` 미닫힘) | `plan/in-progress/exec-park-durable-resume.md Phase 0 L142-143`; `plan/in-progress/exec-intake-queue-impl.md PR3 항목` | `node-cancellation-infrastructure.md §2`; `exec-intake-queue-impl.md` | PR-B2 착수 전 Phase 0 L142 직렬화 순서 확정 + L143 이관 표기 닫기; `exec-intake-queue-impl.md` PR3 항목에 "→ exec-park-durable-resume 이관" 표기 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `1-ai-agent.md §12` config-echo 서술(`state.rawConfig frozen snapshot`)이 D3 fresh-per-turn 경계를 미언급 — 충돌 아님(echo 형태 vs turn 경계 직교 불변식) | `spec/4-nodes/3-ai/1-ai-agent.md §12` | PR-B2 spec 동기 갱신 시 `1-ai-agent.md §7` 또는 §12 에 §6.2 cross-link 1줄 추가(선택) |
| I2 | Cross-Spec | `13-replay-rerun.md §6.3 참조` Multi-turn resume 행도 동일 frozen-snapshot 표현 — 충돌 아님(I1 과 동일 계열) | `spec/5-system/13-replay-rerun.md §6.3` | SoT(§6.2) 갱신만으로 충분, 별도 수정 불요 |
| I3 | Convention Compliance | V084/V085 마이그레이션 파일이 `4-execution-engine.md` frontmatter `code:` glob 에 미포함 — migrations.md glob + data-model 기술로 evidence 충분, 미조치 가능 | `spec/5-system/4-execution-engine.md` frontmatter | 조치 선택 |
| I4 | Naming Collision | `stageConversationThreadSnapshot` → `stageDurableResumeSnapshot` rename(A3) 이 service 전반에 완전 적용됨 — 구 이름 잔존 참조 0건, drift 없음 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` | 해소 확인만 |
| I5 | Naming Collision | 병렬 pr2b worktree 가 마이그레이션 추가 시 V086(agent_memory 인덱스 점유)과 충돌 가능 — 현재 main/본 worktree 충돌 없음, pr2b 착수 시 V087+ renumber 필요 | `codebase/backend/migrations/` (pr2b 미착수) | pr2b 착수 시 타 worktree 가 조율 (plan 진행메모 W4 에 이미 명기) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Critical 0 / Warning 0 / Info 2. 6개 인접 영역(data-model, websocket-protocol, replay-rerun, EIA, chat-channel, AI-agent) 과 데이터 모델·API·상태전이·권한·계층 책임 모두 정합. Info 2건은 frozen-snapshot 문서 currency 갭 |
| Rationale Continuity | LOW | Critical 0 / Warning 2 / Info 0. 기각 대안 재도입·원칙 위반·invariant 우회 없음. 번복 3건 모두 새 Rationale 동반. W1(D3 미전파)·W2(plan 체크리스트 누락)이 reader-level drift 위험 |
| Convention Compliance | LOW | Critical 0 / Warning 2 / Info 3. 명명·출력포맷·문서구조·금지항목 모두 준수. W1(과도기 인라인 주석 잔존, PR-B2 정리 대상)·W2(cross-worktree 머지 리스크) |
| Plan Coherence | LOW | Critical 0 / Warning 2 / Info 3. D1~D5 확정·Phase A/B1 선행조건 해소 확인. W1(pr2b content-staleness)·W2(B3-node-cancellation 코드 영역 겹침·PR3 이관 미완) |
| Naming Collision | NONE | Critical 0 / Warning 0 / Info 3. 마이그레이션·컬럼·에러 코드·내부 심볼·큐 이름·파일 경로 전수 점검 충돌 없음 |

---

## 권장 조치사항

1. **(W2, 즉시)** `plan/in-progress/exec-park-durable-resume.md §Spec 변경` 체크리스트에 `§6.3 표 Multi-turn resume 행` 및 `13-replay-rerun.md §14.3` 두 앵커를 추가해 W1·W2 동시 해소.
2. **(W1, PR-B2 spec 갱신 시)** project-planner 위임으로 `spec/5-system/4-execution-engine.md §6.3` 표에 "frozen 범위 = 한 turn(D3) — §6.2/§Rationale" cross-ref 1줄, `spec/5-system/13-replay-rerun.md §14.3` 에 D3 단서 + §6.2 링크 추가.
3. **(W4, PR-B2 착수 전)** Phase 0 L142 node-cancellation §2 직렬화 순서 확정·L143 이관 표기 닫기; `plan/in-progress/exec-intake-queue-impl.md` PR3 에 이관 표기 추가.
4. **(W3, 머지 게이트)** PR-B2 머지 전 `claude/impl-concurrency-cap-pr2b` 가 현행 main 을 rebase 완료하도록 조율. PR-B2 변경 범위를 Phase B turn-park/barrier 제거에 한정해 텍스트 교집합 최소화.
5. **(I1, 선택)** PR-B2 spec 갱신 시 `spec/4-nodes/3-ai/1-ai-agent.md §7` 또는 §12 에 `§6.2` cross-link 1줄 추가(문서 currency 완결).
