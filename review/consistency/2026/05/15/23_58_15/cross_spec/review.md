# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`
검토 시각: 2026-05-15 23:58:15

---

## 발견사항

- **[INFO]** `spec/5-system/8-embedding-pipeline.md §8` 채널 표기 — 현재 spec 에 이미 `kb:${documentId}` 로 기재됨
  - target 위치: draft §1 "§8 WebSocket 알림 표" 변경 행
  - 충돌 대상: `spec/5-system/8-embedding-pipeline.md` line 225 (`채널 명명규약: kb:${documentId}.`)
  - 상세: draft 는 `§3.2 채널 패턴 표 line 110` (`spec/5-system/6-websocket-protocol.md`) 를 `embedding:{knowledgeBaseId}` → `kb:{documentId}` 로 바꾸는 것이 핵심이다. 그런데 `8-embedding-pipeline.md §8` 자체는 이미 line 225 에서 `채널 명명규약: kb:${documentId}` 라고 선언하고 있어, embedding-pipeline 내부는 이미 올바른 상태다. draft 의 §1 변경표가 "현재" 필드를 "embedding 6개만" 이라 기술하고 있으나 실제로는 채널 표기는 이미 맞으며, graph 6개 추가만 진정한 변경이다. 사소한 오해 가능성.
  - 제안: draft §1 변경표에서 "채널 명명규약 그대로" 주석을 명시하여 채널 자체는 이미 일치함을 표기.

- **[WARNING]** `spec/data-flow/knowledge-base.md §2.5` 이벤트 목록이 draft 가 목표하는 완성 목록과 불일치
  - target 위치: draft §6 (spec/data-flow/knowledge-base.md 변경표)
  - 충돌 대상: `spec/data-flow/knowledge-base.md` line 197-198 — `document:embedding_started/completed/failed/retry` (4개), `document:graph_started/completed/failed/retry` (4개)
  - 상세: draft 는 line 197-198 을 6개씩 완전 명시 (`_started/_progress/_completed/_error/_retry/_failed`) 로 교체하는 것을 목표로 한다. 그런데 현재 `spec/5-system/10-graph-rag.md §6` 이벤트 표(line 521-527)는 `graph_started`, `graph_progress`, `graph_completed`, `graph_error`, `graph_retry`, `graph_failed` 6개를 이미 정의하고 있고, `8-embedding-pipeline.md §8`(line 218-223)도 embedding 6개를 이미 정의하고 있다. 따라서 data-flow spec 만 아직 4개씩의 구형 목록을 유지 중이며, draft 는 이를 올바르게 동기화하는 방향이다. 충돌은 아니지만 draft 적용 전까지 data-flow 와 나머지 두 spec 사이에 불일치가 존재한다. draft 적용이 완료되어야 비로소 세 파일이 정렬된다.
  - 제안: draft 를 현재 계획대로 적용. draft §6 변경표에 "10-graph-rag.md §6 및 8-embedding-pipeline.md §8 의 6개씩 목록과 정렬" 이라는 교차 참조 주석 추가 권장.

- **[WARNING]** `spec/data-flow/knowledge-base.md` mermaid 다이어그램 line 94 — `document:graph_extracted` 가 `document:graph_completed` 로 변경됨
  - target 위치: draft §6 첫 번째 변경 행
  - 충돌 대상: `spec/data-flow/knowledge-base.md` line 94 (`GP->>WS: emit 'document:graph_extracted'`), `spec/5-system/10-graph-rag.md §6` line 523 (`document:graph_completed`)
  - 상세: 현재 `data-flow/knowledge-base.md` line 94 는 `document:graph_extracted` 를 emit 하는 것으로 기술하고 있으나, `10-graph-rag.md §6` 이벤트 표에는 `document:graph_completed` 만 존재하며 `document:graph_extracted` 는 없다. draft 는 data-flow 를 `document:graph_completed` 로 교정하는 것이 맞다. `document:graph_extracted` 는 현재 data-flow 파일에만 남아 있는 구형 표기다. 이 자체는 draft 가 올바른 방향을 지향하지만, 적용 전까지 `data-flow/knowledge-base.md` 는 존재하지 않는 이벤트명을 정의하고 있어 draft 적용의 우선순위가 높다.
  - 제안: draft §6 변경을 그대로 적용. 원자적 6파일 PR 로 묶어야 중간 상태에서 `graph_extracted` 가 spec 어딘가에 잔존하지 않도록 주의.

- **[WARNING]** `spec/2-navigation/5-knowledge-base.md §2.7.1 line 139` — `kb:graph_stats_updated` 삭제 시 `spec/5-system/10-graph-rag.md §6 line 527` 과 분리 필요
  - target 위치: draft §3 두 번째 변경 행 (`§2.7.1 line 139` 에서 `kb:graph_stats_updated` 제거)
  - 충돌 대상: `spec/5-system/10-graph-rag.md §6` line 527 (`kb:graph_stats_updated` 이벤트 행), `spec/5-system/10-graph-rag.md §2.3 / §4.2` line 37 및 123
  - 상세: draft §3 에서는 `5-knowledge-base.md §2.7.1` 의 `kb:graph_stats_updated` 만 제거한다. 동시에 draft §5 에서는 `10-graph-rag.md §2.3`, `§4.2`, `§6` 의 해당 언급도 제거한다. 두 파일의 변경이 동일 PR 에 원자적으로 묶여 있으므로 자체 충돌은 아니다. 다만 draft §5 의 `§6 이벤트 표 line 527 행 삭제`가 실제로 적용되면, `10-graph-rag.md §6` 에는 6개의 graph 이벤트만 남고 `kb:graph_stats_updated` 는 사라진다. 이때 `5-knowledge-base.md §2.7.1` 에서도 동일하게 제거되므로 두 파일이 정합된다. 원자성이 보장되는 한 충돌 없음. 그러나 만약 §3 만 적용되고 §5 가 누락되면 `10-graph-rag.md §6` 에는 여전히 `kb:graph_stats_updated` 행이 남아 단방향 불일치가 발생하므로, 실제 PR 에서 6파일 원자 적용 강제가 필수다.
  - 제안: PR checklist 에 "10-graph-rag.md §6 line 527 삭제 확인" 항목을 명시적으로 추가.

- **[WARNING]** `spec/2-navigation/5-knowledge-base.md §2.4.1 line 105` — `retry-failed` scope 불일치
  - target 위치: draft §3 첫 번째 변경 행
  - 충돌 대상: `spec/5-system/8-embedding-pipeline.md §9.4 line 267` (`{ scope: 'embedding' | 'graph' | 'all' }`)
  - 상세: 현재 `5-knowledge-base.md §2.4.1 line 105` 는 `{ scope: 'embedding'|'graph' }` (2개 값) 만 표기하고 있어 `8-embedding-pipeline.md §9.4` 의 `'all'` 값이 누락된 상태다. draft 는 이를 3개 값으로 정합화하는 것이 올바른 방향이다. 이 불일치는 draft 적용 전까지 두 spec 사이에 직접 모순으로 존재한다. (`5-knowledge-base` 는 `'all'` 을 모르지만 `8-embedding-pipeline` 은 이미 `'all'` 을 정의).
  - 제안: draft §3 변경을 우선 적용. 현재 CRITICAL 수준은 아니지만(API 계약상 서버가 `'all'` 을 지원하므로 클라이언트가 보내지 않아도 동작), spec 정의상 WARNING 이다.

- **[INFO]** `spec/1-data-model.md §2.12.1` DocumentChunk 인덱스 표기 불일치 (이미 부분 해소)
  - target 위치: draft §4
  - 충돌 대상: `spec/1-data-model.md` line 351 (`ivfflat (embedding vector_cosine_ops)`)
  - 상세: `spec/1-data-model.md §2.12` Document 엔티티 표(line 324)에는 `embedding_error_message` 컬럼이 이미 정의되어 있으므로, draft §1 에서 `8-embedding-pipeline.md §2 본문` 의 "Document.metadata 에 에러 저장" 표현을 `embedding_error_message` 로 교정하는 것은 data-model 과 정합된다. 한편 `§2.12.1 DocumentChunk 인덱스` line 351 은 여전히 `ivfflat` 로 기술 중이며, draft §4 가 `partial HNSW` 로 갱신하는 것이 `spec/5-system/8-embedding-pipeline.md §10 Rationale` (V022/V023 에서 이미 HNSW 전환)과 일치한다. 현재 data-model 과 embedding-pipeline Rationale 사이의 인덱스 정의 불일치는 draft 적용 전까지 잔존하는 INFO 수준이다.
  - 제안: draft §4 변경 그대로 적용.

- **[INFO]** `spec/5-system/6-websocket-protocol.md §4.3` 이벤트 섹션 — `document:graph_started` 부재
  - target 위치: draft §2 `§4.3 임베딩 이벤트 섹션` 변경 행
  - 충돌 대상: `spec/5-system/10-graph-rag.md §6` line 521 (`document:graph_started`)
  - 상세: draft 는 `6-websocket-protocol.md §4.3` 에 embedding 6 + graph 6 = 12개 이벤트를 통합 기술할 것을 목표로 한다. 현재 `10-graph-rag.md §6` 에는 graph 6개(graph_started/progress/completed/error/retry/failed)가 이미 정의되어 있으므로, `6-websocket-protocol.md` 에도 동일 12개가 기술되면 두 spec 이 정합된다. draft 의 접근이 올바르며 충돌 아님. 단, draft 에서 `6-websocket-protocol.md §4.3` 의 "payload 권위는 backend 구현 기준" 이라는 표현이 `10-graph-rag.md §6` 의 payload 정의와 중복될 수 있으므로, `10-graph-rag.md §6` 를 교차 참조로 링크하는 것이 더 명확하다.
  - 제안: `6-websocket-protocol.md §4.3` 에 "graph 이벤트 payload 상세는 10-graph-rag.md §6 참조" 교차 참조 추가 권장.

---

## 요약

본 draft 는 embedding pipeline / WebSocket / Knowledge Base / data-flow 4 영역에 걸쳐 분산된 불일치를 하나의 원자적 6파일 변경으로 해소하는 올바른 방향을 취하고 있다. CRITICAL 충돌은 발견되지 않는다. 주요 잠재 위험은 두 가지다: (1) `spec/2-navigation/5-knowledge-base.md §2.4.1` 의 `retry-failed scope` 누락이 `8-embedding-pipeline.md §9.4` 와 API 계약상 WARNING 수준 불일치를 형성하고 있으며 draft 로 해소 예정이다. (2) `spec/data-flow/knowledge-base.md` 의 `document:graph_extracted` 구형 표기 및 4개씩 이벤트 목록이 `10-graph-rag.md §6` 및 `8-embedding-pipeline.md §8` 의 6개씩 목록과 불일치하나, 이는 draft 가 해소하려는 바로 그 대상이다. draft 가 6파일을 원자적으로 적용하지 않으면 중간 상태에서 `graph_extracted`, `kb:graph_stats_updated` 등 구형 표기가 spec 일부에 잔존하므로, PR 단위 원자성이 이 draft 의 핵심 안전 조건이다. `spec/5-system/6-websocket-protocol.md §3.2` 의 `embedding:{knowledgeBaseId}` 채널 표기가 다른 모든 spec 파일의 `kb:{documentId}` 표기와 직접 모순을 이루는 것은 draft 적용 전 현재도 유효한 WARNING 이며, 이 역시 draft 의 변경 대상으로 포함되어 있다.

---

## 위험도

MEDIUM

(CRITICAL 충돌 없음. 복수의 WARNING 수준 불일치가 draft 의 원자적 적용으로 모두 해소 예정. PR 원자성 미보장 시 WARNING → CRITICAL 전환 가능성 있음.)
