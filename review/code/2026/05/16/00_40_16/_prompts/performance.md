# 성능(Performance) Review Payload

본 파일은 orchestrator 가 성능(Performance) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 성능 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (성능(Performance))

1. **알고리즘 복잡도**: 시간/공간 복잡도, 비효율적인 알고리즘
2. **N+1 쿼리/호출**: 반복문 내 DB·API 호출, 배치 처리 가능 여부
3. **메모리 할당**: 불필요한 객체 생성, 대규모 데이터 적재, 메모리 누수 가능성
4. **캐싱**: 반복 계산/호출 결과 캐싱 필요성, 캐시 무효화 전략
5. **블로킹 I/O**: 동기 I/O 병목, 비동기 처리가 필요한 구간
6. **불필요한 연산**: 중복 계산, 과도한 문자열 연결 (O(n²) 누적 등)
7. **데이터 구조**: 용도에 맞지 않는 자료구조 사용
8. **지연 로딩**: 즉시 필요하지 않은 리소스의 선행 로딩

## 리뷰 대상 파일

### 파일 1: backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts b/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts
new file mode 100644
index 00000000..6907d4f7
--- /dev/null
+++ b/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts
@@ -0,0 +1,46 @@
+import { Test, TestingModule } from '@nestjs/testing';
+import { DataSource } from 'typeorm';
+
+import { KbStatsHelper } from './kb-stats.helper';
+
+describe('KbStatsHelper', () => {
+  let helper: KbStatsHelper;
+  let dataSource: { query: jest.Mock };
+
+  beforeEach(async () => {
+    dataSource = { query: jest.fn() };
+    const module: TestingModule = await Test.createTestingModule({
+      providers: [KbStatsHelper, { provide: DataSource, useValue: dataSource }],
+    }).compile();
+    helper = module.get(KbStatsHelper);
+  });
+
+  it('runs a single atomic UPDATE that recounts entity + relation and returns the new values', async () => {
+    dataSource.query.mockResolvedValue([
+      { entity_count: 12, relation_count: 34 },
+    ]);
+
+    await helper.refresh('kb-1');
+
+    expect(dataSource.query).toHaveBeenCalledTimes(1);
+    const [sql, params] = dataSource.query.mock.calls[0] as [string, unknown[]];
+    expect(sql).toMatch(/UPDATE\s+knowledge_base/i);
+    expect(sql).toMatch(/SET\s+entity_count\s*=\s*\(\s*SELECT\s+COUNT\(\*\)/i);
+    expect(sql).toMatch(/relation_count\s*=\s*\(\s*SELECT\s+COUNT\(\*\)/i);
+    expect(sql).toMatch(/WHERE\s+id\s*=\s*\$1/i);
+    expect(sql).toMatch(/RETURNING\s+entity_count,\s*relation_count/i);
+    expect(params).toEqual(['kb-1']);
+  });
+
+  it('tolerates an empty RETURNING result (KB row missing) without throwing', async () => {
+    dataSource.query.mockResolvedValue([]);
+
+    await expect(helper.refresh('kb-missing')).resolves.toBeUndefined();
+  });
+
+  it('propagates DB errors to the caller', async () => {
+    dataSource.query.mockRejectedValue(new Error('db down'));
+
+    await expect(helper.refresh('kb-1')).rejects.toThrow('db down');
+  });
+});

```

#### 전체 파일 컨텍스트
```
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { KbStatsHelper } from './kb-stats.helper';

describe('KbStatsHelper', () => {
  let helper: KbStatsHelper;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [KbStatsHelper, { provide: DataSource, useValue: dataSource }],
    }).compile();
    helper = module.get(KbStatsHelper);
  });

  it('runs a single atomic UPDATE that recounts entity + relation and returns the new values', async () => {
    dataSource.query.mockResolvedValue([
      { entity_count: 12, relation_count: 34 },
    ]);

    await helper.refresh('kb-1');

    expect(dataSource.query).toHaveBeenCalledTimes(1);
    const [sql, params] = dataSource.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/UPDATE\s+knowledge_base/i);
    expect(sql).toMatch(/SET\s+entity_count\s*=\s*\(\s*SELECT\s+COUNT\(\*\)/i);
    expect(sql).toMatch(/relation_count\s*=\s*\(\s*SELECT\s+COUNT\(\*\)/i);
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\$1/i);
    expect(sql).toMatch(/RETURNING\s+entity_count,\s*relation_count/i);
    expect(params).toEqual(['kb-1']);
  });

  it('tolerates an empty RETURNING result (KB row missing) without throwing', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(helper.refresh('kb-missing')).resolves.toBeUndefined();
  });

  it('propagates DB errors to the caller', async () => {
    dataSource.query.mockRejectedValue(new Error('db down'));

    await expect(helper.refresh('kb-1')).rejects.toThrow('db down');
  });
});

```

---

### 파일 2: backend/src/modules/knowledge-base/graph/kb-stats.helper.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts b/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts
index cd780117..453be250 100644
--- a/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts
+++ b/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts
@@ -1,30 +1,30 @@
 import { Injectable } from '@nestjs/common';
 import { DataSource } from 'typeorm';
-import { WebsocketService } from '../../websocket/websocket.service';
 
 /**
  * KB 의 entity_count / relation_count 캐시를 갱신하는 단일 진입점.
  *
  * 기존에는 GraphExtractionService 와 GraphQueryService 에 동일 SQL 사본이 있었고
- * 두 단계(SELECT 후 UPDATE)로 갈라져 비-원자였다. 본 helper 가:
- *
- *   1) `UPDATE knowledge_base SET (entity_count, relation_count) = (SELECT COUNT(*) ...)`
- *      단일 atomic SQL 로 캐시를 갱신
- *   2) 새 카운트를 RETURNING 으로 받아 WebSocket 으로 emit
+ * 두 단계(SELECT 후 UPDATE)로 갈라져 비-원자였다. 본 helper 는
+ * `UPDATE knowledge_base SET (entity_count, relation_count) = (SELECT COUNT(*) ...)`
+ * 단일 atomic SQL 로 캐시를 갱신한다.
  *
  * 호출자는 graph 데이터 변경 직후 (chunk 처리 / entity 삭제 / relation 삭제) 한 번씩 호출.
+ *
+ * 과거 이 메서드는 `kb:graph_stats_updated` WebSocket 이벤트도 broadcast 했으나,
+ * `emitExecutionEvent` 가 채널을 `execution:` prefix 로 변환해 frontend 의 `kb:`
+ * 구독에 도달하지 못하는 dead path 였다 (`KbEventType` union 에도 없는 type 을
+ * `as never` 로 강제 통과). frontend 는 이미 `document:graph_completed` 수신 시
+ * `kb-graph-stats` React Query 를 invalidate 해 통계를 갱신하므로 UX 영향 없음.
+ * 자세한 결정 근거는 `plan/complete/kb-graph-stats-dead-path.md` 와
+ * `spec/5-system/6-websocket-protocol.md ## Rationale` 참조.
  */
 @Injectable()
 export class KbStatsHelper {
-  constructor(
-    private readonly dataSource: DataSource,
-    private readonly websocketService: WebsocketService,
-  ) {}
+  constructor(private readonly dataSource: DataSource) {}
 
   async refresh(knowledgeBaseId: string): Promise<void> {
-    const rows = await this.dataSource.query<
-      { entity_count: number; relation_count: number }[]
-    >(
+    await this.dataSource.query(
       `UPDATE knowledge_base
          SET entity_count = (
                SELECT COUNT(*)::int FROM entity WHERE knowledge_base_id = $1
@@ -36,16 +36,5 @@ export class KbStatsHelper {
        RETURNING entity_count, relation_count`,
       [knowledgeBaseId],
     );
-    const entityCount = rows[0]?.entity_count ?? 0;
-    const relationCount = rows[0]?.relation_count ?? 0;
-    try {
-      this.websocketService.emitExecutionEvent(
-        `kb:${knowledgeBaseId}`,
-        'kb:graph_stats_updated' as never,
-        { knowledgeBaseId, entityCount, relationCount },
-      );
-    } catch {
-      // best-effort
-    }
   }
 }

```

#### 전체 파일 컨텍스트
```
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * KB 의 entity_count / relation_count 캐시를 갱신하는 단일 진입점.
 *
 * 기존에는 GraphExtractionService 와 GraphQueryService 에 동일 SQL 사본이 있었고
 * 두 단계(SELECT 후 UPDATE)로 갈라져 비-원자였다. 본 helper 는
 * `UPDATE knowledge_base SET (entity_count, relation_count) = (SELECT COUNT(*) ...)`
 * 단일 atomic SQL 로 캐시를 갱신한다.
 *
 * 호출자는 graph 데이터 변경 직후 (chunk 처리 / entity 삭제 / relation 삭제) 한 번씩 호출.
 *
 * 과거 이 메서드는 `kb:graph_stats_updated` WebSocket 이벤트도 broadcast 했으나,
 * `emitExecutionEvent` 가 채널을 `execution:` prefix 로 변환해 frontend 의 `kb:`
 * 구독에 도달하지 못하는 dead path 였다 (`KbEventType` union 에도 없는 type 을
 * `as never` 로 강제 통과). frontend 는 이미 `document:graph_completed` 수신 시
 * `kb-graph-stats` React Query 를 invalidate 해 통계를 갱신하므로 UX 영향 없음.
 * 자세한 결정 근거는 `plan/complete/kb-graph-stats-dead-path.md` 와
 * `spec/5-system/6-websocket-protocol.md ## Rationale` 참조.
 */
@Injectable()
export class KbStatsHelper {
  constructor(private readonly dataSource: DataSource) {}

  async refresh(knowledgeBaseId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE knowledge_base
         SET entity_count = (
               SELECT COUNT(*)::int FROM entity WHERE knowledge_base_id = $1
             ),
             relation_count = (
               SELECT COUNT(*)::int FROM relation WHERE knowledge_base_id = $1
             )
       WHERE id = $1
       RETURNING entity_count, relation_count`,
      [knowledgeBaseId],
    );
  }
}

```

---

### 파일 3: plan/in-progress/kb-graph-stats-dead-path.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/kb-graph-stats-dead-path.md b/plan/in-progress/kb-graph-stats-dead-path.md
index 8829137d..93a0ff4c 100644
--- a/plan/in-progress/kb-graph-stats-dead-path.md
+++ b/plan/in-progress/kb-graph-stats-dead-path.md
@@ -1,7 +1,8 @@
 ---
-worktree: (unassigned — dev 가 새 worktree 에서 처리)
+worktree: dead-path-removal-2f1c8a
 started: 2026-05-16
 owner: developer
+decision: option-B (코드 제거, spec 변경 reverse 없음)
 ---
 
 # KB-level WS 이벤트 dead path 처리
@@ -40,13 +41,32 @@ frontend `useKbEvents` 는 `kb:${documentId}` 채널을 구독하므로 본 이
 - `kb:reembed_started/finished` 가 실제 어디서 emit 되는지 grep — 발견 안 되면 옵션 B 로 spec 표기만 정합화로 끝남
 - 옵션 A 선택 시 `spec/5-system/6-websocket-protocol.md §4.3` 와 `spec/5-system/8-embedding-pipeline.md §8`, `spec/5-system/10-graph-rag.md §6`, `spec/data-flow/knowledge-base.md §2.5` 를 다시 갱신 필요
 
-## 작업 단위 (옵션 결정 후)
+## 옵션 결정 (2026-05-16, 사용자)
 
-- [ ] 옵션 결정 (사용자 또는 dev 판단)
-- [ ] 옵션 A 시: `WebsocketService.emitKbEvent` 의 union 에 새 type 추가, `kb-stats.helper.ts` 가 `emitKbEvent` 호출 (단, 첫 인자가 `documentId` 라 KB 통계 broadcast 에는 부적합 — 별도 `emitKnowledgeBaseEvent(kbId, …)` 도입 후 frontend 구독 추가도 검토)
-- [ ] 옵션 B 시: dead path 코드 제거 + 관련 spec 4 파일이 본 PR 의 표기를 유지하도록 검증
-- [ ] 단위/통합 테스트 갱신
-- [ ] PR 생성
+**옵션 B 선택**: 코드 제거 + spec 변경 reverse 없음.
+
+근거:
+- frontend `useKbEvents` 가 12개 `document:*` 이벤트 수신 시 `kb-graph-stats` React Query invalidate → REST `GET /:id/graph/stats` 재조회로 KB 통계 갱신. 본 broadcast 가 도달조차 못 하므로 제거해도 UX 변동 0.
+- 옵션 A 가 추가로 주는 가치는 "동시 admin 의 단건 삭제 실시간 반영" 한 가지뿐, 실제 발생 빈도 매우 낮음.
+- 옵션 A 는 frontend 까지 신규 채널 구독 추가 필요 — 변경 폭이 dead path 한 줄 제거보다 훨씬 큼.
+- `kb:reembed_*` 등 spec 환상은 코드에 emit 지점이 없어 옵션 B 에서 추가 작업 없음.
+
+## 작업 단위 (옵션 B)
+
+- [x] 옵션 결정 — 옵션 B
+- [x] consistency-check --impl-prep 통과 (`review/consistency/2026/05/16/00_32_47/SUMMARY.md`, BLOCK: NO)
+- [ ] `kb-stats.helper.spec.ts` 신규 작성 — refresh() SQL UPDATE 동작 회귀 방지 (TDD)
+- [ ] `kb-stats.helper.ts` broadcast 블록 (L41-49) 제거 + WebsocketService import/constructor 의존성 정리
+- [ ] TEST WORKFLOW (lint/unit/build, e2e skip — 영역 외)
+- [ ] REVIEW WORKFLOW (`/ai-review` + RESOLUTION.md)
+- [ ] plan complete/ 이동 + PR 생성
+
+## 후속 (본 PR scope 외, 별도 plan/PR)
+
+- `document:graph_completed` payload 필드명 정합화 (`entityDelta`/`relationDelta` vs spec `entityCount`/`relationCount`) — consistency-check WARNING #1
+- `GraphController.listEntities/listRelations` 반환 타입 Swagger 명시 — WARNING #4
+- `spec/5-system/10-graph-rag.md §2.2` enum 에 `failed` 추가 (project-planner) — INFO #2
+- `document:graph_error` emit 코드 추가 또는 spec 갱신 — INFO #1
 
 ## 의존성
 

```

#### 전체 파일 컨텍스트
```
---
worktree: dead-path-removal-2f1c8a
started: 2026-05-16
owner: developer
decision: option-B (코드 제거, spec 변경 reverse 없음)
---

# KB-level WS 이벤트 dead path 처리

> 작성 배경: `spec-pipeline-consistency-4c9e1f` worktree 의 spec 정합성 정비 (PR 생성 예정) 에서 발견된 코드 측 결함. spec 에서는 해당 이벤트들을 제거했지만, backend 코드는 그대로 남아있어 정리 필요.

## 배경

`backend/src/modules/websocket/websocket.service.ts:131-145` 의 `emitExecutionEvent` 는 첫 인자를 `executionId` 로 받아 채널을 `execution:${executionId}` 로 prefix 한다.

`backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:42-46` 가 이 함수를 다음과 같이 호출:

```ts
this.websocketService.emitExecutionEvent(
  `kb:${knowledgeBaseId}`,
  'kb:graph_stats_updated' as never,
  { knowledgeBaseId, entityCount, relationCount },
);
```

→ 실제 broadcast 되는 채널: `execution:kb:${knowledgeBaseId}`

frontend `useKbEvents` 는 `kb:${documentId}` 채널을 구독하므로 본 이벤트는 도달 불가. `KbEventType` union 에도 없으며 `as never` 강제 캐스트로만 통과.

`spec/data-flow/knowledge-base.md §2.5` 의 `kb:reembed_started/finished`, `kb:reextract_started/finished` 도 코드상 존재 확인되지 않은 동일 카테고리.

## 처리 옵션

옵션 A — **emit 경로 수정**: `emitKbEvent` 에 신규 type 추가 + `kb-stats.helper.ts` 호출을 그쪽으로 전환. spec 도 함께 reverse 해 이벤트를 권위로 다시 명시. KB 단위 통계가 정말 필요한 UX 시나리오가 있을 때 적합.

옵션 B — **코드 제거**: `kb-stats.helper.ts:42-49` 의 broadcast 블록 + `kb:reembed_started/finished` 등 emit 시도가 있다면 함께 제거. spec 은 본 PR 의 정비 상태 그대로 유지. 현재 UX 가 `document:graph_completed` payload 의 `entityCount`/`relationCount` 또는 `GET /:id/graph/stats` 폴링으로 충분히 작동한다면 적합.

## 의사결정 필요

- frontend KB 상세에서 graph 통계 카드가 어떤 경로로 갱신되는지 확인 (`document:graph_completed` 만으로 충분한지)
- `kb:reembed_started/finished` 가 실제 어디서 emit 되는지 grep — 발견 안 되면 옵션 B 로 spec 표기만 정합화로 끝남
- 옵션 A 선택 시 `spec/5-system/6-websocket-protocol.md §4.3` 와 `spec/5-system/8-embedding-pipeline.md §8`, `spec/5-system/10-graph-rag.md §6`, `spec/data-flow/knowledge-base.md §2.5` 를 다시 갱신 필요

## 옵션 결정 (2026-05-16, 사용자)

**옵션 B 선택**: 코드 제거 + spec 변경 reverse 없음.

근거:
- frontend `useKbEvents` 가 12개 `document:*` 이벤트 수신 시 `kb-graph-stats` React Query invalidate → REST `GET /:id/graph/stats` 재조회로 KB 통계 갱신. 본 broadcast 가 도달조차 못 하므로 제거해도 UX 변동 0.
- 옵션 A 가 추가로 주는 가치는 "동시 admin 의 단건 삭제 실시간 반영" 한 가지뿐, 실제 발생 빈도 매우 낮음.
- 옵션 A 는 frontend 까지 신규 채널 구독 추가 필요 — 변경 폭이 dead path 한 줄 제거보다 훨씬 큼.
- `kb:reembed_*` 등 spec 환상은 코드에 emit 지점이 없어 옵션 B 에서 추가 작업 없음.

## 작업 단위 (옵션 B)

- [x] 옵션 결정 — 옵션 B
- [x] consistency-check --impl-prep 통과 (`review/consistency/2026/05/16/00_32_47/SUMMARY.md`, BLOCK: NO)
- [ ] `kb-stats.helper.spec.ts` 신규 작성 — refresh() SQL UPDATE 동작 회귀 방지 (TDD)
- [ ] `kb-stats.helper.ts` broadcast 블록 (L41-49) 제거 + WebsocketService import/constructor 의존성 정리
- [ ] TEST WORKFLOW (lint/unit/build, e2e skip — 영역 외)
- [ ] REVIEW WORKFLOW (`/ai-review` + RESOLUTION.md)
- [ ] plan complete/ 이동 + PR 생성

## 후속 (본 PR scope 외, 별도 plan/PR)

- `document:graph_completed` payload 필드명 정합화 (`entityDelta`/`relationDelta` vs spec `entityCount`/`relationCount`) — consistency-check WARNING #1
- `GraphController.listEntities/listRelations` 반환 타입 Swagger 명시 — WARNING #4
- `spec/5-system/10-graph-rag.md §2.2` enum 에 `failed` 추가 (project-planner) — INFO #2
- `document:graph_error` emit 코드 추가 또는 spec 갱신 — INFO #1

## 의존성

- 본 PR (`spec-pipeline-consistency-4c9e1f` → main) 머지 후에 처리 시작.
- 옵션 A 선택 시 본 PR 의 spec 변경 중 `kb:graph_stats_updated` 관련 부분이 reverse 됨.

```
