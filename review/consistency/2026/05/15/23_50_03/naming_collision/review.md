# 신규 식별자 충돌 검토 — embedding-pipeline 정합성 정비 spec draft

## 발견사항

### 1. 채널 식별자 충돌 (CRITICAL)

- **[CRITICAL]** `embedding:{knowledgeBaseId}` vs `kb:{documentId}` — WebSocket 채널 식별자 의미 충돌
  - target 신규 식별자: `kb:{documentId}` (채널 패턴)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md §3.2` 채널 패턴 표 line 110 에서 `embedding:{knowledgeBaseId}` 가 "Knowledge Base 임베딩 진행 상태" 채널로 등록되어 있음
  - 상세: target draft 는 `spec/5-system/6-websocket-protocol.md §3.2` 의 채널 패턴 표에서 `embedding:{knowledgeBaseId}` 를 `kb:{documentId}` 로 변경하도록 지시하고 있다. 이는 동일 파일 내 동일 식별자를 교체하는 작업이므로 변경 자체는 권위(backend 구현) 기반으로 올바르다. 그러나 변경 **전까지는** 두 식별자가 동시에 다른 의미로 사용되어, 변경이 반쪽만 적용된 상태가 되면 스펙과 코드·프론트엔드 간 혼선이 생긴다. 즉, 이 변경이 target spec 4개 파일 전체에 원자적으로 반영되지 않을 경우 CRITICAL 충돌 상태가 됩니다.
  - 제안: `spec/5-system/6-websocket-protocol.md` 의 `§3.2` 채널 패턴 표 변경과 `§4.3` 이벤트 섹션 변경을 동일 커밋에 묶어 부분 적용을 방지한다. 변경 완료 후 `embedding:{knowledgeBaseId}` 식별자가 spec 어디에도 남지 않는지 전문(全文) grep 검증 권장.

---

### 2. 이벤트명 충돌 — 점 표기 vs 콜론 표기

- **[CRITICAL]** `embedding.started/progress/completed/failed` (점 표기 4개) vs `document:embedding_started/…` (콜론+언더스코어 12개) — 이벤트 이름 체계 충돌
  - target 신규 식별자: `document:embedding_started`, `document:embedding_progress`, `document:embedding_completed`, `document:embedding_error`, `document:embedding_retry`, `document:embedding_failed`, `document:graph_started`, `document:graph_progress`, `document:graph_completed`, `document:graph_error`, `document:graph_retry`, `document:graph_failed`
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md §4.3` 에서 `embedding.started`, `embedding.progress`, `embedding.completed`, `embedding.failed` 4개 이벤트가 점(`.`) 구분자 체계로 정의되어 있음. `spec/2-navigation/5-knowledge-base.md §2.7.1` 에서도 `document:graph_started/progress/completed/error` 표기가 혼재하여 일부는 콜론 체계, 일부는 옛 점 체계가 병존
  - 상세: 현재 spec 에는 점 구분 이벤트명(`embedding.started` 등)과 콜론+언더스코어 이벤트명(`document:embedding_started` 등)이 다른 파일·섹션에서 동일 개념에 대해 충돌하고 있다. target draft 가 올바른 방향(콜론 체계, 12개)으로 통일하려 하지만 변경 전인 현재 spec 에는 두 체계가 공존한다. `spec/5-system/6-websocket-protocol.md` 와 `spec/2-navigation/5-knowledge-base.md` 양쪽에 대한 변경이 동시에 이루어지지 않으면 이벤트명 체계가 일시적으로 3가지(점 4개 + 기존 콜론 일부 + 신규 콜론 12개)로 분기된다.
  - 제안: target draft 가 명시한 4개 spec 파일 변경을 단일 PR 에 묶어 원자적으로 반영한다. 특히 `§4.3` 의 점 표기 이벤트 4개 전부를 12개 콜론 체계로 교체하고, `§2.7.1` 의 콜론 4개(`document:graph_started/…/error`)에 `retry/failed` 2개를 추가 및 `kb:graph_stats_updated` 제거가 같은 커밋에 포함되어야 한다.

---

### 3. `kb:graph_stats_updated` — dead-path 이벤트명 잔존 충돌

- **[WARNING]** `kb:graph_stats_updated` — spec 에 정의된 이벤트명이 backend 코드에서 잘못된 채널로 emit되어 실질적 dead path
  - target 신규 식별자: 제거 대상 (`kb:graph_stats_updated` 를 spec 에서 삭제)
  - 기존 사용처: `spec/2-navigation/5-knowledge-base.md §2.7.1 line 139` 에서 `kb:graph_stats_updated` 이벤트가 graph 이벤트 목록에 포함되어 있음. 그러나 backend `kb-stats.helper.ts:42-46` 는 `emitExecutionEvent` 를 잘못 사용해 실제 채널이 `execution:kb:${kbId}` 가 되므로 frontend 의 `kb:` 구독에 도달하지 못함
  - 상세: spec 에는 존재하지만 코드에서 실질적으로 동작하지 않는 이벤트명이다. 이름 자체는 `kb:` namespace 를 사용하지만 이는 채널명이 아닌 이벤트 타입명으로, KbEventType union 에도 없어 `as never` 로 강제 캐스트된다. spec 에서 제거하면 이 이벤트가 "명세는 있지만 동작하지 않는 유령 이벤트" 로 남는 혼선을 해소할 수 있다. 단, 제거 후 dead path 코드(`kb-stats.helper.ts`) 처리는 별도 plan 에 위임해야 한다.
  - 제안: target draft 대로 spec 에서 `kb:graph_stats_updated` 제거 진행. 동시에 backend 의 dead path 코드를 별도 plan("dead path 처리" 후속 항목)으로 분리하여 추적 가능하게 유지한다.

---

### 4. `Document.metadata` vs `Document.embedding_error_message` — 필드명 변경

- **[WARNING]** `Document.metadata` (에러 저장 용도) vs `Document.embedding_error_message` — 에러 메시지 저장 필드 충돌
  - target 신규 식별자: `Document.embedding_error_message` (에러 메시지 저장 전용 필드)
  - 기존 사용처: `spec/5-system/8-embedding-pipeline.md §2` 에서 "실패 시: status: error, `Document.metadata` 에 에러 메시지 저장"으로 기술되어 있음. 그러나 `spec/1-data-model.md §2.12` 에는 `embedding_error_message Text?` 필드가 이미 "마지막 임베딩 오류 메시지 (sanitize 거친 사용자 노출용)" 로 정의되어 있음
  - 상세: 이미 data model spec 에는 `embedding_error_message` 가 권위 필드로 존재하는데, embedding pipeline spec 에는 구버전 표기인 `Document.metadata` 가 남아있는 상태다. target draft 가 pipeline spec 을 data model spec 과 일치시키는 방향이므로 변경 자체는 옳다. 변경 전까지는 두 spec 문서 간 필드명이 불일치한 상태.
  - 제안: target draft 대로 `spec/5-system/8-embedding-pipeline.md §2` 에서 `Document.metadata` → `Document.embedding_error_message` 로 변경한다. `spec/1-data-model.md` 는 이미 올바른 필드명을 갖고 있으므로 별도 변경 불필요.

---

### 5. `scope: 'embedding' | 'graph'` vs `scope: 'embedding' | 'graph' | 'all'` — API payload 필드 불일치

- **[WARNING]** retry-failed endpoint payload 에서 `scope` 값 집합 불일치
  - target 신규 식별자: `scope: 'embedding' | 'graph' | 'all'` (retry-failed API body)
  - 기존 사용처: `spec/2-navigation/5-knowledge-base.md §2.4.1 line 105` 에서 `POST /api/knowledge-bases/:id/retry-failed { scope: 'embedding' | 'graph' }` 로 `'all'` 없이 정의되어 있음. `spec/5-system/8-embedding-pipeline.md §9.4` 에서는 `scope: 'embedding' | 'graph' | 'all'` 로 이미 `'all'` 포함
  - 상세: 두 spec 문서 간 동일 API endpoint 의 payload 정의가 다르다. `8-embedding-pipeline.md §9.4` 에서는 `'all'` 이 있는데 `5-knowledge-base.md §2.4.1` 에서는 없다. target draft 는 knowledge-base spec 에 `'all'` 을 추가하고 footnote 로 "UI 는 embedding/graph 두 버튼만 노출, 'all' 은 운영/스크립트용" 을 명시하는 방향이다.
  - 제안: target draft 대로 `spec/2-navigation/5-knowledge-base.md §2.4.1` 에 `'all'` 값 추가 + footnote 삽입. 변경 후 두 문서 간 정의가 일치하는지 재확인.

---

### 6. DocumentChunk 인덱스 — `ivfflat` vs `partial HNSW (V022/V023)` 불일치

- **[WARNING]** DocumentChunk 인덱스 명세 불일치
  - target 신규 식별자: `partial HNSW (V022 vector / V023 halfvec)` (DocumentChunk 인덱스)
  - 기존 사용처: `spec/1-data-model.md §2.12.1` 에서 `ivfflat (embedding vector_cosine_ops)` 로 정의되어 있음. `spec/5-system/8-embedding-pipeline.md §6.1 DDL` 도 `IVFFlat` 단일 인덱스 예시로 기재
  - 상세: 실제 운영 인덱스는 V022/V023 마이그레이션으로 차원별 partial HNSW 로 분리되었지만 양쪽 spec 에는 구버전 IVFFlat 이 남아있다. target draft 는 `spec/1-data-model.md §2.12.1` 을 HNSW 로 교체하고 `spec/5-system/8-embedding-pipeline.md §6.2` 에는 "컨셉 예시" 노트를 추가하는 보수적 접근을 취하고 있다.
  - 제안: target draft 의 변경 범위가 적절하다. 단, `spec/5-system/8-embedding-pipeline.md §6.1` 표에서도 `DocumentChunk` 의 인덱스 컬럼 언급이 있다면 그 부분도 "권위 정의는 1-data-model.md §2.12.1" 한 줄로 교차 참조를 추가해야 한다.

---

### 7. `## 1. 개요` vs `## Overview` — 섹션 헤더 명명 불일치

- **[INFO]** `spec/5-system/8-embedding-pipeline.md §1` 헤더 명명 컨벤션 불일치
  - target 신규 식별자: `## Overview` (CLAUDE.md 권장 패턴)
  - 기존 사용처: `spec/5-system/8-embedding-pipeline.md §1` 에서 `## 1. 개요` 로 되어 있음. 다른 단일 spec 파일들(예: `spec/5-system/12-webhook.md`) 은 `## Overview (제품 정의)` 패턴을 사용
  - 상세: CLAUDE.md 가 권장하는 단일 spec 파일의 헤더 패턴은 `## Overview (제품 정의)` 이지만 target draft 는 `## Overview` 로만 변경하도록 되어있다. 충돌은 아니나 전체 일관성 측면에서 완전한 패턴 적용 여부를 고려할 수 있다.
  - 제안: `## Overview` 또는 `## Overview (제품 정의)` 중 어느 쪽을 채택할지 통일 기준을 정하고 동일 폴더 내 다른 spec 파일들과 맞춘다.

---

### 8. `spec/5-system/8-embedding-pipeline.md` 섹션 헤더 숫자 유지 여부

- **[INFO]** `§1 헤더를 ## Overview 로 변경 시 기존 §2~§9 번호 체계 연속성
  - target 신규 식별자: `## Overview` (번호 없는 헤더)
  - 기존 사용처: 동일 파일 내 `§2`, `§6.1`, `§6.2`, `§8`, `§9.4` 등 번호형 헤더가 연속 사용됨. 다른 spec 파일들도 혼재(일부는 번호, 일부는 `Overview` 무번호)
  - 상세: `§1 개요` 를 번호 없는 `## Overview` 로 바꾸면 나머지 `§2~§9` 이 무번호 Overview 다음에 번호 있는 헤더로 이어지는 비일관 구조가 된다. 다른 spec 에서 `§8` 처럼 번호로 크로스 참조하는 부분이 있으면 해당 참조가 깨질 수 있다.
  - 제안: `§1 개요` → `## Overview` 변경 시 하위 헤더(`§2~§9`)의 번호를 `§1~§8` 로 재조정하거나, 또는 기존 번호를 그대로 유지하되 Overview 섹션을 별도 prefix 없이 맨 앞에 두는 방식을 채택한다. 크로스 참조 링크(`§9.2`, `§9.4` 등)를 사용하는 다른 spec 문서도 함께 갱신 필요.

---

## 요약

target draft (`plan/in-progress/spec-draft-embedding-pipeline-consistency.md`) 는 코드 권위(backend WebSocket 구현 12개 이벤트 + `kb:{documentId}` 채널)를 기준으로 4개 spec 문서의 불일치를 해소하는 정합성 정비 작업이다. 식별자 충돌 관점에서 가장 심각한 위험은 WebSocket 채널 식별자(`embedding:{knowledgeBaseId}` → `kb:{documentId}`)와 이벤트명 체계(점 표기 → 콜론+언더스코어 체계)의 전환이 원자적으로 이루어지지 않을 경우다. 두 CRITICAL 항목은 모두 "현재 spec 에 남아있는 구 식별자와 신규 식별자의 공존" 문제이므로, 4개 파일의 변경이 단일 PR 에 묶여야 한다는 전제 조건이 충족되면 실질적 충돌은 해소된다. `kb:graph_stats_updated` dead-path 이벤트 제거와 `Document.metadata` → `Document.embedding_error_message` 교체는 spec 내 필드명/이벤트명 불일치를 올바르게 정리하는 방향이다. retry-failed API scope 값 집합 불일치와 DocumentChunk 인덱스 명세 불일치는 target draft 가 명시적으로 해소하고 있어 WARNING 수준에서 관리 가능하다. 섹션 헤더 명명 관련 INFO 항목은 기능적 충돌이 아닌 컨벤션 일관성 문제다.

## 위험도

MEDIUM
