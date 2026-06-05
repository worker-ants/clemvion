# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` (impl-done 모드, diff-base=origin/main)
검토 일시: 2026-06-05

---

## 발견사항

### [INFO] `spec/0-overview.md §2.4` 실행 엔진 설명 — park/slow-path 서술 일치

- **target 위치**: `spec/5-system/4-execution-engine.md §4.x`, Rationale "park 즉시 해제 + slow-path 일원화"
- **충돌 대상**: `spec/0-overview.md §2.4 Execution Engine`
- **상세**: `spec/0-overview.md §2.4` 의 실행 엔진 설명에 "**`waiting_for_input` 은 큐 없는 durable DB park** ([실행엔진 §4](./5-system/4-execution-engine.md#4-worker-모델))" 및 "단일 Execution **active-running 누적 타임아웃** (기본 30분 … `waiting_for_input` park 시간 제외)" 서술이 이미 `4-execution-engine.md §4.x` 의 durable park 모델과 일치한다. Phase B(park 즉시 해제 + slow-path 일원화)의 핵심 모델이 `0-overview.md` 에 이미 반영되어 있으므로 추가 동기화는 불필요하다.
- **제안**: 동기화 이슈 없음. 현 상태 유지.

---

### [INFO] `spec/1-data-model.md §2.13 Execution` — `conversation_thread` / `user_variables` 컬럼 서술 일치

- **target 위치**: `spec/5-system/4-execution-engine.md §6.2`, `spec/conventions/conversation-thread.md §4`
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution`
- **상세**: 데이터 모델의 `conversation_thread` (V084, JSONB?) 및 `user_variables` (V085, JSONB?) 컬럼 서술이 이미 `4-execution-engine.md §6.2·§7.5` 및 `conversation-thread.md §4·§8.4` 의 기술과 정합한다. 두 컬럼 모두 "park 직전 commit, rehydration 이 복원, park 외 stale 가능" 의미로 일관되게 기술되어 있다.
- **제안**: 동기화 이슈 없음. 현 상태 유지.

---

### [INFO] `spec/4-nodes/3-ai/3-information-extractor.md` — `_resumeCheckpoint` 적용 범위 서술 일치

- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` ("ai_agent · information_extractor 멀티턴 노드")
- **충돌 대상**: `spec/4-nodes/3-ai/3-information-extractor.md` (pending_plans 에 exec-park-durable-resume 등재)
- **상세**: 실행 엔진 §1.3 이 `_resumeCheckpoint` 적용 범위를 "ai_agent · information_extractor" 로 명시했고, `3-information-extractor.md §5.4` 와 §5.5 도 `waiting_for_input` / `resumed` 흐름을 동일 패턴으로 기술하며 pending_plans 에 exec-park-durable-resume 을 참조하고 있다. 두 영역의 서술이 정합한다.
- **제안**: 동기화 이슈 없음.

---

### [INFO] `spec/conventions/conversation-thread.md §4` — durable resume 스냅샷 정책 일치

- **target 위치**: `spec/5-system/4-execution-engine.md §6.2` "waiting_for_input 진입 시" 행
- **충돌 대상**: `spec/conventions/conversation-thread.md §4 영속화` 표
- **상세**: 실행 엔진 §6.2 의 "waiting_for_input 진입 시" 영속 목록(`Execution.conversation_thread` + `Execution.user_variables` + `NodeExecution.outputData._resumeCheckpoint`)과 `conversation-thread.md §4` 의 park 진입 시 영속 항목이 일치한다. §8.4 의 "신규 컬럼 없음 → durable park resume 한정 전환" 결정도 실행 엔진 §6.2 Rationale 와 동일 근거로 문서화되어 있다.
- **제안**: 동기화 이슈 없음.

---

### [INFO] `spec/1-ai-agent.md §12.1/§12.10/§12.13` — rehydration 복원 서술 일치

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5 rehydration`
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §12.x`
- **상세**: AI Agent 스펙의 `§12.1·§12.10·§12.13` 이 pending_plans 에 exec-park-durable-resume 을 참조하고 있고, `_resumeCheckpoint` 생명주기 비교표(`§7.4` 각주) 가 실행 엔진 §1.3·§7.5 와 동일 정책(TTL 없음, lastUserMessage 없음, schemaVersion 검사)을 기술한다. 서술이 정합한다.
- **제안**: 동기화 이슈 없음.

---

### [WARNING] `spec/5-system/4-execution-engine.md §7.4` Worker 동작 설명 — PR-B2 완료 전 과도기 상태 미주

- **target 위치**: `spec/5-system/4-execution-engine.md §7.4` Worker 동작 칸
- **충돌 대상**: `spec/5-system/4-execution-engine.md §4.x` "재개 경로 — slow-path 일원화 (Phase B)" 구현 메모
- **상세**: §7.4 Worker 동작 칸은 "park 시 코루틴 즉시 해제로 in-process resolver(`pendingContinuations`)가 존재하지 않는다 — worker-side fast-path 는 제거됐고 재개 경로는 slow-path 로 일원화된다" 로 기술되어 있다. 그러나 plan 의 PR-B2(멀티턴 AI turn-단위 park) 가 아직 미완료 상태이며, 실제 구현은 form/button(PR-B1 완료)만 slow-path 일원화가 된 과도기다. §4.x Rationale 의 "단계적 롤아웃 (B1 → B2)" 주석이 이 과도기를 설명하나, §7.4 의 주 본문 서술이 PR-B2 완료 후 최종 상태로만 기술되어 있어 현재 구현 상태(멀티턴 AI 한정 잠정 fast-path 잔존)와 spec 본문 간 외관상 gap이 존재한다.
- **제안**: §7.4 Worker 동작 칸 미주 또는 괄호 주석으로 "멀티턴 AI 는 PR-B2 완료 시점에 적용 — 현재(PR-B1 완료)는 form/button 만 slow-path 일원화, AI 잠정 fast-path 잔존" 을 명시해 독자 혼동을 방지. §4.x Rationale 의 단계적 롤아웃 설명으로 이미 보완되어 있으나 §7.4 자체에도 참조 주석을 추가하면 명확도 향상. CRITICAL 수준은 아니며 PR-B2 완료 후 자연 해소된다.

---

### [INFO] `spec/5-system/4-execution-engine.md §7.1` stalled-job 재배달 — Planned 미구현 표기 일치

- **target 위치**: `spec/5-system/4-execution-engine.md §7.1`, §9.1 큐 파라미터 표
- **충돌 대상**: `spec/0-overview.md §2.4` ("active 세그먼트 stalled-job 재배달 — §7.1"), `spec/5-system/_product-overview.md`
- **상세**: §7.1 stalled-job 재배달(crash 재개)·§8 동시성 cap 은 `4-execution-engine.md §4` 구현 상태 메모에 "Planned (PR2-4)" 로 명시되어 있고, §9.1 큐 파라미터 표의 `maxStalledCount:0` 도 "stalled 재배달 차단 — PR4 에서 멱등 rehydration 과 함께 상향" 로 일관 기술된다. `0-overview.md §2.4` 의 "active 세그먼트 stalled-job 재배달" 서술이 이 Planned 상태를 전제로 쓰여 있으나, 동일 행 괄호 내 링크([실행엔진 §4])가 구현 메모로 연결되므로 독자가 상태를 확인할 수 있다. 심각한 충돌은 아니다.
- **제안**: 동기화 이슈 없음.

---

### [INFO] `spec/5-system/11-mcp-client.md §4.1` — `waiting_for_input` 진입 시 세션 close 서술

- **target 위치**: `spec/5-system/11-mcp-client.md §4.1` Connection Lifecycle 표 "노드 종료 / `waiting_for_input`" 행
- **충돌 대상**: `spec/5-system/4-execution-engine.md §4.x` durable park 모델
- **상세**: MCP Client §4.1 은 "`waiting_for_input` 진입 시 세션 close — 재개(resume) 시 `mcpServers` config 로부터 결정론적으로 재연결" 로 기술한다. 실행 엔진 §4.x 의 durable park 모델(park 시 코루틴 즉시 해제)과 **완전히 정합**한다 — park 시 세션 close, rehydration 재개 시 재연결은 Phase B slow-path 일원화와 동일 모델이다. §4.2 재연결/재개도 "세션은 close 되며 재개 시점에 새 세션을 만든다" 로 일관된다.
- **제안**: 동기화 이슈 없음.

---

### [INFO] `spec/1-data-model.md §2.13 Execution` — `active_running_ms` 컬럼 서술

- **target 위치**: `spec/5-system/4-execution-engine.md §8` (동시 실행 제한, `EXECUTION_MAX_ACTIVE_RUNNING_MS`)
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution.active_running_ms`
- **상세**: 데이터 모델의 `active_running_ms` 컬럼 설명 "누적 active-running 시간(ms). active 세그먼트(worker 가 노드를 전진시킨 구간)의 합 — `waiting_for_input` park 시간 제외" 가 실행 엔진 §4 의 active 세그먼트 개념 및 §8 타임아웃 측정 기준과 완전히 일치한다.
- **제안**: 동기화 이슈 없음.

---

### [INFO] `spec/5-system/10-graph-rag.md` — 변경 없음, 실행 엔진과 무관

- **target 위치**: `spec/5-system/10-graph-rag.md` 전체
- **충돌 대상**: 없음
- **상세**: Graph RAG 스펙은 실행 엔진의 park/resume 모델과 직접 교차하는 지점이 없다. `graph-extraction` 큐 및 BullMQ 패턴은 독립적이며, `4-execution-engine.md` 의 `execution-run` / `execution-continuation` 큐와 혼동되지 않는다. 별도 충돌 없음.
- **제안**: 동기화 이슈 없음.

---

### [INFO] `spec/5-system/1-auth.md` — 변경 없음, 실행 엔진과 무관

- **target 위치**: `spec/5-system/1-auth.md` 전체
- **충돌 대상**: 없음
- **상세**: 인증/인가 스펙은 이번 exec-park-durable-resume 변경 범위와 교차 지점이 없다. RBAC 매트릭스의 `Workflow 실행` 권한 행이 실행 엔진의 `execute()` API 를 전제하지만, park/resume 모델 변경이 실행 권한 모델을 바꾸지 않는다.
- **제안**: 동기화 이슈 없음.

---

## 요약

`spec/5-system/` 내 주요 변경(exec-park-durable-resume — durable park 영속 컬럼 `conversation_thread` V084·`user_variables` V085 신설, `_resumeCheckpoint` 견고화, information_extractor 멀티턴 확장, PR-B1 form/button park-release + slow-path 일원화)은 인접 영역 spec 과 전반적으로 정합한다. `spec/1-data-model.md §2.13`, `spec/conventions/conversation-thread.md §4`, `spec/4-nodes/3-ai/1-ai-agent.md §7.4`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/0-overview.md §2.4` 모두 이미 동기화되어 있으며 충돌이 없다. 유일한 주의 사항은 `spec/5-system/4-execution-engine.md §7.4` Worker 동작 본문이 PR-B2 완료 후 최종 상태로만 기술되어 현재 과도기(멀티턴 AI fast-path 잠정 잔존)를 명시적으로 표현하지 않는 외관상 불일치로, CRITICAL/CRITICAL 수준이 아니라 WARNING 수준이며 PR-B2 완료 후 자연 해소된다. 데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, 권한·RBAC 모델 충돌, 계층 책임 충돌은 발견되지 않았다.

---

## 위험도

LOW

STATUS: OK
