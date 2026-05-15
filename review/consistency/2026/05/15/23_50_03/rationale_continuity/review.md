# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`
검토 기준 Rationale 출처: `spec/5-system/8-embedding-pipeline.md`, `spec/1-data-model.md`, `spec/5-system/6-websocket-protocol.md`, `spec/2-navigation/5-knowledge-base.md`

---

### 발견사항

- **[WARNING]** `spec/2-navigation/5-knowledge-base.md §2.4.1` 의 `scope` 파라미터 변경과 기존 UI 설계 사이의 Rationale 공백
  - target 위치: target 문서 "변경 대상 spec 문서" §3 — `spec/2-navigation/5-knowledge-base.md §2.4.1 line 105` 변경 항목
  - 과거 결정 출처: `spec/2-navigation/5-knowledge-base.md §2.4.1 (현행)` — "버튼 클릭 → ConfirmModal → `POST /api/knowledge-bases/:id/retry-failed { scope: 'embedding'|'graph' }`" (현행 스펙이 `'all'` 없이 두 값만 정의)
  - 상세: target 은 `scope: 'embedding' | 'graph' | 'all'` 로 확장하면서, `'all'` 을 "운영/스크립트용" 으로 정의하고 footnote 로 설명을 추가하는 방식을 취한다. 그러나 현행 `spec/5-system/8-embedding-pipeline.md §9.4` 는 이미 `scope: 'embedding' | 'graph' | 'all'` 를 명시하고 있으며, `spec/2-navigation/5-knowledge-base.md §2.4.1` 은 `scope: 'embedding'|'graph'` 만 명시하고 있다. 즉 두 spec 문서 간 불일치는 이미 존재했고 target 은 이를 정합화하려는 시도다. 단, target 자체에 "왜 `'all'` 이 spec 에 애초에 `5-knowledge-base.md` 에는 없었는가" 에 대한 Rationale 설명이 없다. 기존 상태가 의도된 생략이었는지, 누락이었는지가 target 에서 설명되지 않는다.
  - 제안: target 문서의 해당 변경 항목에 "현행 `§2.4.1` 이 `'all'` 을 명시하지 않은 것은 UI 노출 스코프와 API 스코프를 구분하지 않았던 초기 상태의 누락이었으며, 본 개정에서 두 스펙을 정합화한다" 는 한 줄 Rationale 을 추가하거나, spec 반영 시 `5-knowledge-base.md ## Rationale` 에 동일 내용을 기재한다.

- **[WARNING]** `spec/5-system/6-websocket-protocol.md §4.3` 채널 명명 변경의 Rationale 부재
  - target 위치: target 문서 "변경 대상 spec 문서" §2 — `spec/5-system/6-websocket-protocol.md §3.2 line 110` 및 `§4.3` 변경 항목
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §3.2 (현행)` — `embedding:{knowledgeBaseId}` 가 명시되어 있으며, `§4.3` 은 동일 채널과 점 표기 4-이벤트 패턴을 사용. 이 채널 명명 규약에 대한 Rationale 은 `6-websocket-protocol.md` 에 별도로 없다.
  - 상세: target 은 `embedding:{knowledgeBaseId}` → `kb:{documentId}` 로 채널 키 단위를 KB → 문서 레벨로 변경한다. 이것은 구독 granularity 를 근본적으로 바꾸는 결정이다(KB 단위 one subscription → 문서 단위 N subscriptions). 또한 이벤트 표기 패턴도 `embedding.started` (점 표기) → `document:embedding_started` (콜론-colon 표기) 로 변경된다. target 이 채택한 권위 근거는 backend 구현 코드(`websocket.service.ts:113-125`, `use-kb-events.ts`)이나, `6-websocket-protocol.md` 에는 "왜 KB 단위 채널이 아니라 document 단위인가", "왜 점 표기에서 콜론 표기로 바꾸었는가" 에 대한 Rationale 이 전혀 없다. 구현 사실을 spec 에 반영하는 방향이지만, spec 의 Rationale 섹션이 부재한 상태에서 기존 채널 패턴과 이벤트 표기 방식을 번복한다.
  - 제안: spec 반영 시 `6-websocket-protocol.md` 에 `## Rationale` 섹션을 신설하거나, 기존 Rationale 섹션이 있다면 "KB 단위 채널(`embedding:{kbId}`) 에서 문서 단위 채널(`kb:{documentId}`)로 전환한 이유 — 문서별 독립 진행 상태 추적 및 frontend 의 실제 구독 패턴 반영" 항목을 추가한다. 이벤트 표기 방식 변경(점 표기 → 콜론 표기)도 동일하게 기재한다.

- **[WARNING]** `spec/5-system/8-embedding-pipeline.md §2` 에러 저장 필드 변경의 Rationale 연결 미흡
  - target 위치: target 문서 "변경 대상 spec 문서" §1 — `§2 본문 끝` 변경 항목 ("Document.metadata에 에러 메시지 저장" → "Document.embedding_error_message 에 저장")
  - 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md §2 (현행)` — "실패 시: status: error, Document.metadata에 에러 메시지 저장." (현행 문서). `spec/1-data-model.md §2.12 Document` 의 `embedding_error_message` 필드는 이미 정의되어 있으며("sanitize 거친 사용자 노출용"), `metadata` 필드도 별도로 존재한다.
  - 상세: `1-data-model.md` 에는 이미 `embedding_error_message` 컬럼이 정의되어 있으므로 target 의 변경 방향은 타당하다. 그러나 "왜 `metadata` 에 에러를 저장하는 옛 방식이 폐기되었는가" 에 대한 Rationale 이 target 에도, `8-embedding-pipeline.md` 의 기존 Rationale 에도 존재하지 않는다. `metadata` 에 에러를 저장하는 패턴이 다른 맥락에서는 여전히 유효한지(예: 파싱 오류, graph 오류 등)도 불명확하다.
  - 제안: spec 반영 시 `8-embedding-pipeline.md ## Rationale` 에 "`metadata` 에 에러 메시지를 저장하는 구 방식은 전용 컬럼 `embedding_error_message` 도입(V024 후속) 으로 폐기됨 — sanitize·사용자 노출용 메시지와 범용 메타데이터를 분리하기 위함" 한 줄을 추가한다.

- **[INFO]** `spec/5-system/8-embedding-pipeline.md ## Rationale` 섹션 헤더 변경의 의미 범위 확인 권고
  - target 위치: target 문서 "Rationale 섹션 정리" — 헤더 "작업 메모: 지식베이스 임베딩 모델 사용자 선택 (2026-05-02 완료)" → "결정: 다중 차원 임베딩 + KB 단위 모델 선택 (2026-05-02)"
  - 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md ## Rationale` 현행 헤더
  - 상세: 이 변경은 "작업 일지 형식 → 결정 중심 표현" 으로의 포맷 정돈이며, 정보 손실 없이 수행하겠다고 target 이 명시하고 있다. 직접적인 Rationale 위반은 아니다. 단, V022/V023 에서 도입된 partial HNSW 인덱스에 대한 Rationale 항목이 `8-embedding-pipeline.md` 의 기존 Rationale 에 아직 반영되지 않은 상태(V022/V023 은 "핵심 결과" 섹션에 있으나 별도 Rationale 결정 항목으로는 없음)임을 유의해야 한다.
  - 제안: spec 반영 시 "왜 IVFFlat 에서 partial HNSW 로 변경했는가" (다차원 지원, 차원별 cast 필요성) 에 대한 한 줄 Rationale 항목을 추가하면 future reader 의 혼선이 줄어든다.

- **[INFO]** `spec/5-system/8-embedding-pipeline.md §8` 에 `kb:graph_stats_updated` dead path 제거 후 Rationale 기록 권고
  - target 위치: target 문서 "변경 대상 spec 문서" §3 — `spec/2-navigation/5-knowledge-base.md §2.7.1 line 139` 에서 `kb:graph_stats_updated` 제거
  - 과거 결정 출처: `spec/2-navigation/5-knowledge-base.md §2.7.1 (현행)` — `kb:graph_stats_updated` 이벤트가 명시됨
  - 상세: target 은 `kb:graph_stats_updated` 를 dead path(실제 frontend 의 `kb:` 채널에 도달하지 못하는 구현 결함) 로 확인하고 spec 에서 제거한다. 이것 자체는 타당한 판단이다. 그러나 "이 이벤트가 왜 추가되었다가 제거되었는가" 에 대한 기록이 spec 어디에도 남지 않는다. 나중에 누군가 graph stats real-time 갱신 필요성을 다시 제기할 때 동일한 시도를 반복할 수 있다.
  - 제안: `2-navigation/5-knowledge-base.md ## Rationale` 또는 `8-embedding-pipeline.md ## Rationale` 에 "`kb:graph_stats_updated` 이벤트는 `emitExecutionEvent` 의 채널 prefix 충돌로 frontend `kb:` 구독에 도달하지 못하는 dead path 였음. backend 코드 결함은 후속 plan 으로 분리되었으며, spec 에서는 제거하되 코드 수정 전까지 `graph_stats` 실시간 갱신은 polling fallback 에 의존" 한 줄을 추가한다.

---

### 요약

target 문서(`spec-draft-embedding-pipeline-consistency.md`)는 대체로 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하지 않는다. 변경의 핵심 방향(채널 명명 수정, 이벤트 수 확장, 에러 필드 정정, 인덱스 표기 갱신)은 모두 코드 권위(backend/frontend 실제 구현)를 근거로 spec 을 맞춰가는 정합화 작업이다. 다만 세 가지 WARNING 이 존재한다. (1) `scope: 'all'` 파라미터가 `5-knowledge-base.md` 에 기존에 없었던 이유에 대한 Rationale 공백, (2) WebSocket 채널 명명 방식(`embedding:{kbId}` → `kb:{documentId}`)과 이벤트 표기 패턴 변경에 대한 `6-websocket-protocol.md` 의 Rationale 전무, (3) `metadata` 에서 `embedding_error_message` 로의 에러 저장 필드 전환에 대한 근거 미기록. 이 세 항목은 CRITICAL 수준은 아니나, 향후 유지보수 시 과거 결정의 맥락을 잃어버릴 수 있어 spec 반영 시 해당 문서의 Rationale 섹션에 각각 한 줄씩 추가하는 것을 권고한다.

---

### 위험도

LOW
