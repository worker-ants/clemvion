# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`, scope=`spec/5-system/`
검토 일시: 2026-06-28

---

## 발견사항

### 발견사항 없음 — 모든 점검 관점에서 충돌 없음

`spec/5-system/` 의 모든 파일(1-auth, 2-api-convention, 3-error-handling, 4-execution-engine, 6-websocket-protocol, 7-llm-client, 8-embedding-pipeline, 9-rag-search, 10-graph-rag, 12-webhook, 13-replay-rerun, 14-external-interaction-api, 15-chat-channel, 16-system-status-api, 17-agent-memory)을 점검한 결과, Rationale 연속성 관점에서 CRITICAL 또는 WARNING 수준의 충돌이 발견되지 않았다.

아래 주요 점검 항목을 명시한다.

---

#### [INFO] `9-rag-search.md` — byte-identical 조항 폐기의 Rationale 내 명시적 기록 확인

- target 위치: `spec/5-system/9-rag-search.md §3.3.1` 및 `## Rationale` "byte-identical 조항 폐기 (D1)"
- 과거 결정 출처: `plan/complete/spec-draft-rag-reranking.md §1` 의 "off = 현행과 byte-identical 하위호환" 조항
- 상세: D1 동적 컷 도입으로 off 경로도 wide 회수 + app-layer 동적 컷을 거쳐 기존 byte-identical 약속이 성립하지 않게 됐다. 이 번복은 Rationale 내 "byte-identical 조항 폐기 (D1, 2026-06-06)" 항에서 명시적으로 근거와 함께 갱신되어 있어 절차상 하자 없음. 새 하위호환 정의("리랭커 인프라 없이 동작·점진 도입 가능")도 함께 선언됨.
- 제안: 해당 기록은 적절하게 관리되고 있음. 구현 착수 시 `plan/complete/spec-draft-rag-reranking.md` 의 구 조항이 dead spec 임을 한 번 더 확인하는 정도.

---

#### [INFO] `7-llm-client.md` — jina/voyage/local/builtin rerank provider 'Dropped' 처리

- target 위치: `spec/5-system/7-llm-client.md §2.1` 표, `## Rationale` "왜 리랭크 provider 확장을 drop 했나"
- 과거 결정 출처: 구 spec 의 `7-llm-client.md` 에서 jina/voyage/local/builtin 을 'Planned'로 약속한 결정
- 상세: 2026-06-05 사용자 결정으로 확장 provider 를 drop 하면서 Rationale 에 "Planned 표기 → Dropped 현행화" 근거를 명시했다. 번복 이유(수요 미확인·유지보수 표면 증가)와 재개 시 확장 비용이 낮다는 보완 설명이 함께 기록되어 있어 절차상 하자 없음.
- 제안: 해당 기록은 적절하게 관리되고 있음.

---

#### [INFO] `4-execution-engine.md` — per-node task queue 기각 후 exec-park D6 도입의 무오판 확인

- target 위치: `spec/5-system/4-execution-engine.md §Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` 내 "per-node task queue 기각(아래)과 다른 범주" 주석
- 과거 결정 출처: `4-execution-engine.md §Rationale "per-node task queue → execution-level intake 큐"` 에서 per-node task queue 를 명시 기각
- 상세: exec-park D6 (중첩 sub-workflow blocking durable 영속)이 도입될 때, 이것이 기각된 per-node task queue 의 재도입이 아님을 Rationale 에서 명시적으로 구분("park 지점에서만 직렬화 … dispatch loop in-process 전제 유지")하고 있다. 설계 invariant 가 유지됨.
- 제안: 해당 기록은 적절하게 관리되고 있음.

---

#### [INFO] `1-auth.md` — WebAuthn counter 역행 시 suspend(기각) 대신 삭제(채택) 유지 확인

- target 위치: `spec/5-system/1-auth.md §1.4.4` 본문("해당 credential row 를 즉시 삭제, suspend 컬럼 없음") 및 `## Rationale 1.4.E`
- 과거 결정 출처: `Rationale 1.4.E` — suspend(`disabled_at` 컬럼 + 명시적 재활성화)를 기각하고 삭제를 채택한 결정
- 상세: 본문과 Rationale 모두 삭제 채택·suspend 기각이 일관되게 기술되어 있다. suspend 패턴이 재도입된 흔적 없음.
- 제안: 해당 기록은 적절하게 관리되고 있음.

---

#### [INFO] `6-websocket-protocol.md` — native WS seq 버퍼-replay 기각 후 snapshot 모델 유지 확인

- target 위치: `spec/5-system/6-websocket-protocol.md §6.2` 및 `## Rationale "재연결 복구"`
- 과거 결정 출처: 초기 `§6.2` 에서 native WS lastSeq 버퍼-replay 약속 → Rationale 에서 snapshot 모델로 정정
- 상세: 기각된 대안(native WS 버퍼-replay 전면 구현)이 재도입되지 않았으며, 현행 spec 은 snapshot 모델과 SSE 전송의 역할 분담을 명시하고 있다.
- 제안: 해당 기록은 적절하게 관리되고 있음.

---

#### [INFO] `15-chat-channel.md` — EIA HTTP round-trip 기각 후 in-process facade 유지 확인

- target 위치: `spec/5-system/15-chat-channel.md §Rationale R2`
- 과거 결정 출처: `Rationale R2` — "어댑터도 EIA HTTP endpoint 를 호출하는 안은 … 기각"
- 상세: 본문 §3.1 과 Rationale R2, R4 모두 in-process facade 단일 경로 정책이 일관되게 유지되고 있다. HTTP round-trip 재도입 흔적 없음.
- 제안: 해당 기록은 적절하게 관리되고 있음.

---

## 요약

`spec/5-system/` 전 파일의 Rationale 연속성을 점검한 결과, 명시적으로 기각·폐기된 대안이 근거 없이 재도입된 사례, 합의된 설계 원칙이 위반된 사례, 과거 결정이 새 Rationale 없이 번복된 사례, 시스템 invariant 를 우회하는 설계가 도입된 사례가 확인되지 않았다. byte-identical 조항 폐기(D1), jina/voyage/local/builtin rerank provider Dropped, per-node task queue 기각과 exec-park D6 의 구분, WebAuthn counter 역행 삭제 정책, WS snapshot 모델 등 핵심 결정은 모두 명시적 Rationale 갱신·차별화 서술을 동반하여 연속성이 유지되고 있다.

## 위험도

NONE

---

STATUS: SUCCESS
