# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/8-embedding-pipeline.md`
검토 모드: `--impl-prep` (구현 착수 전)

---

## 발견사항

### [INFO] `document-embedding` 큐 이름 — 코퍼스 내 다른 언급과 정합 확인
- target 신규 식별자: BullMQ 큐 이름 `document-embedding` (§7.1)
- 기존 사용처: `spec/1-data-model.md §2.11` KnowledgeBase, `spec/2-navigation/5-knowledge-base.md` (코퍼스에 포함되지 않았지만 §7.3.2 V024 Rationale 내에서 동일 이름 참조됨)
- 상세: target 문서 §7, §9.3에서 `document-embedding`이라는 큐 이름이 정의되어 있고, Rationale §V024 내에서도 동일 이름으로 언급된다. 코퍼스상 동일 의미로 사용되어 충돌은 없다.
- 제안: 충돌 없음. 현행 유지.

### [INFO] `graph-extraction` 큐 이름 — Graph RAG spec과의 연계
- target 신규 식별자: BullMQ 큐 이름 `graph-extraction` (§7.1.1)
- 기존 사용처: `spec/5-system/10-graph-rag.md §3` 에서 동일 큐를 참조한다고 target 문서가 명시
- 상세: target §7.1.1은 `graph-extraction` 큐로 child job을 add한다고 기술하고 있으며, Graph RAG spec(§3)에서 동일 명칭이 사용되는 구조다. 코퍼스에 Graph RAG spec 전문이 포함되지 않아 직접 대조는 불가하나, target 문서 자체가 해당 spec을 참조 문서로 명시하고 있어 의도적 연계임이 확인된다.
- 제안: 충돌 없음. `spec/5-system/10-graph-rag.md §3`에서도 동일 큐 이름이 사용되는지 구현 전 재확인 권장.

### [INFO] WebSocket 이벤트 `document:embedding_error` — 의미 변경 이력
- target 신규 식별자: WebSocket 이벤트 `document:embedding_error` (§8)
- 기존 사용처: 동일 파일 §8에 "(의미 변경, 2026-05-11)" 주석 포함
- 상세: 이 이벤트는 과거에는 영구 실패 신호로 사용되었다가 in-flight 일시 오류 신호로 의미가 바뀌었다. 영구 실패는 `document:embedding_failed`로 이관되었다. spec 내에 의미 변경 이력이 명시되어 있어 내부 정합은 유지되지만, 프론트엔드 구현 코드에서 구 의미로 처리하는 핸들러가 남아 있을 경우 충돌이 발생할 수 있다.
- 제안: 구현 착수 전 프론트엔드에서 `document:embedding_error` 핸들러가 구 의미(영구 실패)로 처리하는 코드가 있는지 검색하고, 있다면 `document:embedding_failed` 이벤트 처리로 전환.

### [INFO] `StuckDocumentRecoveryService` — 서비스 명칭 충돌 가능성
- target 신규 식별자: 서비스 클래스명 `StuckDocumentRecoveryService` (§9.3)
- 기존 사용처: 코퍼스에서 직접 언급 없음
- 상세: `OnApplicationBootstrap` 훅을 사용하는 이 서비스가 별도 파일로 존재할 경우, Graph RAG spec에서 유사한 패턴(`stuck graph extraction recovery` 등)의 서비스가 별도로 정의될 가능성이 있다. 현재 코퍼스 범위 내에서 동일 이름의 다른 서비스는 발견되지 않음.
- 제안: 충돌 없음. 다만 Graph RAG 구현 시 동일 패턴의 서비스가 추가될 경우 `StuckDocumentRecoveryService`와 네이밍 혼선이 없도록 명명 규칙을 통일 권장.

### [INFO] `DocumentEmbeddingProcessor` — 클래스명
- target 신규 식별자: BullMQ Processor 클래스 `DocumentEmbeddingProcessor` (§7.2, §7.3.2)
- 기존 사용처: 코퍼스 내 직접 등장 없음
- 상세: target 문서 내에서 일관되게 사용되며 코퍼스 내 다른 의미로 사용된 사례는 발견되지 않음.
- 제안: 충돌 없음.

### [INFO] API 엔드포인트 — 코퍼스 내 정의된 엔드포인트와 중복 없음 확인
- target 신규 식별자: 아래 엔드포인트들 (§7.1, §7.3)
  - `POST /api/knowledge-bases/:id/documents` (문서 업로드 진입점)
  - `POST /api/knowledge-bases/:id/documents/:docId/re-embed`
  - `POST /api/knowledge-bases/:id/re-embed`
  - `POST /api/knowledge-bases/:id/retry-failed`
- 기존 사용처: `spec/2-navigation/5-knowledge-base.md` (코퍼스에는 제목만 언급되고 전문 미포함), Rationale §V024에서 동일 경로 언급
- 상세: 코퍼스에서 명시적으로 확인 가능한 범위(`spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`)의 API 엔드포인트(`/api/dashboard/*`, `/api/workflows/*`)와는 경로 충돌이 없다. `/api/knowledge-bases/:id/re-embed`는 Rationale에서도 언급되어 동일 의미임이 확인된다.
- 제안: 충돌 없음. `spec/2-navigation/5-knowledge-base.md`의 API 표와 동기화 여부는 구현 전 확인 권장.

---

## 요약

`spec/5-system/8-embedding-pipeline.md`는 Knowledge Base 임베딩 파이프라인에 특화된 기존 spec 문서로, 이번 `--impl-prep` 검토 범위에서 신규로 도입하는 식별자는 해당 도메인(KB, Document, DocumentChunk) 내에서 일관되게 정의·사용되고 있다. 코퍼스 내 다른 영역(`/api/dashboard/*`, `/api/workflows/*`, 인증 API 등)과 경로·엔티티명·이벤트명이 겹치는 사례는 발견되지 않았다. 다만 WebSocket 이벤트 `document:embedding_error`의 의미 변경(영구 실패 → 일시 오류)이 2026-05-11에 이루어졌으므로, 구현 착수 전 프론트엔드 핸들러 코드에서 구 의미로 처리하는 부분이 남아있는지 확인이 필요하다. 나머지 식별자는 CRITICAL·WARNING 수준의 충돌이 없는 것으로 판단된다.

---

## 위험도

LOW
