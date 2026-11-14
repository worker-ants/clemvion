---
id: "CLE-KB-EMBED-REPROC"
title: "문서 임베딩 — 재임베딩과 실패 처리"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-KB-EMBED"
ancestors: ["CLE-VISION", "CLE-KB", "CLE-KB-EMBED"]
area: "CLE-KB"
content_hash: "b3611a27093ee140c0e263d55be4826fd8c699946bc56a7dd07450a70039deac"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "fc2e6071bec6db49b095451a878ea567314e43d331e9681874b0ab1fa97ff510"
etag: "sha256-9ad899ecf1a8b3db0bc1c7fd472d904bc48980e060598f71f5ba44649624c8da"
---
> 원문 · 구현 상태: [문서 임베딩](CLE-KB-EMBED.md) 머리 줄과 같다 · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [문서 임베딩](CLE-KB-EMBED.md) 의 하위 문서로 재임베딩(문서 하나 · 지식 저장소 전체), 일시 오류 재시도, 처리 중 문서 회수, 실패 문서 재시도를 정한다. 큐와 동시 처리 규칙은 부모 문서의 [큐와 동시 처리](CLE-KB-EMBED.md#큐와-동시-처리) 를 따른다. 임베딩 상태 다섯 값과 전이는 부모 문서의 [임베딩 상태](CLE-KB-EMBED.md#임베딩-상태) 에서 정한다.

## 재임베딩

### 문서 하나

`POST /api/knowledge-bases/:id/documents/:docId/re-embed`

1. 권한과 문서 존재를 확인한다.
2. `document-embedding` 큐에 `{ documentId, reEmbed: true }` 를 넣고 202 로 응답한다.
3. 워커가 기존 청크를 지우고 다시 임베딩한다.

### 지식 저장소 전체

`POST /api/knowledge-bases/:id/re-embed`

1. 재처리 잠금(`reembed_status`)을 원자적 비교 후 교체(CAS)로 얻는다. 같은 UPDATE 에서 저장 청크 차원도 NULL 로 비운다.

   ```sql
   UPDATE knowledge_base
     SET reembed_status = 'in_progress', embedding_dimension = NULL
     WHERE id = $1 AND workspace_id = $2 AND reembed_status = 'idle'
     RETURNING id
   ```

   바뀐 행이 0개면 409 `KB_REEMBED_IN_PROGRESS` 다. 판정은 바뀐 행 수로 한다([raw SQL 결과 읽기 규약](../CLE-ENG/CLE-ENG-RAWQUERY.md)).
2. 모든 문서를 대기 중으로 되돌리고 큐에 한꺼번에 넣는다(`addBulk`). 각 작업에 `isKbBatch: true`, `knowledgeBaseId` 를 싣는다.
3. 바로 202 와 `{ documentCount }` 로 응답한다.
4. 마지막 작업이 끝나거나 실패할 때 `DocumentEmbeddingProcessor` 가 그 지식 저장소의 대기 중·처리 중 문서가 0건인지 확인한다. 0건이면 잠금을 `idle` 로 되돌린다. 이 마무리는 잠금만 되돌리고 저장 청크 차원은 건드리지 않는다.
5. 문서가 없는 지식 저장소는 큐에 넣을 작업이 없어 마무리가 불리지 않는다. 그래서 진입할 때 바로 `idle` 로 되돌린다.

Graph RAG 지식 저장소는 재임베딩한 문서의 그래프 추출도 이어서 다시 한다([Graph RAG](CLE-KB-GRAPH.md)).

### 검색에서 빠지는 동안

저장 청크 차원이 NULL 인 지식 저장소는 저장 청크가 현재 모델과 같은 차원·벡터 공간이라는 보장이 없어 검색에서 빠진다. 두 경우에 생긴다.

- 전체 재임베딩이 진행 중일 때(`reembed_status='in_progress'`). 끝나면 다시 검색된다.
- 임베딩 모델 설정을 바꿔 저장 청크 차원이 NULL 이 됐지만 재임베딩을 아직 하지 않았을 때(`reembed_status='idle'`). 사용자가 전체 재임베딩을 실행할 때까지 이어진다.

검색에서 빠진 사실은 조용히 숨기지 않는다. 에이전트에는 검색 불가(`not_searchable`) 결과로, 검색 진단에는 `skipReason="kb_unsearchable"` 로 알린다([RAG 검색](CLE-KB-SEARCH.md)). 화면의 목록 카드 경고와 상세 배너는 [지식 저장소 관리](CLE-KB-MANAGE.md) 에서 정한다.

## 재시도와 실패

일시 오류로 문서가 처리 중에 영구히 머물지 않도록 자동 재시도와 명시적인 최종 실패 상태를 둔다.

### 자동 재시도

- 배치 임베딩 호출마다 60초 타임아웃(`withTimeout(60_000)`)을 건다.
- 문서 단위로 `retryWithBackoff(maxRetries=3, baseDelayMs=1_000)` 를 쓴다. 타임아웃, 5xx, 네트워크, 429 같은 일시 오류는 1초, 4초, 16초 간격(±30% 지터)으로 최대 3번 다시 시도한다(`EMBED_MAX_RETRIES`, `EMBED_BASE_DELAY_MS`). LlmService 안쪽의 속도 제한 재시도는 끄고 이 바깥 재시도만 쓴다.
- 재시도하지 않는 에러: 4xx(401·403·422), 차원 불일치, 빈 벡터 같은 도메인 에러는 바로 실패로 끝난다.
- 두 번째 시도부터는 `reEmbed=true` 를 강제해 앞 시도가 일부 저장한 청크를 지우므로 몇 번을 돌려도 결과가 같다.
- 재시도 횟수(`embedding_retry_count`)는 시도가 실패할 때마다 늘고 성공하면 0 이 된다.

### 처리 중 문서 회수

`StuckDocumentRecoveryService`(`OnApplicationBootstrap`)가 백엔드가 부팅할 때 한 번 다음 문서를 찾는다.

```sql
SELECT id FROM document
 WHERE embedding_status = 'processing'
   AND embedding_last_attempted_at IS NOT NULL
   AND embedding_last_attempted_at < NOW() - INTERVAL '10 minutes';
```

- 찾은 문서는 한 번의 `UPDATE … RETURNING` 으로 대기 중으로 되돌리고 `reEmbed=true` 로 큐에 다시 넣는다.
- 여러 인스턴스가 동시에 부팅해도 행 잠금과 `RETURNING` 으로 두 번 넣지 않는다.
- 마지막 시도 시각이 NULL 인 옛 문서는 잘못 회수하지 않도록 뺀다.
- 그래프 추출도 같은 방식으로 회수한다(`graph_last_attempted_at` 기준, [Graph RAG](CLE-KB-GRAPH.md)).

주기 작업이 아니라 부팅할 때 한 번만 돈다. 실행 엔진의 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 와는 다른 동작이다.

### 실패 문서 재시도

`POST /api/knowledge-bases/:id/retry-failed` `{ scope: 'embedding' | 'graph' | 'all' }`

- `scope` 가 `embedding` 이나 `all` 이면 임베딩 상태가 실패인 문서만 다시 넣는다.
- 큐에 넣기 직전에 `embedding_retry_count = 0`, `embedding_error_message = NULL`, `embedding_status = 'pending'` 으로 되돌린다.
- 100건씩 나눠 한꺼번에 큐에 넣는다(`isKbBatch=false`). 큐 추가가 실패하면 그 묶음의 문서를 실패로 되돌린다. 상태 UPDATE 와 큐 추가가 원자적이지 않아서 둔 보완이다.
- 지식 저장소 재처리 잠금은 건드리지 않는다. 일부 문서만 다시 돌리는 가벼운 작업이라서다.
- 권한은 편집자(`editor`) 이상, 속도 제한은 60초에 3번이다.
- `graph` 범위의 동작은 [Graph RAG](CLE-KB-GRAPH.md) 에서 정한다. 화면에서는 임베딩과 그래프 추출을 두 버튼으로 나눠 `embedding` 이나 `graph` 만 보낸다. `all` 은 운영과 스크립트용이다.

## 구현 위치

- `codebase/backend/src/modules/knowledge-base/queues/document-embedding.processor.ts` (재시도 · 전체 재임베딩 마무리)
- `codebase/backend/src/modules/knowledge-base/queues/stuck-document-recovery.service.ts`

## Rationale

### 부팅 회수 임계를 10분으로 둔 이유

BullMQ 의 멈춘 작업 판정 주기(`stalledInterval` 30초)의 두 배에 부팅 지연과 여유를 더한 값이다. 이보다 짧으면 정상적으로 도는 작업을 잘못 되돌릴 수 있다.

### 전체 재임베딩 잠금의 판정 결함 (2026-08-14 수정)

잠금은 처음부터 CAS 였지만 raw `UPDATE … RETURNING` 의 반환값이 행 배열이 아니라 `[rows, affectedCount]` 튜플이라 길이가 늘 2 였다. 그래서 "바뀐 행 0개" 판정이 성립하지 않아 동시 요청을 거절하지 못했고 409 도 나지 않았다. 그래프 재추출 잠금도 같은 결함이었다([Graph RAG](CLE-KB-GRAPH.md)). 결과를 읽는 규칙은 [raw SQL 결과 읽기 규약](../CLE-ENG/CLE-ENG-RAWQUERY.md) 에서 정한다.
