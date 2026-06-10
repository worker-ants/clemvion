# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 한다

## 전체 위험도
**HIGH** — Cross-spec Critical 1건(`execution.submit_form` WS payload `nodeId` 제거가 3개 spec 에 미반영). 나머지 checker 는 모두 WARNING/INFO 수준.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C-1 | Cross-Spec | `execution.submit_form` WS payload shape 불일치 — `6-websocket-protocol.md` 는 `nodeId` 제거를 구현 현실로 확정했으나 3개 파일이 구(舊) shape `{ executionId, nodeId, formData, toolCallId? }` 를 SoT 로 유지 | `spec/5-system/6-websocket-protocol.md` §4.2 (정정 측) | `spec/3-workflow-editor/3-execution.md` §4.2 (라인 305) / `spec/4-nodes/6-presentation/0-common.md` §10.9 (라인 386·419·564) / `spec/5-system/14-external-interaction-api.md` §6 (라인 266) | 세 파일 동시 수정: `3-execution.md §4.2` submit_form 행, `0-common.md §10.9` "(1) 외부 WS wire" 행·Rationale "변경 없음" 문구, `14-external-interaction-api.md §6` submit_form 행에서 `nodeId` 제거. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `0-common.md §10.9` Rationale 가 "외부 wire payload 변경 없음" 을 호환 이유로 제시 — WS spec 이 이미 `nodeId` 미전달이 구현 현실임을 확인한 사실과 모순 | `spec/5-system/6-websocket-protocol.md` §R | `spec/4-nodes/6-presentation/0-common.md` §10.9 Rationale | `0-common.md §10.9` Rationale 의 wire 유지 근거를 신 payload 기준으로 업데이트. (C-1 수정 시 함께 처리) |
| W-2 | Cross-Spec | Rerank provider Dropped 결정이 `spec/1-data-model.md §2.16.1` RerankConfig `provider` 필드에 미반영 — 여전히 "Planned(후속): jina/voyage/local/builtin" 으로 표기 | `spec/5-system/7-llm-client.md` §2.1 (Dropped 결정 측) | `spec/1-data-model.md §2.16.1` RerankConfig `provider` 필드 설명 | `spec/1-data-model.md §2.16.1` 의 `provider` 설명을 "Dropped (2026-06-05 결정) — [LLM Client §2.1](./5-system/7-llm-client.md)" 로 교체. |
| W-3 | Cross-Spec | `spec-impl-evidence.md` 가드 수 교정("4건") 이 §4 본문 가드 실제 목록과 일치하는지 확인 불완전 | `spec/conventions/spec-impl-evidence.md` 라인 31 | 동일 파일 §4 가드 항목 목록 | §4 가드 항목을 직접 열거해 "4건" 과 일치하는지 검증. |
| W-4 | Convention Compliance | `spec/1-data-model.md` frontmatter: `status: implemented` 이면서 `pending_plans: [plan/in-progress/exec-park-durable-resume.md]` 가 공존 — `spec-impl-evidence.md §3` 규약 위반 | `spec/1-data-model.md` frontmatter | `spec/conventions/spec-impl-evidence.md §3` (implemented = pending_plans 없음) | `status: partial` + `pending_plans` 유지로 교정. 또는 `exec-park` plan 이 data-model 변경이 아니면 `pending_plans` 제거 후 `status: implemented` 유지. |
| W-5 | Convention Compliance | `plan/in-progress/spec-sync-common-gaps.md` `worktree: spec-sync-audit` — 현존하지 않는 worktree 이름 참조. 실존 worktree 는 `spec-sync-audit-998544` | `plan/in-progress/spec-sync-common-gaps.md` frontmatter | `.claude/docs/plan-lifecycle.md §4` (worktree 실존 이름 또는 `(unstarted)`) | `worktree: spec-sync-audit-998544` 로 갱신. |
| W-6 | Plan Coherence | `ai-context-memory-followup-v2.md` I1 open 체크박스 — target 이 `17-agent-memory.md §3` 큐 spec-drift 를 완수했으나 plan 체크박스 미갱신 | `spec/5-system/17-agent-memory.md §3` (완수 측) | `plan/in-progress/ai-context-memory-followup-v2.md` line 71 (`[ ] SPEC-DRIFT I1`) | 병합 전후 `ai-context-memory-followup-v2.md` line 71 을 `[x]` 로 표기 + 완료 커밋 참조 추가. |
| W-7 | Plan Coherence | `spec-sync-resume-dispatch-registry.md` W1 open 체크박스 — target 이 `4-execution-engine.md §7.5` 에 `dispatchResumeTurn`/`resumeTurnRegistry`/`resume-turn-dispatch.ts` 를 반영했으나 plan W1 미갱신 | `spec/5-system/4-execution-engine.md` §7.5 (완수 측) | `plan/in-progress/spec-sync-resume-dispatch-registry.md` W1 | 병합 전후 W1 을 `[x]` 로 표기. W2 는 별도 작업으로 유지. |
| W-8 | Naming Collision | `NodeTypeMetadata.kind` 값 집합 (`container`/`parallel` 등) 이 기존 `executionMetadata.kind` 와 동일 어휘를 다른 객체에서 재사용 — 독자 혼동 유발 | `spec/5-system/4-execution-engine.md §5.4` 신규 `NodeTypeMetadata` | `spec/4-nodes/1-logic/9-foreach.md` (executionMetadata.kind = 'container') 외 2개 | `§5.4` 표 하단에 "executionMetadata.kind(핸들러 런타임 출력)와 동일 어휘지만 별개 객체·별개 소비처" 한 줄 주석 추가. 또는 `NodeTypeMetadata.kind` → `dispatchKind` rename. |
| W-9 | Naming Collision | 신규 BullMQ 큐 `agent-memory-extraction` 이 `spec/5-system/16-system-status-api.md` §1 모니터링 레지스트리에 누락 — `data-flow/0-overview.md` 15개 vs `16-system-status-api.md` 14개 count 불일치 | `spec/data-flow/0-overview.md §4` / `spec/data-flow/13-agent-memory.md` / `spec/5-system/17-agent-memory.md` | `spec/5-system/16-system-status-api.md` §1 큐 레지스트리 표 | `16-system-status-api.md §1` 표에 `\| agent-memory-extraction \| knowledge-base \| 2 \| Agent Memory 턴 경계 비동기 추출 \|` 행 추가. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | AuditLog `re_run_initiated` 가 `<resource>.<verb>` naming 규약에서 이탈; `spec/conventions/` 에 action naming 규약 문서 없음 | `spec/data-flow/1-audit.md` + `spec/5-system/1-auth.md §4.1` | `spec/conventions/` 또는 `auth.md §4.1` 에 action naming 규약(`<resource>.<verb>` + 예외 `re_run_initiated`) 간략 기술. |
| I-2 | Cross-Spec | `NodeHandlerRegistry.register` 3인자 시그니처 변경이 `spec/4-nodes/0-overview.md` 에 미반영 가능성 | `spec/5-system/4-execution-engine.md §5.4` | `4-nodes/0-overview.md` 에서 register 패턴 언급 부분에 `metadata?` 인자 반영 또는 §5.4 링크 추가. |
| I-3 | Cross-Spec | `spec/data-flow/13-agent-memory.md` 가 BullMQ 큐 파라미터(concurrency, jobId 패턴)를 직접 담아 이중 SoT 위험 존재 (현재는 양 파일 일치) | `spec/data-flow/13-agent-memory.md` + `spec/5-system/17-agent-memory.md §3` | data-flow 는 흐름 중심, 큐 파라미터 SoT 는 system spec 으로 역할 분리 권장 (현재 기능적 오류 없음). |
| I-4 | Rationale | `execution_node_log` 기록 시점이 "진입 로그"에서 "처리 완료 로그"로 변경됐으나 `spec/1-data-model.md` Rationale 미반영 | `spec/data-flow/3-execution.md §1.2` + `spec/1-data-model.md` Rationale "ExecutionNodeLog" | `spec/1-data-model.md` Rationale 해당 항에 "V035 이후 log 시점은 처리 완료(COMPLETED 또는 blocking output) 기준 — throw 경로 미기록. data-flow/3-execution.md §1.2 참조" 한 문장 추가. |
| I-5 | Rationale | agent memory 큐 토폴로지: "워크스페이스별 동시성 제한이 의도적으로 기각된 대안" 임을 Rationale 에 한 줄 보강하면 완성도 향상 | `spec/5-system/17-agent-memory.md §3 Rationale` | "과잉이다" 한 단어를 기각 사유 한 줄로 보강. |
| I-6 | Rationale | `7-llm-client.md` 구 Rationale 의 "jina/voyage 후속 확장" 언급이 drop 결정 이후에도 잔존 | `spec/5-system/7-llm-client.md` Rationale | 구 항에서 "jina/voyage 후속" 언급을 제거하거나 "drop 됨 (위 항 참조)" 으로 교체. |
| I-7 | Rationale | `spec/5-system/1-auth.md §4.2` 관리자 전용 감사 조회가 구현에서 미강제 — v1 보류 의도인지 spec 버그인지 Rationale 미명시 | `spec/data-flow/1-audit.md` | Rationale 또는 pending_plans 에 "관리자 접근 미강제" 가 의도된 보류인지 명시. |
| I-8 | Convention Compliance | `spec/conventions/execution-context.md` frontmatter `pending_plans: []` — `implemented` 시 키 자체 생략 권장 | `spec/conventions/execution-context.md` frontmatter | `pending_plans: []` 줄 삭제. |
| I-9 | Naming Collision | `OAUTH_PREVIEW_MISMATCH`(previewToken service_type 불일치) 와 기존 `OAUTH_STATE_MISMATCH`(OAuth state 파라미터 불일치) 가 `MISMATCH` 접미사를 다른 의미로 공유 | `spec/data-flow/5-integration.md §1.1` | `error-codes.md` 에 두 코드 구분 명시. 또는 `OAUTH_PREVIEW_MISMATCH` → `OAUTH_PREVIEW_SERVICE_MISMATCH` rename. |
| I-10 | Naming Collision | `integration_oauth_preview` 엔티티가 `spec/1-data-model.md` 에 미등록 (data-flow SoT 패턴과 일관성은 있으나 분산 SoT 잠재 위험) | `spec/data-flow/5-integration.md §2` | `spec/1-data-model.md §2` 하단에 `integration_oauth_state`/`integration_oauth_preview`/`integration_expiry_dispatch` 보조 엔티티 cross-reference 추가 권장. |
| I-11 | Plan Coherence | 머지 완료된 stale worktree 3개(`kb-lifecycle-groom-57cc46`, `kb-unsearchable-warning-b47e20`, `plan-complete-ai-review-backlog-85f80a`) 가 물리적으로 잔존 | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | `execution.submit_form` payload `nodeId` 제거가 3개 spec 에 미반영 (CRITICAL). Rerank provider Dropped 미동기 (WARNING). |
| Rationale Continuity | LOW | 전반적으로 Rationale 연속성 양호. `execution_node_log` 기록 시점 의미론 변경이 data-model Rationale 에 미반영 (INFO). |
| Convention Compliance | LOW | `spec/1-data-model.md` status/pending_plans 논리적 불일치 (WARNING). plan worktree 필드 실존 불일치 (WARNING). |
| Plan Coherence | LOW | target 이 완수한 spec-drift 항목 2건의 plan 체크박스 미갱신 (WARNING). CRITICAL/TBD 충돌 없음. |
| Naming Collision | LOW | `NodeTypeMetadata.kind` 어휘 혼동 가능성 (WARNING). `agent-memory-extraction` 큐 모니터링 레지스트리 누락 (WARNING). |

---

## 권장 조치사항

1. **(BLOCK 해소 최우선)** `spec/3-workflow-editor/3-execution.md §4.2`, `spec/4-nodes/6-presentation/0-common.md §10.9`, `spec/5-system/14-external-interaction-api.md §6` 세 파일을 동시 수정해 `submit_form`/`click_button` payload 에서 `nodeId` 제거. `0-common.md §10.9` Rationale 의 "변경 없음" 문구도 신 payload 기준으로 교체.
2. **(W-2)** `spec/1-data-model.md §2.16.1` RerankConfig `provider` 필드를 "Dropped (2026-06-05)" 로 교체.
3. **(W-4)** `spec/1-data-model.md` frontmatter `status` 를 `partial` 로 교정하거나 `pending_plans` 제거.
4. **(W-5)** `plan/in-progress/spec-sync-common-gaps.md` `worktree` 필드를 `spec-sync-audit-998544` 로 갱신.
5. **(W-9)** `spec/5-system/16-system-status-api.md §1` 표에 `agent-memory-extraction` 큐 행 추가.
6. **(W-6, W-7)** 병합 전후 `ai-context-memory-followup-v2.md` I1 과 `spec-sync-resume-dispatch-registry.md` W1 체크박스를 `[x]` 로 갱신.
7. **(W-3)** `spec-impl-evidence.md §4` 가드 항목을 직접 세어 "4건" 과 일치하는지 확인.
8. **(W-8)** `4-execution-engine.md §5.4` `NodeTypeMetadata.kind` 표 하단에 `executionMetadata.kind` 와의 구분 주석 추가.
9. **(I-4, I-8, I-6)** 나머지 INFO 항목은 이번 PR 범위에 포함하거나 후속 spec 정리 작업으로 위임.