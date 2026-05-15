# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`
변경 대상 spec: `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/6-websocket-protocol.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/1-data-model.md`

---

## 발견사항

- **[WARNING]** `kb:graph_stats_updated` 이벤트 제거 — `spec/5-system/10-graph-rag.md` 와 충돌
  - target 위치: draft §3 변경 대상 — `spec/2-navigation/5-knowledge-base.md §2.7.1`에서 `kb:graph_stats_updated` 제거
  - 충돌 대상: `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` (line 527), `spec/5-system/10-graph-rag.md §2.3 구현 범위` (line 37), `spec/5-system/10-graph-rag.md §4.2 요구사항` (line 123)
  - 상세: draft는 `kb:graph_stats_updated`를 dead path (코드 버그로 실제 frontend에 도달 불가)로 판정해 `spec/2-navigation/5-knowledge-base.md §2.7.1`의 WS 이벤트 목록에서 제거하는 것만 명시한다. 그러나 `spec/5-system/10-graph-rag.md §6`에는 해당 이벤트가 공식 이벤트 표에 여전히 정의되어 있고(line 527), §2.3(line 37)과 §4.2 요구사항(KB-GR-OB-02, line 123)에서도 이 이벤트를 구현 완료(✅)로 기술하고 있다. draft가 한 spec 파일에서만 이벤트를 제거하면 `10-graph-rag.md`는 dead-path 이벤트를 계속 권위 있는 정의로 보유하게 되어 두 spec 영역 간 직접 모순이 발생한다.
  - 제안: `spec/5-system/10-graph-rag.md §6` 의 `kb:graph_stats_updated` 이벤트 행, §2.3의 "✅ (`kb:graph_stats_updated` 등)" 언급, §4.2 KB-GR-OB-02의 ✅ 표시를 함께 갱신해야 한다. draft가 `spec/2-navigation/5-knowledge-base.md` 변경만 기술하고 `10-graph-rag.md`를 변경 대상 spec 목록에 포함하지 않은 것이 누락이다. 단, dead-path 코드 처리는 "후속 항목(별도 plan/dev 위임)"으로 분리되어 있으므로, spec 수준에서는 `kb:graph_stats_updated`를 "코드 결함으로 현재 작동 불가 — 후속 PR 대상"이라는 노트로 보존하거나 두 spec에서 동시에 제거하는 방향을 결정해야 한다.

- **[WARNING]** `6-websocket-protocol.md §3.2` 채널 패턴 변경과 `10-graph-rag.md` 채널 정의 불일치 가능성
  - target 위치: draft §2 — `spec/5-system/6-websocket-protocol.md §3.2` 채널 패턴 `embedding:{knowledgeBaseId}` → `kb:{documentId}` 변경
  - 충돌 대상: `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` — 채널 명시 없이 `document:graph_*` 이벤트가 정의되어 있음. `spec/data-flow/knowledge-base.md §2.5` (line 197-199)
  - 상세: draft는 `6-websocket-protocol.md §4.3`에서 채널을 `kb:{documentId}`로 변경하고 embedding 6 + graph 6 = 12개 이벤트를 모두 이 채널에 통합한다고 기술한다. 그러나 `10-graph-rag.md §6`은 `document:graph_*` 이벤트를 나열하면서 채널을 명시하지 않으며, `data-flow/knowledge-base.md §2.5`는 `document:embedding_started/completed/failed/retry` 와 `kb:reembed_started/finished`, `kb:reextract_started/finished` 를 별도 열로 나열해 채널 구조가 다를 수 있음을 시사한다. backend 구현 권위(draft 의 "권위 결정" 섹션)에서 `kb:${documentId}` 채널 하나에 12개 이벤트가 모두 실려있다고 확인했지만, `10-graph-rag.md`와 `data-flow/knowledge-base.md`에는 이 채널 통합이 반영되어 있지 않다.
  - 제안: `10-graph-rag.md §6` 이벤트 표에 "채널: `kb:{documentId}`" 헤더를 추가하거나 참조 링크를 달아야 한다. `data-flow/knowledge-base.md §2.5` WebSocket 표도 12개 이벤트와 단일 `kb:{documentId}` 채널로 동기화해야 한다. 이 두 파일이 draft의 변경 대상 목록에 없어 누락이다.

- **[WARNING]** `spec/1-data-model.md §2.12.1` DocumentChunk 인덱스 변경과 `data-flow/knowledge-base.md`의 인덱스 기술 불일치
  - target 위치: draft §4 — `spec/1-data-model.md §2.12.1` 인덱스를 `ivfflat` → `partial HNSW (V022 vector / V023 halfvec)` 로 변경
  - 충돌 대상: `spec/data-flow/knowledge-base.md §2.3 DB 변경 사항` (line 167) — "HNSW partial indexes per dimension (V022 768, V030 384/512/1024, V031 1536, V032 512, V033 1024) ... V023 halfvec 인덱스는 3072 차원 처리"
  - 상세: draft는 `1-data-model.md §2.12.1`의 인덱스를 "partial HNSW (V022 vector / V023 halfvec)" 두 마이그레이션 참조로 기술한다. 그러나 `data-flow/knowledge-base.md`에는 V022, V030~V033까지 여러 차원별 인덱스가 추가로 기술되어 있다. draft의 변경 문안이 V022와 V023만 언급하면 실제 V030~V033 인덱스들이 정의에서 누락된다. `1-data-model.md`와 `data-flow/knowledge-base.md` 간 인덱스 목록 일치가 필요하다.
  - 제안: `1-data-model.md §2.12.1` 인덱스 설명에 V022/V023만이 아닌 V030~V033까지 포함하거나, "차원별 partial HNSW 인덱스 (V022, V023, V030~V033 — 자세한 마이그레이션은 backend/migrations/ 참조)" 형태로 포괄적 기술을 택해야 한다. 또는 `data-flow/knowledge-base.md`를 권위 있는 마이그레이션 목록으로 명시하고 `1-data-model.md`는 그리로 참조하는 방식도 가능하다.

- **[INFO]** `spec/5-system/8-embedding-pipeline.md §2` 실패 시 오류 저장 필드명 변경 — `spec/5-system/10-graph-rag.md`와 패턴 확인 권장
  - target 위치: draft §1 — `Document.metadata` → `Document.embedding_error_message` 로 변경
  - 충돌 대상: `spec/5-system/10-graph-rag.md §7` 에러 처리 표 (line 535-536) — `graph_error_message` 필드 사용, `spec/1-data-model.md §2.12 Document` 의 `embedding_error_message`, `graph_error_message` 필드 정의
  - 상세: `1-data-model.md §2.12`에는 이미 `embedding_error_message`와 `graph_error_message` 두 필드가 정의되어 있고, `10-graph-rag.md §7`도 `graph_error_message`를 참조한다. draft가 `8-embedding-pipeline.md §2`를 "Document.metadata" → "Document.embedding_error_message"로 수정하는 것은 data-model과 정렬되어 올바르다. 충돌은 없으나, `8-embedding-pipeline.md §2` 본문에 "Document.metadata"가 유일하게 남아있어 수정 시 data-model과 graph-rag spec과 일치하게 된다 — 검토 완료.
  - 제안: 변경 자체는 올바르다. 추가 동기화 불필요.

- **[INFO]** `spec/5-system/6-websocket-protocol.md §4.3` 이벤트 표기 방식 불일치 (점 표기 vs. 콜론 표기)
  - target 위치: draft §2 — 현재 `6-websocket-protocol.md §4.3` 이벤트명 `embedding.started/progress/completed/failed` (점 표기)를 `document:embedding_started` 등 (콜론+언더스코어 표기)으로 변경
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.1 실행 이벤트` — `execution.started`, `execution.completed` 등 점 표기 사용. `spec/5-system/8-embedding-pipeline.md §8` — 이미 콜론+언더스코어 표기 사용
  - 상세: 실행 이벤트 계열(`execution.*`)은 점 표기를 계속 사용하고, KB/임베딩 이벤트 계열은 콜론+언더스코어 표기로 정렬하는 것은 backend 구현 사실이다. 두 이벤트 계열이 같은 `6-websocket-protocol.md` 안에서 다른 명명 패턴을 갖게 된다. 이는 기술 이질성이지만 이미 `8-embedding-pipeline.md §8`에서 콜론 표기가 권위로 확정되어 있으므로 충돌이 아니라 명명 비일관성이다.
  - 제안: `6-websocket-protocol.md §1 또는 §4` 도입부에 "실행 이벤트는 `execution.*` 도트 네임스페이스, KB 이벤트는 `document:*` / `kb:*` 콜론 네임스페이스를 사용한다" 한 줄 명시를 추가해 의도적 분기임을 문서화하면 충분하다.

- **[INFO]** `spec/2-navigation/5-knowledge-base.md §2.4.1` retry-failed API scope 변경과 `data-flow/knowledge-base.md` 미반영
  - target 위치: draft §3 — `spec/2-navigation/5-knowledge-base.md §2.4.1` retry-failed의 scope에 `'all'` 추가 및 UI 버튼은 `'embedding'`·`'graph'`만 전송 footnote 추가
  - 충돌 대상: `spec/data-flow/knowledge-base.md` — retry-failed API 상세 기술 없음 (해당 파일에서 확인 불가)
  - 상세: `spec/5-system/8-embedding-pipeline.md §9.4`에는 이미 `scope: 'embedding' | 'graph' | 'all'`이 정의되어 있어 navigation spec 변경은 이와 일치한다. 충돌은 없다. 단, frontend가 `'all'` scope를 전송하지 않는다는 제약이 `8-embedding-pipeline.md §9.4`에는 명시되어 있지 않아 두 spec이 다른 수준의 정보를 갖게 된다.
  - 제안: `8-embedding-pipeline.md §9.4`에도 "UI는 `'embedding'`·`'graph'` 두 값만 전송. `'all'`은 운영/스크립트용" 동일 footnote를 추가하면 두 spec이 동기화된다.

---

## 요약

draft는 embedding pipeline 관련 4개 spec 파일을 일관성 있게 정비하려는 목적으로 작성되었으며, backend 구현 권위를 먼저 확인한 뒤 spec을 정렬하는 방향은 올바르다. 그러나 변경 대상 목록에서 **`spec/5-system/10-graph-rag.md`가 누락**된 것이 가장 큰 문제다. `kb:graph_stats_updated` 이벤트를 `5-knowledge-base.md`에서만 제거하면 `10-graph-rag.md §6`(공식 이벤트 표)·§2.3·§4.2(요구사항 KB-GR-OB-02)와 직접 모순이 발생한다. 채널 통합(`kb:{documentId}` 단일 채널) 역시 `10-graph-rag.md`와 `data-flow/knowledge-base.md`에 반영되어야 한다. 인덱스 변경도 V022/V023 언급만으로는 `data-flow/knowledge-base.md`에 이미 기술된 V030~V033 인덱스들을 누락하게 된다. Critical 이슈는 없으나 두 건의 WARNING을 해소하기 위해 변경 대상 파일 목록에 `spec/5-system/10-graph-rag.md`와 `spec/data-flow/knowledge-base.md`를 추가해야 한다.

---

## 위험도

MEDIUM
