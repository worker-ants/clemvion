# Rationale 연속성 검토 결과

검토 모드: --impl-done (scope=spec/5-system, diff-base=origin/main)
검토 대상: spec/5-system (1-auth.md, 10-graph-rag.md, 11-mcp-client.md, 4-execution-engine.md 등)

---

## 발견사항

### [INFO] Park 즉시 해제 + slow-path 일원화 Rationale 단계 롤아웃 서술이 과도기 상태를 정확히 반영함
- target 위치: `spec/5-system/4-execution-engine.md` §4.x 구현 메모 배너 + §7.4 Worker 동작 행 + §Rationale "단계적 롤아웃 (B1 → B2, 2026-06-05)"
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "Durable Continuation & Graceful Shutdown" — "Sticky fast-path 제거 — 항상 publish 원칙 보존" 및 "옛 키 없음 즉시 throw 폐기 원칙의 확장"
- 상세: §4.x 배너는 PR-B1(form/button) 완료와 PR-B2(멀티턴 AI) 미적용 상태를 명시적으로 구분하고, §7.4 Worker 동작 행은 "pendingContinuations 잠정 잔존(멀티턴 AI 한정)"을 inline 기록한다. 과거 Rationale 에서 확정한 "sticky fast-path 제거 + 항상 BullMQ enqueue" 원칙 및 "worker-side fast-path 제거"를 최종 목표로 유지하면서, 과도기에 멀티턴 AI 의 in-memory 루프가 잠정 잔존함을 단계적 롤아웃으로 설명하고 있다. 원칙 번복이 아니라 단계 내 과도기 허용이며, PR-B2 에서 제거될 명시적 계획이 함께 기록된다.
- 제안: 이슈 없음. 현재 서술이 Rationale 연속성을 충분히 보존한다.

### [INFO] `_resumeCheckpoint` 영속 범위 확장 (ai_agent → ai_agent + information_extractor) 번복 근거 명시됨
- target 위치: `spec/5-system/4-execution-engine.md` §1.3 "보존 예외 — `_resumeCheckpoint`" 및 §Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존" 마지막 bullet
- 과거 결정 출처: 동 §Rationale 본문 — "초기 도입은 … `ai_agent` 한정으로 출하하고 일반화를 후속 작업으로 남겼다"
- 상세: §1.3 적용 범위가 "`ai_agent` · `information_extractor` 멀티턴 노드"로 확장됐고, §Rationale L1183 에 번복 근거("점진 확장 — polymorphic dispatch·generic config 재유도·credential-free 소형 state")가 명시된다. 번복이 이유와 함께 기록되어 있으므로 합의 원칙 위반 없음.
- 제안: 이슈 없음.

### [INFO] `_resumeCheckpoint` DB 영속 — 암호화 기각 근거 일관성
- target 위치: `spec/5-system/4-execution-engine.md` §Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존" 암호화 기각 항목
- 과거 결정 출처: 동 §Rationale "WARN #6 미영속" 번복 대상 결정 서술 — "보안상 DB 에 영속하지 않고 in-memory 만 유지"
- 상세: 옛 결정이 `_resumeState`를 DB 미영속으로 정했던 근거는 "잠재 credential 포함 우려"였다. 번복 채택안은 credential-strip 부분집합(`_resumeCheckpoint`)만 영속하고 raw secret 을 포함하지 않는다는 점을 명시해 원래 보안 우려를 구조적으로 해소한다. 기각된 대안(암호화 기반 secret-store)의 이유도 명확하다 — 대화 messages 가 이미 평문 영속 중인 현실과 복잡도 비용. 원칙 내 정합된 번복이다.
- 제안: 이슈 없음.

### [INFO] D6 중첩 call stack 영속화가 per-node task queue 기각 결정과 혼동 가능
- target 위치: `spec/5-system/4-execution-engine.md` §Rationale "park 즉시 해제 + slow-path 일원화" D6 항목 — "per-node task queue 기각(아래 §Phase 2 cont …)과 다른 범주"
- 과거 결정 출처: 동 §Rationale "per-node task queue → execution-level intake 큐" — "개별 노드를 워커로 분산하려면 노드마다 전체 ExecutionContext를 직렬화/rehydration … 엔진 재작성급·고위험"으로 기각
- 상세: D6 는 park 지점(waiting node)에서만 call stack 을 영속하는 "waiting 후 재개의 중첩 확장"이며, 기각된 per-node task queue(모든 노드 handoff) 와는 직교함을 Rationale 에 명시한다. spec 본문에서 D6 와 per-node task queue 기각의 구분이 서술되어 있어 충돌 위험은 낮다. 다만 §4.2 와 §Rationale 의 per-node 기각 서술이 D6 를 오해할 소지가 있으므로 cross-link 가 도움이 된다.
- 제안: D6 관련 §4.2 본문(또는 §7.5 rehydration 재귀 재진입 서술 위치)에 "(D6의 중첩 call stack 영속은 per-node task queue 기각과 다른 범주 — §Rationale 참조)" 한 줄 주석을 추가하면 향후 독자 혼동을 방지할 수 있다.

### [INFO] Durable Continuation "WS 신규 이벤트 도입 안 함" 원칙과 §7.5 routing context 재등록 보조 서술 정합
- target 위치: `spec/5-system/4-execution-engine.md` §Rationale "Durable Continuation & Graceful Shutdown" — "재개 경로의 outbound routing context 재등록"
- 과거 결정 출처: 동 §Rationale — "WS 신규 이벤트 도입 안 함"
- 상세: routing context 재등록은 "신규 WS 이벤트 없이 기존 emit 경로의 fanout envelope 만 복원"함을 명시하며, "WS 신규 이벤트 도입 안 함" 원칙과 정합함을 서술에서 확인할 수 있다. 충돌 없음.
- 제안: 이슈 없음.

### [INFO] Graph RAG — KB 모드 사후 변경 불가 합의 일관성 유지
- target 위치: `spec/5-system/10-graph-rag.md` §2.1 KB-GR-MD-02, §4 기술결정표, §Rationale "사후 변경 불가"
- 과거 결정 출처: 동 §Rationale — "vector→graph 전환은 기존 chunk 에 대한 추출 트리거가 필요해 마이그레이션이 무겁고, graph→vector 는 entity/relation 폐기. 새 KB 가 더 단순"
- 상세: 사후 변경 불가 원칙이 본문 요구사항(KB-GR-MD-02)·기술결정표·Rationale 모두에서 일관되게 유지된다. 위반 없음.
- 제안: 이슈 없음.

### [INFO] MCP Client — stdio 미지원 결정의 일관성
- target 위치: `spec/5-system/11-mcp-client.md` §2.2 stdio 미지원 사유, §1 MVP 미포함 항목
- 과거 결정 출처: 동 §2.2 — "멀티테넌트 백엔드에서 사용자별 subprocess spawn 비용·보안 부담, 임의 명령 실행 권한 노출 위험"
- 상세: stdio 미지원은 §1(MVP 미포함)과 §2.2(미지원 사유)에서 일관되며, 우회 방안(데스크톱 bridge agent 별도 spec)도 동일하게 기록된다. 합의된 원칙 위반 없음.
- 제안: 이슈 없음.

---

## 요약

검토 대상인 `spec/5-system` 내 모든 변경 문서는 기존 Rationale 에서 합의된 설계 원칙을 충실히 유지한다. 가장 중요한 변경 영역인 `4-execution-engine.md` 의 Phase B(park 즉시 해제 + slow-path 일원화)는 과거에 명시적으로 기각된 대안(sticky fast-path, per-node task queue, waiting_for_retry 신규 상태, 별도 heartbeat 채널)을 재도입하지 않으며, 각 번복(옛 WARN #6 미영속 → `_resumeCheckpoint` 평문 영속, ai_agent 한정 → IE 확장)은 모두 새 Rationale 을 동반한다. PR-B1 과 PR-B2 의 단계적 롤아웃으로 과도기에 멀티턴 AI 의 in-memory 루프가 잠정 잔존하는 상태도 §4.x 배너와 §Rationale 에 명시적으로 기록되어 있어 원칙 위반이 아닌 계획된 과도기임이 명확하다. D6(중첩 call stack 영속화)가 기각된 per-node task queue 와 혼동될 소지가 있으나 spec 본문에서 이미 구분 근거를 제공한다. 전반적으로 Rationale 연속성 위험은 낮다.

## 위험도

LOW

---

STATUS: SUCCESS
