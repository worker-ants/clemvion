# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/8-embedding-pipeline.md`
검토 모드: 구현 착수 전 (`--impl-prep`)
검토 일시: 2026-05-15

---

## 발견사항

### 발견 1: WebSocket 이벤트 명명 체계 3중 충돌

- **[CRITICAL]** WebSocket 이벤트 type과 채널 이름이 세 spec 문서에서 모두 다르게 기술되어 있다
  - target 위치: `spec/5-system/8-embedding-pipeline.md §8 WebSocket 알림`
  - 충돌 대상 1: `spec/5-system/6-websocket-protocol.md §4.3 임베딩 이벤트`
  - 충돌 대상 2: `spec/2-navigation/5-knowledge-base.md §2.4.1 진행 박스`
  - 상세:
    - **채널 이름**: `8-embedding-pipeline.md`는 `kb:${documentId}`를 사용하지만, `6-websocket-protocol.md`는 `embedding:{knowledgeBaseId}`를 사용한다. documentId 기준(문서별 채널)과 knowledgeBaseId 기준(KB별 채널)은 구독 단위가 전혀 다르다.
    - **이벤트 type 형식**: `8-embedding-pipeline.md`는 `document:embedding_started` (콜론+언더스코어) 형식이지만, `6-websocket-protocol.md`는 `embedding.started` (점 표기) 형식을 정의한다.
    - **이벤트 목록 차이**: `6-websocket-protocol.md §4.3`은 `embedding.started / .progress / .completed / .failed` 4가지만 정의하며, `document:embedding_error`(일시 오류)와 `document:embedding_retry`(재시도 시작)가 없다. 이 둘은 `8-embedding-pipeline.md`가 §9.1 재시도 로직과 연결해 의미를 부여한 필수 이벤트다.
    - **`5-knowledge-base.md §2.4.1`**: 프론트엔드가 수신할 이벤트로 `document:embedding_retry`, `*_failed`, `*_completed`를 열거하는데, 이는 `6-websocket-protocol.md` 정의와 다른 콜론 계열 이름을 따른다.
  - 제안: 세 문서 중 `6-websocket-protocol.md §4.3`을 권위 문서로 삼아 채널 이름·이벤트 type·payload를 확정한 뒤, `8-embedding-pipeline.md §8`과 `5-knowledge-base.md §2.4.1`을 그에 맞춰 갱신하거나, 반대로 `8-embedding-pipeline.md`의 `document:` 계열이 최신 구현이라면 `6-websocket-protocol.md`를 개정해야 한다. 두 체계가 코드에 혼재하면 프론트엔드 구독 로직이 이벤트를 수신하지 못하는 런타임 오류가 발생한다.

---

### 발견 2: 실패 시 에러 메시지 저장 위치 불일치

- **[WARNING]** 임베딩 실패 에러 메시지를 어디에 저장하는지 두 spec이 다르게 기술한다
  - target 위치: `spec/5-system/8-embedding-pipeline.md §2 파이프라인 흐름` 마지막 줄
  - 충돌 대상: `spec/1-data-model.md §2.12 Document`
  - 상세: `8-embedding-pipeline.md §2`는 "실패 시: `status: error`, Document.metadata에 에러 메시지 저장"이라고 명시한다. 그러나 `1-data-model.md §2.12`에는 별도의 `embedding_error_message Text?` 컬럼이 정의되어 있고, "sanitize 거친 사용자 노출용"이라는 설명이 있다. `metadata JSONB` 컬럼도 문서에 존재하지만, 그 용도 설명에는 임베딩 에러 저장이 언급되어 있지 않다. §9.2 상태 전이와 §9.4 retry-failed 설명에서는 `embedding_error_message`를 사용하므로, 본문 §2의 기술은 구형 설계의 잔재다.
  - 제안: `8-embedding-pipeline.md §2`의 "Document.metadata에 에러 메시지 저장" 문구를 "Document.embedding_error_message에 에러 메시지 저장"으로 수정. target 문서 내에서도 §2와 §9.2·§9.4가 충돌하므로 단순 오기 수정으로 해결 가능하다.

---

### 발견 3: `retry-failed` API의 `scope` 파라미터 불일치

- **[WARNING]** 일괄 재시도 API의 `scope` 허용 값이 두 spec 사이에서 다르다
  - target 위치: `spec/5-system/8-embedding-pipeline.md §9.4 일괄 재시도 API`
  - 충돌 대상: `spec/2-navigation/5-knowledge-base.md §2.4.1 진행 박스`
  - 상세: `8-embedding-pipeline.md §9.4`는 `scope: 'embedding' | 'graph' | 'all'`을 정의하며, `'all'` 값은 임베딩과 그래프 재시도를 한 번에 트리거하는 편의 값이다. 그러나 `5-knowledge-base.md §2.4.1`의 버튼-API 매핑에서는 `scope: 'embedding'|'graph'`만 열거되어 있고 `'all'`이 누락되어 있다. 이를 그대로 구현하면 프론트엔드가 `'all'`을 호출하지 못하거나, 백엔드가 `'all'`을 무시한다.
  - 제안: `'all'` 값의 존재 여부를 최종 결정한 뒤 두 문서를 동기화한다. "임베딩 실패 재시도"와 "그래프 추출 실패 재시도"가 UI에서 버튼이 분리되어 있다면 `'all'`이 실제로 필요한지 검토 후 제거하거나 `5-knowledge-base.md`에 추가한다.

---

### 발견 4: Graph RAG WebSocket 이벤트가 프로토콜 spec에 누락

- **[INFO]** Graph RAG 진행 이벤트가 `6-websocket-protocol.md`에 정의되어 있지 않다
  - target 위치: (직접 연관 — Graph RAG 처리는 `8-embedding-pipeline.md §7.1.1`에서 chained dispatch로 참조)
  - 충돌 대상: `spec/2-navigation/5-knowledge-base.md §2.7.1`, `spec/5-system/6-websocket-protocol.md §4.3`
  - 상세: `5-knowledge-base.md §2.7.1`은 `document:graph_started / graph_progress / graph_completed / graph_error`, `kb:graph_stats_updated` 이벤트를 기술하지만, `6-websocket-protocol.md §4.3`은 임베딩 이벤트 4종만 정의하고 그래프 이벤트는 전혀 없다. Graph RAG chained dispatch를 구현할 때 이 이벤트들의 공식 채널·payload 정의가 없으면 구현자가 임의로 결정하게 된다.
  - 제안: `6-websocket-protocol.md §4.3`(또는 새 §4.4)에 그래프 추출 이벤트 블록을 추가한다. 채널 이름 결정 시 발견 1의 채널 통일 작업과 함께 진행하면 이중 수정을 줄일 수 있다.

---

### 발견 5: DocumentChunk 정의 이중화 — 동기화 위험

- **[INFO]** DocumentChunk 엔티티가 데이터 모델 spec과 임베딩 파이프라인 spec 양쪽에 정의된다
  - target 위치: `spec/5-system/8-embedding-pipeline.md §6.1 DocumentChunk 엔티티`
  - 충돌 대상: `spec/1-data-model.md §2.12.1 DocumentChunk`
  - 상세: 두 정의의 필드 목록은 현재 동일하나, 필드 타입 표기가 미묘하게 다르다. `1-data-model.md`는 `id UUID PK`, `chunk_index Integer` 등 명확한 타입을 사용하는 반면, `8-embedding-pipeline.md §6.1`은 `id UUID PK`, `chunk_index integer`(소문자)로 표기한다. 향후 필드가 변경될 때 한쪽만 갱신되면 정합이 깨진다. `§6.1` 하단에는 pgvector DDL까지 인라인으로 포함되어 있어 DDL이 마이그레이션 파일과 세 번째 사본이 된다.
  - 제안: `8-embedding-pipeline.md §6.1`에서 필드 표는 제거하고 `spec/1-data-model.md §2.12.1`로 링크 참조하도록 변경한다. DDL은 `spec/` 이 아닌 `backend/migrations/`가 권위이므로 spec에서 샘플 DDL로 명시하되 "참고용, 실제 마이그레이션이 권위" 노트를 추가한다.

---

## 요약

`spec/5-system/8-embedding-pipeline.md`는 임베딩 파이프라인의 전반적인 흐름·재시도 정책·API를 상세히 기술하고 있으며, 데이터 모델(`1-data-model.md`)이나 RAG 검색 spec(`9-rag-search.md`)과의 주요 구조적 합의는 유지되고 있다. 그러나 WebSocket 이벤트 명명 체계가 `6-websocket-protocol.md`와 `5-knowledge-base.md` 두 방향 모두와 다르게 기술되어 있어 구현 시 프론트엔드 구독 로직이 어느 쪽을 따르느냐에 따라 이벤트를 수신하지 못하는 런타임 버그로 직결될 수 있다(CRITICAL). 에러 메시지 저장 위치(`metadata` vs `embedding_error_message`)와 retry-failed API의 scope 파라미터 불일치는 구현 단계에서 혼란을 유발할 수 있는 WARNING이다. 구현 착수 전에 세 spec 간 WebSocket 이벤트 체계를 먼저 합의하고, 에러 메시지 필드 참조를 수정하는 것이 최소한의 사전 조치이다.

---

## 위험도

**HIGH**
