# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`
검토 기준: `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/6-websocket-protocol.md`, `spec/1-data-model.md`, `spec/5-system/10-graph-rag.md`, `spec/data-flow/knowledge-base.md` 의 Rationale 및 확립된 설계 결정

---

### 발견사항

- **[INFO]** `6-websocket-protocol.md` Rationale 신설은 적절하나 폐기 대안 명시 권장
  - target 위치: target 문서 §2 (6-websocket-protocol.md 변경 표, "(Rationale 신설)" 행)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §4.3` — 현행 채널 `embedding:{knowledgeBaseId}` + 점 표기 이벤트(`embedding.started` 등)를 규정하고 있으나, 해당 spec 에는 이 설계를 택한 이유를 담은 `## Rationale` 섹션이 없다.
  - 상세: target 은 신규 Rationale 섹션에 "채널 단위를 KB → 문서로 전환" 한 이유를 한 단락 작성한다. 이는 합의된 원칙(결정 번복 시 Rationale 병기)에 부합한다. 단, 기존 채널 `embedding:{knowledgeBaseId}` 와 점 표기(`embedding.started` 등) 가 **왜 폐기**되는지 (backend 실제 구현이 `kb:{documentId}` + 콜론+언더스코어 방식이므로, spec 이 코드 현실과 달랐다는 점) 를 Rationale 에 명시하면 향후 재혼란 방지에 더 효과적이다.
  - 제안: 신설 Rationale 에 "기존 `embedding:{knowledgeBaseId}` + `embedding.started` 표기는 실제 backend `KbEventType` union 및 `emitKbEvent` 구현과 달라 spec 기록 오류로 판명됨" 한 줄 추가.

- **[INFO]** `8-embedding-pipeline.md` Rationale 의 옛 경로 참조 제거 — 정합성 강화 조치
  - target 위치: target 문서 "Rationale 보강" 섹션 — `memory/kb-embedding-model-selection.md` 경로 참조 및 `review/2026-05-02_13-18-24/` 경로 참조 1줄씩 제거
  - 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md ##Rationale` (line 280, 333) — 현재 spec 에 두 경로 참조가 그대로 남아 있음
  - 상세: `memory/` 폴더는 docs-consolidation(2026-05-12) 으로 폐기되었고, `review/` flat 경로는 nested ISO 로 전환되었다. target 은 이 두 참조를 Rationale 에서 제거한다고 명시한다. 이는 CLAUDE.md "옛 prd/, memory/, user_memo/ 폴더는 모두 흡수되었다" 원칙에 부합하는 조치다. CRITICAL 이나 WARNING 사항이 아니며 오히려 권장되는 정합 작업이다.
  - 제안: 변경 의도대로 진행. 단, 제거 후 Rationale 에 "상세 이력은 `plan/complete/archive/from-memory/kb-embedding-model-selection.md` 참조" 를 유지하는 것이 좋다 (이미 target 이 그렇게 처리하고 있으면 무시).

- **[INFO]** `IVFFlat → partial HNSW` 전환 — Rationale 에 폐기 이유 명시가 충분한지 확인 필요
  - target 위치: target 문서 §4 (1-data-model.md 변경 표, §2.12.1 인덱스 행) 및 "Rationale 보강" 신규 결정 2번째 항목
  - 과거 결정 출처: `spec/1-data-model.md §2.12.1` (line 351) — `ivfflat (embedding vector_cosine_ops)` 가 현행 spec 에 명시되어 있음. `spec/5-system/8-embedding-pipeline.md §6.2` 에도 IVFFlat DDL 코드블록 존재.
  - 상세: target 은 8-embedding-pipeline.md §6.2 DDL 코드블록을 보존하되 "컨셉 예시" 노트를 추가하고, 1-data-model.md §2.12.1 인덱스 표기를 partial HNSW 로 교체한다. Rationale 보강에 "IVFFlat → partial HNSW 전환 — pgvector 0.7+ halfvec 으로 3072 차원에도 partial 인덱스 부착 가능" 한 줄 추가한다. 이는 과거 결정을 무근거로 번복하지 않고 새 Rationale 를 함께 작성하는 올바른 방식이다. IVFFlat 을 선택했던 명시적 이전 Rationale 는 존재하지 않으므로(당시 spec 에 Rationale 섹션이 없었거나 기술되지 않았음) CRITICAL 위반에 해당하지 않는다.
  - 제안: 변경 의도대로 진행. Rationale 에 "V022/V023 마이그레이션으로 실제 전환 완료, DDL 예시는 컨셉 수준으로 격하" 맥락도 추가하면 완결성이 높아진다.

- **[INFO]** `Document.metadata` 에러 저장 방식 변경 — 구 방식 폐기 Rationale 명시
  - target 위치: target 문서 §1 (8-embedding-pipeline.md 변경 표, §2 본문 끝 행) 및 "Rationale 보강" 신규 결정 1번째 항목
  - 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md §2` — "실패 시: status: error, Document.metadata 에 에러 메시지 저장" 이 현행 표기
  - 상세: target 은 `Document.metadata` → `Document.embedding_error_message` 전용 컬럼으로 교체한다. Rationale 에 "metadata 에러 저장 구 방식은 전용 컬럼 embedding_error_message 도입(V024 후속)으로 폐기됨" 을 추가한다. 이는 결정 번복 시 새 Rationale 병기 원칙을 준수한다. V024 는 이미 완료된 마이그레이션이므로 후속 spec 정비 성격이다.
  - 제안: 변경 의도대로 진행.

- **[INFO]** `kb:graph_stats_updated` dead path 제거 — 향후 재도입 가능성 차단 장치 권장
  - target 위치: target 문서 §3 (5-knowledge-base.md §2.7.1), §5 (10-graph-rag.md §2.3/§4.2/§6), §6 (data-flow/knowledge-base.md §2.5)
  - 과거 결정 출처: `spec/5-system/10-graph-rag.md §2.3, §4.2(line 37, 123), §6(line 527)` — `kb:graph_stats_updated` 이벤트가 정식 이벤트로 명시되어 있음. `spec/2-navigation/5-knowledge-base.md §2.7.1(line 139)` 에도 언급됨.
  - 상세: target 은 `kb:graph_stats_updated` 를 dead path 로 확인하고 spec 에서 제거한다. backend `kb-stats.helper.ts:42-46` 이 `emitExecutionEvent` 로 호출해 실제로 `execution:kb:...` 채널로 변환되어 frontend `kb:` 구독에 도달하지 못함이 확인됐다. 이 이벤트를 spec 에 두었던 명시적 Rationale(채택 이유)는 이전 spec 에 기록되지 않았으나, 제거 시 "dead path 임을 확인, backend 코드 결함으로 판명" 이유를 target 이 명시한다. target 의 "후속 plan" 섹션이 재도입 가능성(backend 수정 후 이벤트 재도입)을 언급하므로, 삭제 Rationale 에 "재도입 필요 시 `plan/in-progress/kb-graph-stats-dead-path.md` 의 결정에 따라 spec 을 역전" 한 줄을 추가하면 재도입 시 연속성 추적이 용이하다.
  - 제안: 삭제 Rationale 에 "재도입 가능성 및 처리 위임 plan 을 `plan/in-progress/kb-graph-stats-dead-path.md` 로 분리" 참조를 명기.

---

### 요약

target 문서가 제안하는 6개 spec 파일 변경 중 Rationale 연속성 관점에서 **CRITICAL 또는 WARNING 수준의 위반 사항은 발견되지 않았다**. 과거 Rationale 에서 명시적으로 기각된 대안을 무근거로 재도입하는 경우가 없고, 결정 번복(IVFFlat → HNSW, metadata → embedding_error_message, 채널 패턴 교체)에는 신규 Rationale 를 함께 작성하는 방식을 택하고 있다. `6-websocket-protocol.md` 에 Rationale 섹션이 신설되는 것은 합의된 원칙(spec 본문 끝 Rationale 권장)의 이행이다. 다수의 INFO 수준 제안은 Rationale 완결성을 높이기 위한 보완 사항으로, 핵심 변경을 차단하는 사유가 아니다.

---

### 위험도

LOW
