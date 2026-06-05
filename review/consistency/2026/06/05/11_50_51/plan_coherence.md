# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (`--impl-prep`, scope=`spec/5-system/`)
검토 일시: 2026-06-05
대상 worktree: `exec-park-durable-resume`
대상 plan: `plan/in-progress/exec-park-durable-resume.md`

---

## 발견사항

### [INFO] exec-park-durable-resume plan 이 `spec/5-system/4-execution-engine.md` 에 집중 — 1-auth·10-graph-rag·11-mcp-client 는 충돌 없음

- target 위치: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md`
- 상세: target scope(`spec/5-system/`) 에는 auth/graph-rag/mcp-client 도 포함된다. 본 plan 은 이 세 파일을 수정하지 않으며, 세 파일에 등재된 `pending_plans`(`auth-config-webhook-followups.md`, `spec-sync-auth-gaps.md`, `spec-sync-mcp-client-gaps.md`)도 본 plan 과 별개 도메인 — 충돌 없음.
- 제안: 별도 조치 불요.

---

### [INFO] `exec-intake-queue-impl.md` worktree `impl-exec-concurrency-cap` — Step 2 MERGED (PR #469), stale skip 대상

- target 위치: `exec-park-durable-resume.md` §Phase 0 / 미해결 결정 D5
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` (worktree: `impl-exec-concurrency-cap` → branch `claude/impl-exec-concurrency-cap`)
- 상세: Step 1(git ancestor) — ACTIVE (squash merge 가능성). Step 2(gh pr) — PR #469 state: `MERGED`. 따라서 stale 판정. `exec-park-durable-resume.md` 은 이를 이미 인지해 "D5: exec-intake-queue PR3 는 미구현(docs 커밋 `01bca178`), 흡수할 코드 없으므로 Phase A2/B2 에서 직접 구현"으로 명시함. plan 간 정합성 유지됨.
- 제안: `claude/impl-exec-concurrency-cap` worktree 정리 권장(`cleanup-worktree-all.sh`).

---

### [INFO] `spec-frontmatter-status-migration-027c17` worktree — Step 2 미조회(no PR found), stale 판정 불가 → active 처리

- 관련 plan: `plan/in-progress/execution-engine-residual-gaps.md` (worktree: `spec-frontmatter-status-migration-027c17`)
- 상세: Step 1 — ACTIVE, Step 2 — `gh pr list --head spec-frontmatter-status-migration-027c17` 결과 없음(branch 원격 미추적). Fallback Step 3 — active 로 보수 처리. `execution-engine-residual-gaps.md` 의 G1/G2 는 BLOCKED 상태(spec 설계 미완), G3 완료. 본 plan(`exec-park-durable-resume`)은 G2 의 `WAITING_FOR_INPUT`/rehydration 영역을 다루지만, G2 는 `errorPolicy='continue'` SIGTERM interrupt 전용으로 park 해제·slow-path 일원화와는 별개 문제. 겹치는 파일(`4-execution-engine.md`)을 동시 수정할 가능성은 있으나 G2 는 BLOCKED 비착수 상태라 실 경합 위험 낮음.
- 제안: `spec-frontmatter-status-migration-027c17` 가 실제로 비활성이면 정리 후 재검토. 가능하면 g2 진행 전 본 plan 의 B 단계 완료 후 직렬화.

---

### [WARNING] `exec-park-durable-resume.md` Phase B spec 갱신 항목 중 §7.4 fast-path 서술 제거가 `continuation-resume-optional-followups.md` 의 double-drive optimistic lock 항목을 무효화 가능

- target 위치: `exec-park-durable-resume.md` §Spec 변경 — `4-execution-engine.md §7.4` "Worker 동작 행의 로컬 pendingMap 즉시 resolve(fast-path) 서술 정정"
- 관련 plan: `plan/in-progress/continuation-resume-optional-followups.md` §"멀티 인스턴스 double-drive optimistic lock" (worktree: `continuation-worker-concurrency-env`)
- 상세: `continuation-resume-optional-followups.md` 의 미착수 항목 "멀티 인스턴스 double-drive optimistic lock"은 fast-path(`pendingContinuations`)와 동시 구동 윈도우가 전제다. Phase B3 에서 `pendingContinuations` Map 을 제거하면 해당 항목의 전제가 제거돼 항목 자체가 무효화된다. 현재 `continuation-resume-optional-followups.md` 에는 이 항목이 여전히 열린 TODO 로 남아 있다.
- 제안: `exec-park-durable-resume.md` Phase B3 완료 후 `continuation-resume-optional-followups.md` 의 "double-drive optimistic lock" 항목에 "fast-path 제거(Phase B3)로 전제 소멸 — 닫힘" 표기 추가. Phase B spec 변경 계획에 이 후속 플래그를 메모로 등재하면 좋음.

---

### [WARNING] `node-cancellation-infrastructure.md` §2 와의 직렬화 순서가 Phase 0 에서 "확정" 표시인데 실제 확정 내용이 미기재

- target 위치: `exec-park-durable-resume.md` §Phase 0 — "(A2/B 착수 전) node-cancellation §2 재개 경로 직렬화 순서 확정"
- 관련 plan: `plan/in-progress/node-cancellation-infrastructure.md` §2 (worktree: `(unstarted)`)
- 상세: `node-cancellation-infrastructure.md §2` 는 `NodeExecution.status='cancelled'` enum/migration + AbortError 분류 + dispatch 사전체크로 구성된다. `exec-park-durable-resume.md` 는 "직렬화 순서·status 가드 겹침 확정"을 Phase 0 의 착수 전 의무로 명시하나, 미해결 결정(D1~D5) 에 이 항목의 결론이 없다. 두 plan 이 동시 착수 시 `NodeExecution.status` 컬럼 및 rehydration 경로가 경합할 수 있다. `node-cancellation-infrastructure.md` 는 아직 unstarted 이므로 현재 실 충돌은 없지만, Phase A2/B 착수 전 직렬화 결론이 plan 에 기재되지 않으면 착수 시 공백이 남는다.
- 제안: `exec-park-durable-resume.md` §Phase 0 에 "node-cancellation §2 직렬화 결론(선행/후행) 를 D6 결정으로 명시" 등재 권장. node-cancellation plan 착수 시 `WAITING_FOR_INPUT` 재개 경로(`execution-continuation` 큐)를 건드리지 않는다는 명시적 범위 구분도 필요.

---

### [INFO] `workflow-execution-turn-timing.md` (PR #445, worktree `workflow-turn-timing-69fee2`) — `4-execution-engine.md` 보다 `6-websocket-protocol.md` 접촉이 주, 충돌 제한적

- target 위치: N/A (충돌 아님)
- 관련 plan: `plan/in-progress/workflow-execution-turn-timing.md`
- 상세: `workflow-execution-turn-timing.md` 는 `spec/5-system/6-websocket-protocol.md §4.4` 에 `startedAt`/`finishedAt` 필드를 추가하는 작업이다. `exec-park-durable-resume.md` 는 해당 파일을 건드리지 않는다. Step 1 ACTIVE, Step 2 PR #445 번호만 plan 에 기재됐고 `gh pr list` 에서 해당 branch 의 PR 을 찾지 못함(branch 이름 불일치 가능). 실 경합 파일 없으므로 충돌 없음.
- 제안: 별도 조치 불요.

---

### [INFO] `execution-engine-residual-gaps.md` 의 G2 는 `exec-park-durable-resume` 과 목표가 겹치나 선행 해소 요건 별개

- target 위치: `exec-park-durable-resume.md` §Phase B2 재개 경로 일원화
- 관련 plan: `plan/in-progress/execution-engine-residual-gaps.md` §G2 (BLOCKED)
- 상세: G2 는 errorPolicy='continue' SIGTERM 분기 전제가 미정의라 BLOCKED. Phase B2(slow-path 일원화)가 완성되면 G2 의 "cross-instance mid-execution 재개 인프라 부재" 장애물 3이 해소되어 G2 의 BLOCKED 이유 중 하나가 사라진다. 그러나 G2 의 장애물 1(errorPolicy schema 노출, `parallel-p2.md §1` 미완료)·장애물 2(용어/구현 매핑)는 별개로 남는다. Phase B 완료 후 G2 의 장애물 재검토가 자연스럽다.
- 제안: `exec-park-durable-resume.md` §진행 메모 또는 리스크에 "Phase B 완료 시 `execution-engine-residual-gaps.md G2` 장애물 3 해소 → G2 BLOCKED 재검토 가능" 메모 추가 권장.

---

### [INFO] `spec-sync-execution-engine-gaps.md` 의 미완 잔여 항목 — `3-execution.md §1.1/§2.2` mermaid 갱신

- target 위치: `exec-park-durable-resume.md` §Spec 변경 목록
- 관련 plan: `plan/in-progress/spec-sync-execution-engine-gaps.md` §SPEC-DRIFT "잔여: `3-execution.md §1.1/§2.2` mermaid 갱신(project-planner 후속)"
- 상세: `exec-park-durable-resume.md` 의 spec 변경이 `4-execution-engine.md` §4.x/§7.4/§7.5/§6.2 에 집중되며, `3-execution.md §1.1` 시퀀스 다이어그램 갱신은 목록에 없다. Phase B 에서 재개 경로 변경이 완료되면 `3-execution.md §1.1` mermaid 가 구식(old in-process 흐름)으로 더욱 stale 해진다. 현재 이 잔여 항목은 `spec-sync-execution-engine-gaps.md` 에 "project-planner 후속"으로 열려 있다.
- 제안: `exec-park-durable-resume.md` §Spec 변경에 "Phase B 완료 후 `spec/data-flow/3-execution.md §1.1/§2.2` mermaid 갱신이 `spec-sync-execution-engine-gaps.md` 잔여 항목에서 triggerable" 메모 추가 권장.

---

### [INFO] `D2`(user-defined variables 영속) 미결 결정이 Phase B spec 갱신 범위에 반영되지 않음

- target 위치: `exec-park-durable-resume.md` §미해결 결정 D2 / §Spec 변경 / §Phase A3
- 관련 plan: 동일 plan 내부 일관성
- 상세: D2 는 "user-defined variables 복원을 본 plan 에 포함할지, 별도 plan 분리할지" 미결이다. 현재 §Spec 변경 목록에 variables 영속화가 없다. Phase B spec(`§7.5` rehydration 무손실 보장 명시)에는 conversationThread 만 언급되고 variables 는 조건부다. A3 도 "범위 확인 필요" 상태다. 현재 Phase B 착수 전 D2 결론이 내려지지 않으면 "§7.5 에 variables 복원 포함 여부"가 모호한 상태로 spec 갱신이 이뤄진다.
- 제안: Phase B spec 착수 전 D2 결론을 명시해 §7.5 서술 범위를 확정 권장. "variables 제외, 별도 plan" 결론이면 §7.5 에 명시적 제외 사유 추가.

---

### [INFO] `A2b` information_extractor 분리 항목이 "ai_agent 한정" 문구 3곳 갱신을 후속으로 남김 — 현재 spec `spec/5-system/4-execution-engine.md §1.3` 등에 미갱신 상태

- target 위치: `exec-park-durable-resume.md` §A2b / §Spec 변경 "A2 채택 시 문구 3곳 동기 갱신"
- 관련 plan: 동일 plan 내부 항목
- 상세: A2a 는 완료됐으나 A2b(IE 멀티턴 checkpoint 확장)는 "분리, 후속"으로 열려 있다. spec의 "ai_agent 한정" 문구 3곳(`4-execution-engine.md §1.3`, `3-information-extractor.md`, `1-ai-agent.md`)은 A2b 채택 시에만 갱신 예정이므로 현재 spec 은 정확하다. 단 A2b 가 별도 plan 으로 분리된다면 해당 후속 plan 이 이 3곳을 인수해야 함이 현재 명시되지 않았다.
- 제안: A2b 를 별도 plan 으로 분리할 때 "ai_agent 한정 문구 3곳 갱신" 항목을 신규 plan 에 명시적으로 이관 기록 권장.

---

## Stale 으로 skip 한 worktree (의무 — 발견 목록)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `impl-exec-concurrency-cap` (branch `claude/impl-exec-concurrency-cap`) — Step 1 ACTIVE(squash merge), Step 2 PR #469 MERGED. 스킵 사유: squash merge 로 Step 1 통과 못 했으나 PR MERGED.

worktree 충돌 후보 중 Fallback(Step 3 active 처리) 항목:

- `spec-frontmatter-status-migration-027c17` (원격 미추적) — Step 1 ACTIVE, Step 2 no PR found. Fallback active 처리 — 실제 stale 이면 `cleanup-worktree-all.sh --yes --force` 실행 후 재검토 권장.
- `continuation-worker-concurrency-env` — Step 1 ACTIVE, Step 2 no PR found (원격 미추적). Fallback active 처리.

해당 worktree 들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`exec-park-durable-resume.md` 는 `spec/5-system/` scope 내에서 주로 `4-execution-engine.md` 에 집중하며, 동일 scope 의 다른 파일(1-auth, 10-graph-rag, 11-mcp-client)과는 충돌이 없다. 미해결 결정 D1/D4/D5 는 plan 내에서 이미 확정됐고 target spec 갱신과 정합하다. 주요 주의사항 두 가지: (1) Phase B3 에서 `pendingContinuations` 제거 시 `continuation-resume-optional-followups.md` 의 double-drive 항목을 닫아야 함(WARNING), (2) Phase 0 에서 `node-cancellation §2` 와의 직렬화 결론이 D6 결정으로 명시되지 않아 착수 공백 위험(WARNING). INFO 6건은 후속 plan 등재·메모 추가 권장 수준으로 구현 차단 사유가 아니다. worktree 충돌 후보 3건 중 stale 1건 skip(PR #469 MERGED), active(Fallback) 2건 분석.

---

## 위험도

LOW
