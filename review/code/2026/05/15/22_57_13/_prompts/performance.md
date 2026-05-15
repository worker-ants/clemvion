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

### 파일 1: backend/package.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/backend/package.json b/backend/package.json
index 7917d7a2..8bddbf0a 100644
--- a/backend/package.json
+++ b/backend/package.json
@@ -12,6 +12,7 @@
     "start:dev": "nest start --watch",
     "start:debug": "nest start --debug --watch",
     "start:prod": "node dist/main",
+    "cleanup:queue-jobs": "node dist/scripts/cleanup-invalid-queue-jobs.js",
     "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
     "test": "jest",
     "test:watch": "jest --watch",

```

#### 전체 파일 컨텍스트
```
{
  "name": "backend",
  "version": "0.0.1",
  "description": "",
  "author": "",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "cleanup:queue-jobs": "node dist/scripts/cleanup-invalid-queue-jobs.js",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.95.1",
    "@aws-sdk/client-s3": "^3.1045.0",
    "@google/genai": "^1.50.1",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@nestjs-modules/mailer": "^2.3.4",
    "@nestjs/bullmq": "^11.0.4",
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.3",
    "@nestjs/core": "^11.0.1",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/platform-socket.io": "^11.1.17",
    "@nestjs/schedule": "^6.1.3",
    "@nestjs/swagger": "^11.2.7",
    "@nestjs/throttler": "^6.5.0",
    "@nestjs/typeorm": "^11.0.0",
    "@nestjs/websockets": "^11.1.17",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/auto-instrumentations-node": "^0.55.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.205.0",
    "@opentelemetry/resources": "^2.0.0",
    "@opentelemetry/sdk-node": "^0.205.0",
    "@opentelemetry/semantic-conventions": "^1.30.0",
    "@workflow/expression-engine": "file:../packages/expression-engine",
    "@workflow/node-summary": "file:../packages/node-summary",
    "bcrypt": "^6.0.0",
    "bullmq": "^5.76.6",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "cookie-parser": "^1.4.7",
    "cron-parser": "^5.5.0",
    "csv-parse": "^6.2.1",
    "dayjs": "^1.11.20",
    "ioredis": "^5.10.1",
    "mysql2": "^3.22.0",
    "nodemailer": "^8.0.4",
    "openai": "^6.33.0",
    "otplib": "^12.0.1",
    "p-limit": "^7.3.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "pdf-parse": "^2.4.5",
    "pg": "^8.20.0",
    "qrcode": "^1.5.4",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "socket.io": "^4.8.3",
    "typeorm": "^0.3.28",
    "uuid": "^13.0.2",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.2.0",
    "@eslint/js": "^9.18.0",
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/bcrypt": "^6.0.0",
    "@types/cookie-parser": "^1.4.10",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/multer": "^2.1.0",
    "@types/node": "^22.10.7",
    "@types/nodemailer": "^7.0.11",
    "@types/passport-jwt": "^4.0.1",
    "@types/passport-local": "^1.0.38",
    "@types/pdf-parse": "^1.1.5",
    "@types/pg": "^8.20.0",
    "@types/qrcode": "^1.5.5",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^10.0.0",
    "eslint": "^9.18.0",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-prettier": "^5.2.2",
    "globals": "^16.0.0",
    "jest": "^30.0.0",
    "prettier": "^3.4.2",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0"
  },
  "overrides": {
    "lodash": "^4.18.0",
    "picomatch": "^4.0.4",
    "liquidjs": "^10.25.7",
    "ip-address": "^10.2.0",
    "express-rate-limit": "^8.5.1"
  }
}

```

---

### 파일 2: backend/scripts/cleanup-invalid-queue-jobs.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/scripts/cleanup-invalid-queue-jobs.ts b/backend/scripts/cleanup-invalid-queue-jobs.ts
deleted file mode 100644
index 48b4146c..00000000
--- a/backend/scripts/cleanup-invalid-queue-jobs.ts
+++ /dev/null
@@ -1,127 +0,0 @@
-/* eslint-disable no-console */
-/**
- * BullMQ 큐 손상 job 1회성 정리 스크립트.
- *
- * `documentId` 가 비어있는(undefined/null/'' /공백/non-string) job 만 찾아낸다.
- * - 정상 흐름의 producer 는 항상 DB UUID 를 채워 enqueue 하므로 false-positive 없음
- * - Redis 에 누적된 손상/레거시 job 이 worker 부팅 직후 폭주하는 회귀를 청소
- *
- * 본 스크립트는 NestJS AppModule 을 부팅하지 않고 BullMQ Queue 만 직접 생성하므로
- * `@Processor` 워커가 활성화되지 않는다. DB 자격증명도 메모리에 로드되지 않는다.
- *
- * 사용 (`ts-node` 가 devDependencies 에 있어야 함):
- *   # dry-run — 출력만, 삭제 없음
- *   npx ts-node backend/scripts/cleanup-invalid-queue-jobs.ts
- *
- *   # apply — 손상 job 만 remove()
- *   npx ts-node backend/scripts/cleanup-invalid-queue-jobs.ts --apply
- *
- * 운영 절차:
- *   1) **워커 stop / 큐 pause** — 활성 처리 중 job 이 false-positive 로 잡히는
- *      TOCTOU 를 방지하기 위해 backend 인스턴스를 중지하거나 큐를 paused 상태로 둔다.
- *   2) dry-run 실행 → 출력 검토 (jobId / name / timestamp / payloadKeys)
- *   3) --apply 로 1회 정리
- *   4) 워커 재기동
- *
- * 본 스크립트는 회귀 재발 대비로 `scripts/` 에 보존한다 — 일회성이지만 운영자가
- * 동일 증상을 마주칠 때 재실행 가능.
- */
-import * as path from 'path';
-import * as dotenv from 'dotenv';
-import { Queue, type Job } from 'bullmq';
-
-{
-  const envPath = path.resolve(__dirname, '..', '.env');
-  const result = dotenv.config({ path: envPath });
-  if (result.error && require.main === module) {
-    console.warn(`[cleanup-invalid-queue-jobs] no .env at ${envPath}`);
-  }
-}
-
-import { DOCUMENT_EMBEDDING_QUEUE } from '../src/modules/knowledge-base/queues/document-embedding.queue';
-import { GRAPH_EXTRACTION_QUEUE } from '../src/modules/knowledge-base/queues/graph-extraction.queue';
-import { isValidDocumentId } from '../src/modules/knowledge-base/queues/job-payload.util';
-
-const QUEUE_STATES = ['waiting', 'delayed', 'failed', 'paused'] as const;
-const PAGE_SIZE = 1000;
-
-function createQueue(name: string): Queue {
-  const host = process.env.REDIS_HOST ?? 'localhost';
-  const port = Number(process.env.REDIS_PORT ?? 6379);
-  return new Queue(name, { connection: { host, port } });
-}
-
-async function sweepQueue(
-  name: string,
-  queue: Queue,
-  apply: boolean,
-): Promise<number> {
-  console.log(`[${name}] scanning states=${QUEUE_STATES.join(',')}`);
-
-  let invalidTotal = 0;
-  let start = 0;
-  // 페이지네이션 — 수만 건 이상 누적 시 OOM 방지.
-  while (true) {
-    const page = (await queue.getJobs(
-      [...QUEUE_STATES],
-      start,
-      start + PAGE_SIZE - 1,
-    )) as Job[];
-    if (page.length === 0) break;
-
-    const invalidPage = page.filter(
-      (j) =>
-        !isValidDocumentId(
-          (j.data as { documentId?: unknown } | undefined)?.documentId,
-        ),
-    );
-    for (const job of invalidPage) {
-      const keys = Object.keys(job.data ?? {}).join(',');
-      console.log(
-        `  jobId=${job.id} name=${job.name} ts=${job.timestamp} attempts=${job.attemptsMade} payloadKeys=[${keys}]`,
-      );
-    }
-    if (apply && invalidPage.length > 0) {
-      await Promise.all(
-        invalidPage.map((j) =>
-          j.remove().catch((err: unknown) => {
-            const msg = err instanceof Error ? err.message : String(err);
-            console.warn(`    remove failed for jobId=${j.id}: ${msg}`);
-          }),
-        ),
-      );
-    }
-    invalidTotal += invalidPage.length;
-    if (page.length < PAGE_SIZE) break;
-    start += PAGE_SIZE;
-  }
-  console.log(`[${name}] invalid=${invalidTotal}`);
-  return invalidTotal;
-}
-
-async function main(): Promise<void> {
-  const apply = process.argv.includes('--apply');
-  const queues = [DOCUMENT_EMBEDDING_QUEUE, GRAPH_EXTRACTION_QUEUE].map(
-    (name) => ({ name, queue: createQueue(name) }),
-  );
-
-  let totalInvalid = 0;
-  try {
-    for (const { name, queue } of queues) {
-      totalInvalid += await sweepQueue(name, queue, apply);
-    }
-  } finally {
-    await Promise.all(queues.map(({ queue }) => queue.close()));
-  }
-
-  console.log(
-    apply
-      ? `Removed ${totalInvalid} invalid jobs.`
-      : `Found ${totalInvalid} invalid jobs (dry-run — pass --apply to remove).`,
-  );
-}
-
-main().catch((err) => {
-  console.error(err);
-  process.exit(1);
-});

```

---

### 파일 3: backend/src/modules/executions/background-runs/background-runs.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/executions/background-runs/background-runs.service.ts b/backend/src/modules/executions/background-runs/background-runs.service.ts
index df61f8be..7435bef2 100644
--- a/backend/src/modules/executions/background-runs/background-runs.service.ts
+++ b/backend/src/modules/executions/background-runs/background-runs.service.ts
@@ -13,7 +13,6 @@ import {
 import { NotificationsService } from '../../notifications/notifications.service';
 import {
   BackgroundRunNodeExecutionDto,
-  BackgroundRunNodeExecutionsPageDto,
   BackgroundRunNotificationDto,
   BackgroundRunResponseDto,
   BackgroundRunStatus,
@@ -74,10 +73,9 @@ export class BackgroundRunsService {
       .createQueryBuilder('ne')
       .innerJoin('execution', 'e', 'e.id = ne.execution_id')
       .innerJoin('workflow', 'w', 'w.id = e.workflow_id')
-      .where(
-        "ne.output_data #>> '{meta,backgroundRunId}' = :backgroundRunId",
-        { backgroundRunId },
-      )
+      .where("ne.output_data #>> '{meta,backgroundRunId}' = :backgroundRunId", {
+        backgroundRunId,
+      })
       .select('w.workspace_id', 'workspaceId')
       .getRawOne<{ workspaceId: string }>();
     return !!raw?.workspaceId && raw.workspaceId === userWorkspaceId;
@@ -209,10 +207,10 @@ export class BackgroundRunsService {
       .createQueryBuilder('ne')
       .where('ne.executionId = :executionId', { executionId })
       // 실제 컬럼명 `output_data` 사용 — TypeORM 의 QueryBuilder 는 단순
-       // 컬럼 reference (`alias.property`) 에서만 property→column 매핑하고,
-       // JSONB `#>>` 같은 raw SQL 표현식 내부는 그대로 전달한다. property 명
-       // (`outputData`) 으로 쓰면 운영에서 `column "outputData" does not exist`
-       // 로 실패한다 (mock 기반 unit test 가 못 잡는 사각).
+      // 컬럼 reference (`alias.property`) 에서만 property→column 매핑하고,
+      // JSONB `#>>` 같은 raw SQL 표현식 내부는 그대로 전달한다. property 명
+      // (`outputData`) 으로 쓰면 운영에서 `column "outputData" does not exist`
+      // 로 실패한다 (mock 기반 unit test 가 못 잡는 사각).
       .andWhere(
         "ne.output_data #>> '{meta,backgroundRunId}' = :backgroundRunId",
         { backgroundRunId },
@@ -255,7 +253,9 @@ export class BackgroundRunsService {
         },
       );
     }
-    qb.orderBy('ne.startedAt', 'ASC').addOrderBy('ne.id', 'ASC').take(limit + 1);
+    qb.orderBy('ne.startedAt', 'ASC')
+      .addOrderBy('ne.id', 'ASC')
+      .take(limit + 1);
     return qb.getMany();
   }
 
@@ -281,7 +281,9 @@ export class BackgroundRunsService {
     return { data, nextCursor, hasMore };
   }
 
-  private toNodeExecutionDto(row: NodeExecution): BackgroundRunNodeExecutionDto {
+  private toNodeExecutionDto(
+    row: NodeExecution,
+  ): BackgroundRunNodeExecutionDto {
     return {
       id: row.id,
       executionId: row.executionId,
@@ -297,9 +299,7 @@ export class BackgroundRunsService {
     };
   }
 
-  private async aggregateBodyStatus(
-    parentNodeExecutionId: string,
-  ): Promise<{
+  private async aggregateBodyStatus(parentNodeExecutionId: string): Promise<{
     totalCount: number;
     pendingCount: number;
     runningCount: number;

```

#### 전체 파일 컨텍스트
```
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Execution } from '../entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  BackgroundRunNodeExecutionDto,
  BackgroundRunNotificationDto,
  BackgroundRunResponseDto,
  BackgroundRunStatus,
} from './dto/background-run-response.dto';
import { QueryBackgroundRunDto } from './dto/query-background-run.dto';

const NODE_EXECUTIONS_DEFAULT_LIMIT = 50;
const NODE_EXECUTIONS_MAX_LIMIT = 200;

interface CursorPayload {
  s: string; // ISO8601 startedAt
  i: string; // NodeExecution.id
}

/**
 * Background 본문 실행 모니터링 read-only API 서비스.
 *
 * spec/4-nodes/1-logic/12-background.md §8 의 조회 키 `meta.backgroundRunId`
 * 를 받아 본문 서브그래프의 NodeExecution 들을 cursor 페이지네이션으로 반환한다.
 * 메인 흐름의 격리 컨트랙트(§4)에 영향을 주지 않는 순수 read.
 *
 * 인덱싱: `node_execution.output_data #>> '{meta,backgroundRunId}'` 부분 expression
 * 인덱스 (V047) 가 Background 노드 NodeExecution 단건 조회를 받친다.
 */
@Injectable()
export class BackgroundRunsService {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * WebSocket subscribe 가드용 — `background:run:<id>` 채널 구독 시 호출.
   * `backgroundRunId` 가 식별하는 NodeExecution 의 Execution 이 가입자
   * workspace 에 속하는지 검증한다. 메시지 누수 (channel hijacking) 차단.
   *
   * **executionId 필터 부재 의도**: WS subscribe 시점에 클라이언트는
   * backgroundRunId 만 전달하므로 executionId 를 검증에 포함시키지 않는다.
   * `backgroundRunId` (UUID v4) 의 충돌 확률은 무시 수준이며, NodeExecution
   * → Execution → Workflow → Workspace 체인으로 workspace 단독 검증해도
   * IDOR 차단에 충분하다. REST endpoint (`findBackgroundNodeExecution`) 는
   * executionId 를 추가 필터로 사용해 IDOR 차단을 이중으로 적용한다.
   *
   * boolean 반환 (kb 채널과 동일 시그니처) — 실패 / 조회 실패 모두 false.
   */
  async verifyBackgroundRunOwnership(
    backgroundRunId: string,
    userWorkspaceId: string,
  ): Promise<boolean> {
    if (!backgroundRunId || !userWorkspaceId) return false;
    // 두 단계 join (NodeExecution → Execution → Workflow) 의 workspace_id 만
    // 필요하므로 relation hydration 을 피하고 raw select 로 단일 컬럼만 조회.
    // V047 의 부분 expression 인덱스가 `meta.backgroundRunId` 단건 조회를 받친다.
    const raw = await this.nodeExecutionRepository
      .createQueryBuilder('ne')
      .innerJoin('execution', 'e', 'e.id = ne.execution_id')
      .innerJoin('workflow', 'w', 'w.id = e.workflow_id')
      .where("ne.output_data #>> '{meta,backgroundRunId}' = :backgroundRunId", {
        backgroundRunId,
      })
      .select('w.workspace_id', 'workspaceId')
      .getRawOne<{ workspaceId: string }>();
    return !!raw?.workspaceId && raw.workspaceId === userWorkspaceId;
  }

  async getBackgroundRun(
    executionId: string,
    backgroundRunId: string,
    query: QueryBackgroundRunDto,
    userWorkspaceId: string,
  ): Promise<BackgroundRunResponseDto> {
    const limit = this.resolveLimit(query.limit);
    const cursor = this.decodeCursor(query.cursor);

    await this.verifyExecutionAccess(executionId, userWorkspaceId);

    const backgroundNodeExecution = await this.findBackgroundNodeExecution(
      executionId,
      backgroundRunId,
    );

    const parentNodeExecutionId = backgroundNodeExecution.id;
    const startedAt = this.extractStartedAt(backgroundNodeExecution);

    // W-17: 본문 page · 집계 · 알림 조회는 상호 독립적이므로 병렬화. DB
    // 왕복 5회 → 3회 동시 + 2회 직렬로 단축 (verify + bg node + 병렬 3).
    const [pageRows, aggregate, notifications] = await Promise.all([
      this.fetchBodyPage(parentNodeExecutionId, cursor, limit),
      this.aggregateBodyStatus(parentNodeExecutionId),
      this.fetchNotifications(backgroundRunId),
    ]);
    const { data, nextCursor, hasMore } = this.buildPage(pageRows, limit);

    const status = this.deriveBackgroundRunStatus(aggregate);
    const completedAt = this.deriveCompletedAt(aggregate, status);
    const durationMs =
      completedAt && startedAt
        ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
        : null;

    return {
      backgroundRunId,
      executionId,
      parentNodeExecutionId,
      status,
      startedAt,
      completedAt,
      durationMs,
      nodeExecutions: {
        data,
        nextCursor,
        hasMore,
      },
      notifications,
    };
  }

  private resolveLimit(raw: number | undefined): number {
    const value = raw ?? NODE_EXECUTIONS_DEFAULT_LIMIT;
    if (value < 1 || value > NODE_EXECUTIONS_MAX_LIMIT) {
      throw new BadRequestException({
        code: 'INVALID_LIMIT',
        message: `limit must be between 1 and ${NODE_EXECUTIONS_MAX_LIMIT}`,
      });
    }
    return value;
  }

  private decodeCursor(raw: string | undefined): CursorPayload | null {
    if (!raw) return null;
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded) as CursorPayload;
      if (
        !parsed ||
        typeof parsed.s !== 'string' ||
        typeof parsed.i !== 'string'
      ) {
        throw new Error('cursor missing fields');
      }
      const parsedDate = new Date(parsed.s);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new Error('cursor invalid date');
      }
      return parsed;
    } catch {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'cursor must be a valid opaque token',
      });
    }
  }

  private encodeCursor(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  }

  /**
   * IDOR 차단 + 워크스페이스 검증. ExecutionsService.verifyOwnership 와 동일
   * 의미지만 본 서비스는 별도 모듈에 두기 위해 자체 구현 — 의도적으로
   * NotFound 로 통일해 ID enumeration 방지.
   */
  private async verifyExecutionAccess(
    executionId: string,
    userWorkspaceId: string,
  ): Promise<void> {
    const row = await this.executionRepository
      .createQueryBuilder('e')
      .leftJoin('e.workflow', 'workflow')
      .select(['e.id', 'workflow.workspaceId'])
      .where('e.id = :id', { id: executionId })
      .getOne();
    if (!row || row.workflow?.workspaceId !== userWorkspaceId) {
      throw new NotFoundException({
        code: 'EXECUTION_NOT_FOUND',
        message: 'Execution not found',
      });
    }
  }

  private async findBackgroundNodeExecution(
    executionId: string,
    backgroundRunId: string,
  ): Promise<NodeExecution> {
    // V047 부분 expression 인덱스 (output_data #>> '{meta,backgroundRunId}')
    // 가 본 단건 조회를 받친다. execution_id 필터를 함께 둬 인덱스 매칭 후의
    // row 후처리 비용을 최소화.
    const row = await this.nodeExecutionRepository
      .createQueryBuilder('ne')
      .where('ne.executionId = :executionId', { executionId })
      // 실제 컬럼명 `output_data` 사용 — TypeORM 의 QueryBuilder 는 단순
      // 컬럼 reference (`alias.property`) 에서만 property→column 매핑하고,
      // JSONB `#>>` 같은 raw SQL 표현식 내부는 그대로 전달한다. property 명
      // (`outputData`) 으로 쓰면 운영에서 `column "outputData" does not exist`
      // 로 실패한다 (mock 기반 unit test 가 못 잡는 사각).
      .andWhere(
        "ne.output_data #>> '{meta,backgroundRunId}' = :backgroundRunId",
        { backgroundRunId },
      )
      .getOne();
    if (!row) {
      throw new NotFoundException({
        code: 'BACKGROUND_RUN_NOT_FOUND',
        message: 'Background run not found in this execution',
      });
    }
    return row;
  }

  private extractStartedAt(backgroundNodeExecution: NodeExecution): string {
    const meta = (backgroundNodeExecution.outputData?.['meta'] ?? {}) as {
      forkedAt?: string;
    };
    if (typeof meta.forkedAt === 'string') return meta.forkedAt;
    // fallback — handler 가 forkedAt 을 발급하기 전 (옛 row) 호환.
    return this.toIso(backgroundNodeExecution.startedAt);
  }

  private async fetchBodyPage(
    parentNodeExecutionId: string,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<NodeExecution[]> {
    const qb = this.nodeExecutionRepository
      .createQueryBuilder('ne')
      .where('ne.parentNodeExecutionId = :parentNodeExecutionId', {
        parentNodeExecutionId,
      });
    if (cursor) {
      qb.andWhere(
        '(ne.startedAt > :lastStartedAt OR (ne.startedAt = :lastStartedAt AND ne.id > :lastId))',
        {
          lastStartedAt: new Date(cursor.s),
          lastId: cursor.i,
        },
      );
    }
    qb.orderBy('ne.startedAt', 'ASC')
      .addOrderBy('ne.id', 'ASC')
      .take(limit + 1);
    return qb.getMany();
  }

  private buildPage(
    rows: NodeExecution[],
    limit: number,
  ): {
    data: BackgroundRunNodeExecutionDto[];
    nextCursor: string | null;
    hasMore: boolean;
  } {
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const data = slice.map((row) => this.toNodeExecutionDto(row));
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? this.encodeCursor({
            s: this.toIso(last.startedAt),
            i: last.id,
          })
        : null;
    return { data, nextCursor, hasMore };
  }

  private toNodeExecutionDto(
    row: NodeExecution,
  ): BackgroundRunNodeExecutionDto {
    return {
      id: row.id,
      executionId: row.executionId,
      nodeId: row.nodeId,
      parentNodeExecutionId: row.parentNodeExecutionId ?? '',
      status: row.status,
      startedAt: this.toIso(row.startedAt),
      finishedAt: row.finishedAt ? this.toIso(row.finishedAt) : null,
      durationMs: row.durationMs ?? null,
      inputData: row.inputData ?? null,
      outputData: row.outputData ?? null,
      error: row.error ?? null,
    };
  }

  private async aggregateBodyStatus(parentNodeExecutionId: string): Promise<{
    totalCount: number;
    pendingCount: number;
    runningCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    waitingCount: number;
    latestFinishedAt: Date | null;
  }> {
    // 본문 노드 수가 많아도 단일 집계 쿼리로 처리 — 페이지네이션과 분리.
    // W-14: SQL 내 상태 값을 enum 으로 참조해 NodeExecutionStatus 변경 시
    // 컴파일 시점에 감지될 수 있게 한다.
    const raw = await this.nodeExecutionRepository
      .createQueryBuilder('ne')
      .select([
        'COUNT(*) AS total',
        `SUM(CASE WHEN ne.status = :pendingStatus THEN 1 ELSE 0 END) AS pending`,
        `SUM(CASE WHEN ne.status = :runningStatus THEN 1 ELSE 0 END) AS running`,
        `SUM(CASE WHEN ne.status = :completedStatus THEN 1 ELSE 0 END) AS completed`,
        `SUM(CASE WHEN ne.status = :failedStatus THEN 1 ELSE 0 END) AS failed`,
        `SUM(CASE WHEN ne.status = :skippedStatus THEN 1 ELSE 0 END) AS skipped`,
        `SUM(CASE WHEN ne.status = :waitingStatus THEN 1 ELSE 0 END) AS waiting`,
        'MAX(ne.finishedAt) AS latestFinished',
      ])
      .where('ne.parentNodeExecutionId = :parentNodeExecutionId', {
        parentNodeExecutionId,
      })
      .setParameters({
        pendingStatus: NodeExecutionStatus.PENDING,
        runningStatus: NodeExecutionStatus.RUNNING,
        completedStatus: NodeExecutionStatus.COMPLETED,
        failedStatus: NodeExecutionStatus.FAILED,
        skippedStatus: NodeExecutionStatus.SKIPPED,
        waitingStatus: NodeExecutionStatus.WAITING_FOR_INPUT,
      })
      .getRawOne<{
        total: string | null;
        pending: string | null;
        running: string | null;
        completed: string | null;
        failed: string | null;
        skipped: string | null;
        waiting: string | null;
        latestFinished: Date | null;
      }>();
    return {
      totalCount: Number(raw?.total ?? 0),
      pendingCount: Number(raw?.pending ?? 0),
      runningCount: Number(raw?.running ?? 0),
      completedCount: Number(raw?.completed ?? 0),
      failedCount: Number(raw?.failed ?? 0),
      skippedCount: Number(raw?.skipped ?? 0),
      waitingCount: Number(raw?.waiting ?? 0),
      latestFinishedAt: raw?.latestFinished ?? null,
    };
  }

  private deriveBackgroundRunStatus(aggregate: {
    totalCount: number;
    pendingCount: number;
    runningCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    waitingCount: number;
  }): BackgroundRunStatus {
    if (aggregate.totalCount === 0) return 'pending';
    if (aggregate.failedCount > 0) return 'failed';
    if (aggregate.runningCount > 0 || aggregate.waitingCount > 0) {
      return 'running';
    }
    const terminalReached =
      aggregate.completedCount + aggregate.skippedCount + aggregate.failedCount;
    if (
      aggregate.pendingCount === 0 &&
      terminalReached === aggregate.totalCount
    ) {
      return 'completed';
    }
    return 'running';
  }

  private deriveCompletedAt(
    aggregate: { latestFinishedAt: Date | null },
    status: BackgroundRunStatus,
  ): string | null {
    if (status === 'running' || status === 'pending') return null;
    return aggregate.latestFinishedAt
      ? this.toIso(aggregate.latestFinishedAt)
      : null;
  }

  private async fetchNotifications(
    backgroundRunId: string,
  ): Promise<BackgroundRunNotificationDto[]> {
    // resourceType='background_run' 으로 정확 attribution. processor 변경으로
    // 새 알림은 모두 이 형태 — 옛 (resource_type='execution') 알림은 본 API
    // 의 범위 밖. 알림 비즈니스 규칙(정렬 등) 은 NotificationsService 에
    // 위임 (Repository 이중 등록 회피).
    const rows = await this.notificationsService.findByResource(
      'background_run',
      backgroundRunId,
    );
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      channel: row.channel,
      createdAt: this.toIso(row.createdAt),
    }));
  }

  private toIso(d: Date | string): string {
    return d instanceof Date ? d.toISOString() : d;
  }
}

// Re-export for test convenience.
export { NodeExecutionStatus };

```

---

### 파일 4: backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.spec.ts b/backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.spec.ts
new file mode 100644
index 00000000..ac107157
--- /dev/null
+++ b/backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.spec.ts
@@ -0,0 +1,259 @@
+import type { Job, Queue } from 'bullmq';
+
+import {
+  formatSummaryLine,
+  parseCleanupArgs,
+  sweepInvalidJobs,
+  type CleanupSummary,
+} from './cleanup-invalid-jobs.util';
+
+type FakeJob = Pick<Job, 'id' | 'name' | 'timestamp' | 'attemptsMade'> & {
+  data: { documentId?: unknown } & Record<string, unknown>;
+  remove: jest.Mock;
+};
+
+function makeJob(
+  id: string,
+  documentId: unknown,
+  extra: Record<string, unknown> = {},
+): FakeJob {
+  return {
+    id,
+    name: `job-${id}`,
+    timestamp: 1700000000000,
+    attemptsMade: 0,
+    data: { documentId, ...extra },
+    remove: jest.fn().mockResolvedValue(undefined),
+  };
+}
+
+interface FakeQueue {
+  getJobs: jest.Mock;
+  pause: jest.Mock;
+  resume: jest.Mock;
+}
+
+function makeQueue(pages: FakeJob[][]): FakeQueue {
+  const getJobs = jest.fn();
+  pages.forEach((p) => getJobs.mockResolvedValueOnce(p));
+  getJobs.mockResolvedValue([]); // any further calls
+  return {
+    getJobs,
+    pause: jest.fn().mockResolvedValue(undefined),
+    resume: jest.fn().mockResolvedValue(undefined),
+  };
+}
+
+describe('parseCleanupArgs', () => {
+  it('default: apply/pauseDuringSweep both false', () => {
+    expect(parseCleanupArgs([])).toEqual({
+      apply: false,
+      pauseDuringSweep: false,
+    });
+  });
+
+  it('--apply only', () => {
+    expect(parseCleanupArgs(['--apply'])).toEqual({
+      apply: true,
+      pauseDuringSweep: false,
+    });
+  });
+
+  it('--pause-during-sweep only', () => {
+    expect(parseCleanupArgs(['--pause-during-sweep'])).toEqual({
+      apply: false,
+      pauseDuringSweep: true,
+    });
+  });
+
+  it('both flags', () => {
+    expect(parseCleanupArgs(['--apply', '--pause-during-sweep'])).toEqual({
+      apply: true,
+      pauseDuringSweep: true,
+    });
+  });
+
+  it('unknown flags are ignored (npm/node forwards)', () => {
+    expect(parseCleanupArgs(['--apply', '--', '/some/path', 'foo'])).toEqual({
+      apply: true,
+      pauseDuringSweep: false,
+    });
+  });
+});
+
+describe('formatSummaryLine', () => {
+  it('serializes per-queue record as single JSON line', () => {
+    const rec: CleanupSummary = {
+      queue: 'document-embedding',
+      invalid: 3,
+      removed: 3,
+      applied: true,
+    };
+    const line = formatSummaryLine(rec);
+    expect(line).toBe(
+      '{"queue":"document-embedding","invalid":3,"removed":3,"applied":true}',
+    );
+    expect(line.includes('\n')).toBe(false);
+  });
+
+  it('serializes total record', () => {
+    const line = formatSummaryLine({
+      total: true,
+      invalid: 5,
+      removed: 0,
+      applied: false,
+    });
+    expect(line).toBe('{"total":true,"invalid":5,"removed":0,"applied":false}');
+  });
+});
+
+describe('sweepInvalidJobs', () => {
+  it('dry-run: counts invalid but never calls remove() or pause()', async () => {
+    const invalid = makeJob('1', undefined);
+    const valid = makeJob('2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
+    const queue = makeQueue([[invalid, valid]]);
+
+    const summary = await sweepInvalidJobs({
+      name: 'document-embedding',
+      queue: queue as unknown as Queue,
+      apply: false,
+      pauseDuringSweep: false,
+    });
+
+    expect(summary).toEqual({
+      queue: 'document-embedding',
+      invalid: 1,
+      removed: 0,
+      applied: false,
+    });
+    expect(invalid.remove).not.toHaveBeenCalled();
+    expect(valid.remove).not.toHaveBeenCalled();
+    expect(queue.pause).not.toHaveBeenCalled();
+    expect(queue.resume).not.toHaveBeenCalled();
+  });
+
+  it('apply: removes invalid jobs only', async () => {
+    const invalidA = makeJob('1', '');
+    const invalidB = makeJob('2', '   ');
+    const validA = makeJob('3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
+    const queue = makeQueue([[invalidA, invalidB, validA]]);
+
+    const summary = await sweepInvalidJobs({
+      name: 'document-embedding',
+      queue: queue as unknown as Queue,
+      apply: true,
+      pauseDuringSweep: false,
+    });
+
+    expect(summary.invalid).toBe(2);
+    expect(summary.removed).toBe(2);
+    expect(summary.applied).toBe(true);
+    expect(invalidA.remove).toHaveBeenCalledTimes(1);
+    expect(invalidB.remove).toHaveBeenCalledTimes(1);
+    expect(validA.remove).not.toHaveBeenCalled();
+  });
+
+  it('treats non-string documentId as invalid', async () => {
+    const numId = makeJob('1', 42 as unknown);
+    const nullId = makeJob('2', null);
+    const queue = makeQueue([[numId, nullId]]);
+
+    const summary = await sweepInvalidJobs({
+      name: 'graph-extraction',
+      queue: queue as unknown as Queue,
+      apply: false,
+      pauseDuringSweep: false,
+    });
+
+    expect(summary.invalid).toBe(2);
+  });
+
+  it('pauseDuringSweep=true: pauses before sweep, resumes after', async () => {
+    const callOrder: string[] = [];
+    const queue: FakeQueue = {
+      pause: jest.fn(() => {
+        callOrder.push('pause');
+        return Promise.resolve();
+      }),
+      getJobs: jest.fn(() => {
+        callOrder.push('getJobs');
+        return Promise.resolve([] as FakeJob[]);
+      }),
+      resume: jest.fn(() => {
+        callOrder.push('resume');
+        return Promise.resolve();
+      }),
+    };
+
+    await sweepInvalidJobs({
+      name: 'document-embedding',
+      queue: queue as unknown as Queue,
+      apply: false,
+      pauseDuringSweep: true,
+    });
+
+    expect(callOrder[0]).toBe('pause');
+    expect(callOrder[callOrder.length - 1]).toBe('resume');
+    expect(callOrder).toContain('getJobs');
+  });
+
+  it('pauseDuringSweep=true: resumes even when sweep throws', async () => {
+    const queue: FakeQueue = {
+      getJobs: jest.fn().mockRejectedValue(new Error('redis down')),
+      pause: jest.fn().mockResolvedValue(undefined),
+      resume: jest.fn().mockResolvedValue(undefined),
+    };
+
+    await expect(
+      sweepInvalidJobs({
+        name: 'document-embedding',
+        queue: queue as unknown as Queue,
+        apply: false,
+        pauseDuringSweep: true,
+      }),
+    ).rejects.toThrow('redis down');
+
+    expect(queue.pause).toHaveBeenCalledTimes(1);
+    expect(queue.resume).toHaveBeenCalledTimes(1);
+  });
+
+  it('paginates: keeps scanning while page is full', async () => {
+    const PAGE_SIZE = 1000;
+    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) =>
+      makeJob(
+        `p1-${i}`,
+        i % 2 === 0 ? '' : 'cccccccc-cccc-cccc-cccc-cccccccccccc',
+      ),
+    );
+    const page2 = [makeJob('p2-0', undefined)];
+    const queue = makeQueue([page1, page2]);
+
+    const summary = await sweepInvalidJobs({
+      name: 'document-embedding',
+      queue: queue as unknown as Queue,
+      apply: false,
+      pauseDuringSweep: false,
+    });
+
+    expect(queue.getJobs).toHaveBeenCalledTimes(2);
+    expect(summary.invalid).toBe(PAGE_SIZE / 2 + 1);
+  });
+
+  it('continues counting when individual remove() fails', async () => {
+    const a = makeJob('1', undefined);
+    a.remove = jest.fn().mockRejectedValue(new Error('boom'));
+    const b = makeJob('2', null);
+    const queue = makeQueue([[a, b]]);
+
+    const summary = await sweepInvalidJobs({
+      name: 'document-embedding',
+      queue: queue as unknown as Queue,
+      apply: true,
+      pauseDuringSweep: false,
+    });
+
+    // Both detected; only one successfully removed.
+    expect(summary.invalid).toBe(2);
+    expect(summary.removed).toBe(1);
+  });
+});

```

#### 전체 파일 컨텍스트
```
import type { Job, Queue } from 'bullmq';

import {
  formatSummaryLine,
  parseCleanupArgs,
  sweepInvalidJobs,
  type CleanupSummary,
} from './cleanup-invalid-jobs.util';

type FakeJob = Pick<Job, 'id' | 'name' | 'timestamp' | 'attemptsMade'> & {
  data: { documentId?: unknown } & Record<string, unknown>;
  remove: jest.Mock;
};

function makeJob(
  id: string,
  documentId: unknown,
  extra: Record<string, unknown> = {},
): FakeJob {
  return {
    id,
    name: `job-${id}`,
    timestamp: 1700000000000,
    attemptsMade: 0,
    data: { documentId, ...extra },
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

interface FakeQueue {
  getJobs: jest.Mock;
  pause: jest.Mock;
  resume: jest.Mock;
}

function makeQueue(pages: FakeJob[][]): FakeQueue {
  const getJobs = jest.fn();
  pages.forEach((p) => getJobs.mockResolvedValueOnce(p));
  getJobs.mockResolvedValue([]); // any further calls
  return {
    getJobs,
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
  };
}

describe('parseCleanupArgs', () => {
  it('default: apply/pauseDuringSweep both false', () => {
    expect(parseCleanupArgs([])).toEqual({
      apply: false,
      pauseDuringSweep: false,
    });
  });

  it('--apply only', () => {
    expect(parseCleanupArgs(['--apply'])).toEqual({
      apply: true,
      pauseDuringSweep: false,
    });
  });

  it('--pause-during-sweep only', () => {
    expect(parseCleanupArgs(['--pause-during-sweep'])).toEqual({
      apply: false,
      pauseDuringSweep: true,
    });
  });

  it('both flags', () => {
    expect(parseCleanupArgs(['--apply', '--pause-during-sweep'])).toEqual({
      apply: true,
      pauseDuringSweep: true,
    });
  });

  it('unknown flags are ignored (npm/node forwards)', () => {
    expect(parseCleanupArgs(['--apply', '--', '/some/path', 'foo'])).toEqual({
      apply: true,
      pauseDuringSweep: false,
    });
  });
});

describe('formatSummaryLine', () => {
  it('serializes per-queue record as single JSON line', () => {
    const rec: CleanupSummary = {
      queue: 'document-embedding',
      invalid: 3,
      removed: 3,
      applied: true,
    };
    const line = formatSummaryLine(rec);
    expect(line).toBe(
      '{"queue":"document-embedding","invalid":3,"removed":3,"applied":true}',
    );
    expect(line.includes('\n')).toBe(false);
  });

  it('serializes total record', () => {
    const line = formatSummaryLine({
      total: true,
      invalid: 5,
      removed: 0,
      applied: false,
    });
    expect(line).toBe('{"total":true,"invalid":5,"removed":0,"applied":false}');
  });
});

describe('sweepInvalidJobs', () => {
  it('dry-run: counts invalid but never calls remove() or pause()', async () => {
    const invalid = makeJob('1', undefined);
    const valid = makeJob('2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const queue = makeQueue([[invalid, valid]]);

    const summary = await sweepInvalidJobs({
      name: 'document-embedding',
      queue: queue as unknown as Queue,
      apply: false,
      pauseDuringSweep: false,
    });

    expect(summary).toEqual({
      queue: 'document-embedding',
      invalid: 1,
      removed: 0,
      applied: false,
    });
    expect(invalid.remove).not.toHaveBeenCalled();
    expect(valid.remove).not.toHaveBeenCalled();
    expect(queue.pause).not.toHaveBeenCalled();
    expect(queue.resume).not.toHaveBeenCalled();
  });

  it('apply: removes invalid jobs only', async () => {
    const invalidA = makeJob('1', '');
    const invalidB = makeJob('2', '   ');
    const validA = makeJob('3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const queue = makeQueue([[invalidA, invalidB, validA]]);

    const summary = await sweepInvalidJobs({
      name: 'document-embedding',
      queue: queue as unknown as Queue,
      apply: true,
      pauseDuringSweep: false,
    });

    expect(summary.invalid).toBe(2);
    expect(summary.removed).toBe(2);
    expect(summary.applied).toBe(true);
    expect(invalidA.remove).toHaveBeenCalledTimes(1);
    expect(invalidB.remove).toHaveBeenCalledTimes(1);
    expect(validA.remove).not.toHaveBeenCalled();
  });

  it('treats non-string documentId as invalid', async () => {
    const numId = makeJob('1', 42 as unknown);
    const nullId = makeJob('2', null);
    const queue = makeQueue([[numId, nullId]]);

    const summary = await sweepInvalidJobs({
      name: 'graph-extraction',
      queue: queue as unknown as Queue,
      apply: false,
      pauseDuringSweep: false,
    });

    expect(summary.invalid).toBe(2);
  });

  it('pauseDuringSweep=true: pauses before sweep, resumes after', async () => {
    const callOrder: string[] = [];
    const queue: FakeQueue = {
      pause: jest.fn(() => {
        callOrder.push('pause');
        return Promise.resolve();
      }),
      getJobs: jest.fn(() => {
        callOrder.push('getJobs');
        return Promise.resolve([] as FakeJob[]);
      }),
      resume: jest.fn(() => {
        callOrder.push('resume');
        return Promise.resolve();
      }),
    };

    await sweepInvalidJobs({
      name: 'document-embedding',
      queue: queue as unknown as Queue,
      apply: false,
      pauseDuringSweep: true,
    });

    expect(callOrder[0]).toBe('pause');
    expect(callOrder[callOrder.length - 1]).toBe('resume');
    expect(callOrder).toContain('getJobs');
  });

  it('pauseDuringSweep=true: resumes even when sweep throws', async () => {
    const queue: FakeQueue = {
      getJobs: jest.fn().mockRejectedValue(new Error('redis down')),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
    };

    await expect(
      sweepInvalidJobs({
        name: 'document-embedding',
        queue: queue as unknown as Queue,
        apply: false,
        pauseDuringSweep: true,
      }),
    ).rejects.toThrow('redis down');

    expect(queue.pause).toHaveBeenCalledTimes(1);
    expect(queue.resume).toHaveBeenCalledTimes(1);
  });

  it('paginates: keeps scanning while page is full', async () => {
    const PAGE_SIZE = 1000;
    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeJob(
        `p1-${i}`,
        i % 2 === 0 ? '' : 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      ),
    );
    const page2 = [makeJob('p2-0', undefined)];
    const queue = makeQueue([page1, page2]);

    const summary = await sweepInvalidJobs({
      name: 'document-embedding',
      queue: queue as unknown as Queue,
      apply: false,
      pauseDuringSweep: false,
    });

    expect(queue.getJobs).toHaveBeenCalledTimes(2);
    expect(summary.invalid).toBe(PAGE_SIZE / 2 + 1);
  });

  it('continues counting when individual remove() fails', async () => {
    const a = makeJob('1', undefined);
    a.remove = jest.fn().mockRejectedValue(new Error('boom'));
    const b = makeJob('2', null);
    const queue = makeQueue([[a, b]]);

    const summary = await sweepInvalidJobs({
      name: 'document-embedding',
      queue: queue as unknown as Queue,
      apply: true,
      pauseDuringSweep: false,
    });

    // Both detected; only one successfully removed.
    expect(summary.invalid).toBe(2);
    expect(summary.removed).toBe(1);
  });
});

```

---

### 파일 5: backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts b/backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts
new file mode 100644
index 00000000..810b660c
--- /dev/null
+++ b/backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts
@@ -0,0 +1,139 @@
+import type { Job, Queue } from 'bullmq';
+
+import { isValidDocumentId } from './job-payload.util';
+
+type InvalidJobCandidate = Job<
+  { documentId?: unknown } & Record<string, unknown>
+>;
+
+export const CLEANUP_QUEUE_STATES = [
+  'waiting',
+  'delayed',
+  'failed',
+  'paused',
+] as const;
+
+export const CLEANUP_PAGE_SIZE = 1000;
+
+export interface CleanupArgs {
+  apply: boolean;
+  pauseDuringSweep: boolean;
+}
+
+export interface SweepOptions {
+  name: string;
+  queue: Queue;
+  apply: boolean;
+  pauseDuringSweep: boolean;
+  logger?: CleanupLogger;
+}
+
+export interface CleanupLogger {
+  log: (line: string) => void;
+  warn: (line: string) => void;
+}
+
+export type CleanupSummary =
+  | {
+      queue: string;
+      invalid: number;
+      removed: number;
+      applied: boolean;
+    }
+  | {
+      total: true;
+      invalid: number;
+      removed: number;
+      applied: boolean;
+    };
+
+const SILENT_LOGGER: CleanupLogger = { log: () => {}, warn: () => {} };
+
+export function parseCleanupArgs(argv: readonly string[]): CleanupArgs {
+  return {
+    apply: argv.includes('--apply'),
+    pauseDuringSweep: argv.includes('--pause-during-sweep'),
+  };
+}
+
+export function formatSummaryLine(record: CleanupSummary): string {
+  return JSON.stringify(record);
+}
+
+export async function sweepInvalidJobs(
+  options: SweepOptions,
+): Promise<CleanupSummary> {
+  const { name, queue, apply, pauseDuringSweep } = options;
+  const logger = options.logger ?? SILENT_LOGGER;
+
+  if (pauseDuringSweep) {
+    await queue.pause();
+  }
+  try {
+    return await runSweep(name, queue, apply, logger);
+  } finally {
+    if (pauseDuringSweep) {
+      await queue.resume();
+    }
+  }
+}
+
+async function runSweep(
+  name: string,
+  queue: Queue,
+  apply: boolean,
+  logger: CleanupLogger,
+): Promise<CleanupSummary> {
+  logger.log(`[${name}] scanning states=${CLEANUP_QUEUE_STATES.join(',')}`);
+
+  let invalidTotal = 0;
+  let removedTotal = 0;
+  let start = 0;
+  while (true) {
+    const page = (await queue.getJobs(
+      [...CLEANUP_QUEUE_STATES],
+      start,
+      start + CLEANUP_PAGE_SIZE - 1,
+    )) as InvalidJobCandidate[];
+    if (page.length === 0) break;
+
+    const invalidPage = page.filter(
+      (j) => !isValidDocumentId(j.data?.documentId),
+    );
+    for (const job of invalidPage) {
+      const keys = Object.keys(job.data ?? {}).join(',');
+      logger.log(
+        `  jobId=${job.id} name=${job.name} ts=${job.timestamp} attempts=${job.attemptsMade} payloadKeys=[${keys}]`,
+      );
+    }
+    invalidTotal += invalidPage.length;
+
+    if (apply && invalidPage.length > 0) {
+      const results = await Promise.all(
+        invalidPage.map((j) =>
+          j
+            .remove()
+            .then(() => true)
+            .catch((err: unknown) => {
+              const msg = err instanceof Error ? err.message : String(err);
+              logger.warn(`    remove failed for jobId=${j.id}: ${msg}`);
+              return false;
+            }),
+        ),
+      );
+      removedTotal += results.filter(Boolean).length;
+    }
+
+    if (page.length < CLEANUP_PAGE_SIZE) break;
+    start += CLEANUP_PAGE_SIZE;
+  }
+
+  logger.log(`[${name}] invalid=${invalidTotal} removed=${removedTotal}`);
+
+  return {
+    queue: name,
+    invalid: invalidTotal,
+    removed: removedTotal,
+    applied: apply,
+  };
+}

```

#### 전체 파일 컨텍스트
```
import type { Job, Queue } from 'bullmq';

import { isValidDocumentId } from './job-payload.util';

type InvalidJobCandidate = Job<
  { documentId?: unknown } & Record<string, unknown>
>;

export const CLEANUP_QUEUE_STATES = [
  'waiting',
  'delayed',
  'failed',
  'paused',
] as const;

export const CLEANUP_PAGE_SIZE = 1000;

export interface CleanupArgs {
  apply: boolean;
  pauseDuringSweep: boolean;
}

export interface SweepOptions {
  name: string;
  queue: Queue;
  apply: boolean;
  pauseDuringSweep: boolean;
  logger?: CleanupLogger;
}

export interface CleanupLogger {
  log: (line: string) => void;
  warn: (line: string) => void;
}

export type CleanupSummary =
  | {
      queue: string;
      invalid: number;
      removed: number;
      applied: boolean;
    }
  | {
      total: true;
      invalid: number;
      removed: number;
      applied: boolean;
    };

const SILENT_LOGGER: CleanupLogger = { log: () => {}, warn: () => {} };

export function parseCleanupArgs(argv: readonly string[]): CleanupArgs {
  return {
    apply: argv.includes('--apply'),
    pauseDuringSweep: argv.includes('--pause-during-sweep'),
  };
}

export function formatSummaryLine(record: CleanupSummary): string {
  return JSON.stringify(record);
}

export async function sweepInvalidJobs(
  options: SweepOptions,
): Promise<CleanupSummary> {
  const { name, queue, apply, pauseDuringSweep } = options;
  const logger = options.logger ?? SILENT_LOGGER;

  if (pauseDuringSweep) {
    await queue.pause();
  }
  try {
    return await runSweep(name, queue, apply, logger);
  } finally {
    if (pauseDuringSweep) {
      await queue.resume();
    }
  }
}

async function runSweep(
  name: string,
  queue: Queue,
  apply: boolean,
  logger: CleanupLogger,
): Promise<CleanupSummary> {
  logger.log(`[${name}] scanning states=${CLEANUP_QUEUE_STATES.join(',')}`);

  let invalidTotal = 0;
  let removedTotal = 0;
  let start = 0;
  while (true) {
    const page = (await queue.getJobs(
      [...CLEANUP_QUEUE_STATES],
      start,
      start + CLEANUP_PAGE_SIZE - 1,
    )) as InvalidJobCandidate[];
    if (page.length === 0) break;

    const invalidPage = page.filter(
      (j) => !isValidDocumentId(j.data?.documentId),
    );
    for (const job of invalidPage) {
      const keys = Object.keys(job.data ?? {}).join(',');
      logger.log(
        `  jobId=${job.id} name=${job.name} ts=${job.timestamp} attempts=${job.attemptsMade} payloadKeys=[${keys}]`,
      );
    }
    invalidTotal += invalidPage.length;

    if (apply && invalidPage.length > 0) {
      const results = await Promise.all(
        invalidPage.map((j) =>
          j
            .remove()
            .then(() => true)
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`    remove failed for jobId=${j.id}: ${msg}`);
              return false;
            }),
        ),
      );
      removedTotal += results.filter(Boolean).length;
    }

    if (page.length < CLEANUP_PAGE_SIZE) break;
    start += CLEANUP_PAGE_SIZE;
  }

  logger.log(`[${name}] invalid=${invalidTotal} removed=${removedTotal}`);

  return {
    queue: name,
    invalid: invalidTotal,
    removed: removedTotal,
    applied: apply,
  };
}

```

---

### 파일 6: backend/src/scripts/cleanup-invalid-queue-jobs.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/scripts/cleanup-invalid-queue-jobs.ts b/backend/src/scripts/cleanup-invalid-queue-jobs.ts
new file mode 100644
index 00000000..877853f4
--- /dev/null
+++ b/backend/src/scripts/cleanup-invalid-queue-jobs.ts
@@ -0,0 +1,112 @@
+/**
+ * BullMQ 큐 손상 job 정리 스크립트 (운영 + 개발 공용).
+ *
+ * `documentId` 가 비어있는(undefined/null/'' /공백/non-string) job 만 찾아낸다.
+ * - 정상 흐름의 producer 는 항상 DB UUID 를 채워 enqueue 하므로 false-positive 없음
+ * - Redis 에 누적된 손상/레거시 job 또는 `InvalidJobPayloadError` 가드로 `failed`
+ *   상태로 보존된 잔재를 청소
+ *
+ * 본 스크립트는 NestJS AppModule 을 부팅하지 않고 BullMQ Queue 만 직접 생성하므로
+ * `@Processor` 워커가 활성화되지 않는다. DB 자격증명도 메모리에 로드되지 않는다.
+ *
+ * 사용 (개발 환경, ts-node 가 devDependencies 에 있을 때):
+ *
+ *   # dry-run — 출력만, 삭제 없음
+ *   npx ts-node backend/src/scripts/cleanup-invalid-queue-jobs.ts
+ *
+ *   # apply — 손상 job 만 remove()
+ *   npx ts-node backend/src/scripts/cleanup-invalid-queue-jobs.ts --apply
+ *
+ *   # apply + sweep 동안 큐 자동 pause (TOCTOU 방지)
+ *   npx ts-node backend/src/scripts/cleanup-invalid-queue-jobs.ts --apply --pause-during-sweep
+ *
+ * 사용 (운영 환경, 컴파일된 dist 산출물 사용):
+ *
+ *   # 권장: 컨테이너 안에서 npm script 호출
+ *   docker compose exec backend npm run cleanup:queue-jobs -- --apply --pause-during-sweep
+ *
+ *   # 또는 dist 직접
+ *   node backend/dist/scripts/cleanup-invalid-queue-jobs.js --apply --pause-during-sweep
+ *
+ * 운영 절차:
+ *   1) `--pause-during-sweep` 사용 시 스크립트가 sweep 직전 `queue.pause()`,
+ *      종료 시 `queue.resume()` 을 자동 수행해 TOCTOU 를 차단한다. 워커 인스턴스
+ *      자체를 별도로 stop 할 필요 없음.
+ *   2) 옵션 없이 dry-run → 출력 검토 (jobId / name / timestamp / payloadKeys)
+ *   3) --apply 로 정리
+ *
+ * 마지막 줄에는 grep 친화적인 JSON summary 가 큐별 + 합계로 출력된다 (한 줄씩).
+ * 예: `{"queue":"document-embedding","invalid":3,"removed":3,"applied":true}`
+ *
+ * 본 스크립트는 회귀 재발 대비로 보존한다 — 운영자가 동일 증상을 마주칠 때 재실행 가능.
+ */
+import * as path from 'path';
+import * as dotenv from 'dotenv';
+import { Queue } from 'bullmq';
+
+{
+  const envPath = path.resolve(__dirname, '..', '..', '.env');
+  const result = dotenv.config({ path: envPath });
+  if (result.error && require.main === module) {
+    console.warn(`[cleanup-invalid-queue-jobs] no .env at ${envPath}`);
+  }
+}
+
+import { DOCUMENT_EMBEDDING_QUEUE } from '../modules/knowledge-base/queues/document-embedding.queue';
+import { GRAPH_EXTRACTION_QUEUE } from '../modules/knowledge-base/queues/graph-extraction.queue';
+import {
+  formatSummaryLine,
+  parseCleanupArgs,
+  sweepInvalidJobs,
+  type CleanupSummary,
+} from '../modules/knowledge-base/queues/cleanup-invalid-jobs.util';
+
+function createQueue(name: string): Queue {
+  const host = process.env.REDIS_HOST ?? 'localhost';
+  const port = Number(process.env.REDIS_PORT ?? 6379);
+  return new Queue(name, { connection: { host, port } });
+}
+
+async function main(): Promise<void> {
+  const { apply, pauseDuringSweep } = parseCleanupArgs(process.argv.slice(2));
+  const queues = [DOCUMENT_EMBEDDING_QUEUE, GRAPH_EXTRACTION_QUEUE].map(
+    (name) => ({ name, queue: createQueue(name) }),
+  );
+
+  const summaries: CleanupSummary[] = [];
+  try {
+    for (const { name, queue } of queues) {
+      const summary = await sweepInvalidJobs({
+        name,
+        queue,
+        apply,
+        pauseDuringSweep,
+        logger: { log: console.log, warn: console.warn },
+      });
+      summaries.push(summary);
+    }
+  } finally {
+    await Promise.all(queues.map(({ queue }) => queue.close()));
+  }
+
+  let totalInvalid = 0;
+  let totalRemoved = 0;
+  for (const s of summaries) {
+    console.log(formatSummaryLine(s));
+    totalInvalid += s.invalid;
+    totalRemoved += s.removed;
+  }
+  console.log(
+    formatSummaryLine({
+      total: true,
+      invalid: totalInvalid,
+      removed: totalRemoved,
+      applied: apply,
+    }),
+  );
+}
+
+main().catch((err) => {
+  console.error(err);
+  process.exit(1);
+});

```

#### 전체 파일 컨텍스트
```
/**
 * BullMQ 큐 손상 job 정리 스크립트 (운영 + 개발 공용).
 *
 * `documentId` 가 비어있는(undefined/null/'' /공백/non-string) job 만 찾아낸다.
 * - 정상 흐름의 producer 는 항상 DB UUID 를 채워 enqueue 하므로 false-positive 없음
 * - Redis 에 누적된 손상/레거시 job 또는 `InvalidJobPayloadError` 가드로 `failed`
 *   상태로 보존된 잔재를 청소
 *
 * 본 스크립트는 NestJS AppModule 을 부팅하지 않고 BullMQ Queue 만 직접 생성하므로
 * `@Processor` 워커가 활성화되지 않는다. DB 자격증명도 메모리에 로드되지 않는다.
 *
 * 사용 (개발 환경, ts-node 가 devDependencies 에 있을 때):
 *
 *   # dry-run — 출력만, 삭제 없음
 *   npx ts-node backend/src/scripts/cleanup-invalid-queue-jobs.ts
 *
 *   # apply — 손상 job 만 remove()
 *   npx ts-node backend/src/scripts/cleanup-invalid-queue-jobs.ts --apply
 *
 *   # apply + sweep 동안 큐 자동 pause (TOCTOU 방지)
 *   npx ts-node backend/src/scripts/cleanup-invalid-queue-jobs.ts --apply --pause-during-sweep
 *
 * 사용 (운영 환경, 컴파일된 dist 산출물 사용):
 *
 *   # 권장: 컨테이너 안에서 npm script 호출
 *   docker compose exec backend npm run cleanup:queue-jobs -- --apply --pause-during-sweep
 *
 *   # 또는 dist 직접
 *   node backend/dist/scripts/cleanup-invalid-queue-jobs.js --apply --pause-during-sweep
 *
 * 운영 절차:
 *   1) `--pause-during-sweep` 사용 시 스크립트가 sweep 직전 `queue.pause()`,
 *      종료 시 `queue.resume()` 을 자동 수행해 TOCTOU 를 차단한다. 워커 인스턴스
 *      자체를 별도로 stop 할 필요 없음.
 *   2) 옵션 없이 dry-run → 출력 검토 (jobId / name / timestamp / payloadKeys)
 *   3) --apply 로 정리
 *
 * 마지막 줄에는 grep 친화적인 JSON summary 가 큐별 + 합계로 출력된다 (한 줄씩).
 * 예: `{"queue":"document-embedding","invalid":3,"removed":3,"applied":true}`
 *
 * 본 스크립트는 회귀 재발 대비로 보존한다 — 운영자가 동일 증상을 마주칠 때 재실행 가능.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Queue } from 'bullmq';

{
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const result = dotenv.config({ path: envPath });
  if (result.error && require.main === module) {
    console.warn(`[cleanup-invalid-queue-jobs] no .env at ${envPath}`);
  }
}

import { DOCUMENT_EMBEDDING_QUEUE } from '../modules/knowledge-base/queues/document-embedding.queue';
import { GRAPH_EXTRACTION_QUEUE } from '../modules/knowledge-base/queues/graph-extraction.queue';
import {
  formatSummaryLine,
  parseCleanupArgs,
  sweepInvalidJobs,
  type CleanupSummary,
} from '../modules/knowledge-base/queues/cleanup-invalid-jobs.util';

function createQueue(name: string): Queue {
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = Number(process.env.REDIS_PORT ?? 6379);
  return new Queue(name, { connection: { host, port } });
}

async function main(): Promise<void> {
  const { apply, pauseDuringSweep } = parseCleanupArgs(process.argv.slice(2));
  const queues = [DOCUMENT_EMBEDDING_QUEUE, GRAPH_EXTRACTION_QUEUE].map(
    (name) => ({ name, queue: createQueue(name) }),
  );

  const summaries: CleanupSummary[] = [];
  try {
    for (const { name, queue } of queues) {
      const summary = await sweepInvalidJobs({
        name,
        queue,
        apply,
        pauseDuringSweep,
        logger: { log: console.log, warn: console.warn },
      });
      summaries.push(summary);
    }
  } finally {
    await Promise.all(queues.map(({ queue }) => queue.close()));
  }

  let totalInvalid = 0;
  let totalRemoved = 0;
  for (const s of summaries) {
    console.log(formatSummaryLine(s));
    totalInvalid += s.invalid;
    totalRemoved += s.removed;
  }
  console.log(
    formatSummaryLine({
      total: true,
      invalid: totalInvalid,
      removed: totalRemoved,
      applied: apply,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

```

---

### 파일 7: backend/src/scripts/migrate-button-ids.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/scripts/migrate-button-ids.spec.ts b/backend/src/scripts/migrate-button-ids.spec.ts
index 1046a145..8f91921b 100644
--- a/backend/src/scripts/migrate-button-ids.spec.ts
+++ b/backend/src/scripts/migrate-button-ids.spec.ts
@@ -4,10 +4,7 @@
  * prod apply); this suite locks in the idempotency / preservation /
  * fallback rules so legacy edges survive the migration.
  */
-import {
-  backfillButtonIds,
-  BackfillHit,
-} from '../../scripts/migrate-button-ids';
+import { backfillButtonIds, BackfillHit } from './migrate-button-ids';
 
 describe('backfillButtonIds', () => {
   function run(config: Record<string, unknown>): {

```

#### 전체 파일 컨텍스트
```
/**
 * Unit tests for the pure backfill logic in `migrate-button-ids.ts`. The
 * DB-touching `main()` path is exercised manually (staging dry-run before
 * prod apply); this suite locks in the idempotency / preservation /
 * fallback rules so legacy edges survive the migration.
 */
import { backfillButtonIds, BackfillHit } from './migrate-button-ids';

describe('backfillButtonIds', () => {
  function run(config: Record<string, unknown>): {
    out: Record<string, unknown>;
    hits: BackfillHit[];
  } {
    const hits: BackfillHit[] = [];
    const out = backfillButtonIds('wf-1', 'node-1', config, hits);
    return { out, hits };
  }

  it('빈 button id 를 btn_${i} fallback 으로 채움', () => {
    const { out, hits } = run({
      buttons: [{ label: 'A' }, { label: 'B' }],
    });
    expect((out.buttons as Array<{ id: string }>).map((b) => b.id)).toEqual([
      'btn_0',
      'btn_1',
    ]);
    expect(hits).toHaveLength(2);
    expect(hits[0].location).toBe('buttons[0]');
    expect(hits[0].newId).toBe('btn_0');
  });

  it('살아있는 id 는 그대로 보존', () => {
    const input = {
      buttons: [
        { id: 'confirm', label: 'A' },
        { id: 'cancel', label: 'B' },
      ],
    };
    const { out, hits } = run(input);
    expect(hits).toHaveLength(0);
    expect(out).toBe(input); // reference 동일 = mutation 없음
  });

  it('itemButtons 위치는 itemBtn_${i} fallback', () => {
    const { out, hits } = run({
      itemButtons: [{}, {}, { id: 'keep' }],
    });
    expect((out.itemButtons as Array<{ id: string }>).map((b) => b.id)).toEqual(
      ['itemBtn_0', 'itemBtn_1', 'keep'],
    );
    expect(hits).toHaveLength(2);
    expect(hits[0].location).toBe('itemButtons[0]');
  });

  it('items[*].buttons 는 items_${i}_btn_${j} fallback', () => {
    const { out, hits } = run({
      items: [
        { title: 'X', buttons: [{}, { id: 'keep' }] },
        { title: 'Y', buttons: [{}] },
      ],
    });
    const items = out.items as Array<{ buttons: Array<{ id: string }> }>;
    expect(items[0].buttons.map((b) => b.id)).toEqual([
      'items_0_btn_0',
      'keep',
    ]);
    expect(items[1].buttons.map((b) => b.id)).toEqual(['items_1_btn_0']);
    expect(hits).toHaveLength(2);
  });

  it('invalid slug 인 id (e.g. 공백 포함) 은 살아있다고 보지 않고 재부여', () => {
    const { out, hits } = run({
      buttons: [
        { id: 'has space', label: 'A' },
        { id: 'OK_id', label: 'B' },
      ],
    });
    const buttons = out.buttons as Array<{ id: string }>;
    expect(buttons[0].id).toBe('btn_0');
    expect(buttons[1].id).toBe('OK_id');
    expect(hits).toHaveLength(1);
  });

  it('변경 없으면 input 그대로 (reference 비교)', () => {
    const input = { buttons: [{ id: 'a', label: 'A' }] };
    const { out } = run(input);
    expect(out).toBe(input);
  });

  it('button 위치 3곳 동시 backfill', () => {
    const { out, hits } = run({
      buttons: [{}],
      itemButtons: [{}],
      items: [{ buttons: [{}] }],
    });
    expect((out.buttons as Array<{ id: string }>)[0].id).toBe('btn_0');
    expect((out.itemButtons as Array<{ id: string }>)[0].id).toBe('itemBtn_0');
    expect(
      (out.items as Array<{ buttons: Array<{ id: string }> }>)[0].buttons[0].id,
    ).toBe('items_0_btn_0');
    expect(hits).toHaveLength(3);
  });

  it('idempotent — 두 번 호출해도 hits 추가 없음', () => {
    const first = run({ buttons: [{ label: 'A' }] });
    const hits2: BackfillHit[] = [];
    const second = backfillButtonIds('wf-1', 'node-1', first.out, hits2);
    expect(hits2).toHaveLength(0);
    expect(second).toBe(first.out);
  });
});

```

---

### 파일 8: backend/src/scripts/migrate-button-ids.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/scripts/migrate-button-ids.ts b/backend/src/scripts/migrate-button-ids.ts
new file mode 100644
index 00000000..83968763
--- /dev/null
+++ b/backend/src/scripts/migrate-button-ids.ts
@@ -0,0 +1,315 @@
+/**
+ * F-2 button id backfill 마이그레이션 스크립트.
+ *
+ * 배경: shadow-workflow 가 buttons[*].id 를 자동 부여하기 시작하면 (F-2 의
+ * label-slug 정책), 기존 워크플로 중 id 가 비어있던 button entry 는 후속
+ * update_node 에서 새 slug 를 받게 된다. canvas 에 이미 `btn_0` 같은
+ * resolver-fallback 포트로 연결된 edge 가 있다면 button.id 와 edge.target_port
+ * 가 어긋나 edge 가 dangling 상태가 된다.
+ *
+ * 본 스크립트는 shadow auto-generate 를 활성화하기 전에 실행해, 모든 워크플로의
+ * 빈 button id 를 resolver fallback 패턴 (`btn_${i}` / `itemBtn_${i}` /
+ * `items_${i}_btn_${j}`) 으로 채워 넣는다. 이후 shadow 가 update_node 를
+ * 처리해도 id 가 살아있으므로 그대로 보존되어 edge 가 끊기지 않는다.
+ *
+ * Usage (run from repo root OR backend/ — `backend/.env` is auto-loaded):
+ *
+ *   # dry-run — prints planned changes, no DB write
+ *   npx ts-node backend/src/scripts/migrate-button-ids.ts --dry-run
+ *
+ *   # apply — requires workspace/user ids for the audit_log row
+ *   npx ts-node backend/src/scripts/migrate-button-ids.ts --apply \
+ *     --workspace-id <uuid> --user-id <uuid>
+ *
+ * 대상 노드 타입: carousel / chart / table / template.
+ * 대상 위치: config.buttons[*], config.itemButtons[*], config.items[*].buttons[*].
+ */
+
+import * as path from 'path';
+import * as dotenv from 'dotenv';
+import { DataSource } from 'typeorm';
+import { isValidStablePortId } from '../nodes/core/port-id.util';
+
+/**
+ * `.env` 로드는 main() 진입 시에만 수행 — module import 만으로 process.env 가
+ * 오염되면 단위 테스트가 통제 불가능해진다 (review W-9).
+ */
+function loadDotenv(): void {
+  const envPath = path.resolve(__dirname, '..', '..', '.env');
+  const result = dotenv.config({ path: envPath });
+  if (result.error) {
+    console.warn(
+      `[migrate-button-ids] .env not loaded at ${envPath} (${result.error.message}) — relying on process.env only.`,
+    );
+  }
+}
+
+const DRY_RUN =
+  process.argv.includes('--dry-run') || !process.argv.includes('--apply');
+
+function parseCliFlag(name: string): string | undefined {
+  const eqIdx = process.argv.findIndex((a) => a.startsWith(`${name}=`));
+  if (eqIdx >= 0) return process.argv[eqIdx].split('=', 2)[1];
+  const flagIdx = process.argv.indexOf(name);
+  if (flagIdx >= 0 && flagIdx < process.argv.length - 1) {
+    return process.argv[flagIdx + 1];
+  }
+  return undefined;
+}
+
+const CLI_WORKSPACE_ID = parseCliFlag('--workspace-id');
+const CLI_USER_ID = parseCliFlag('--user-id');
+
+const BUTTON_NODE_TYPES = new Set(['carousel', 'chart', 'table', 'template']);
+
+interface ButtonLike {
+  id?: unknown;
+  [key: string]: unknown;
+}
+
+interface CarouselItemLike {
+  buttons?: unknown;
+  [key: string]: unknown;
+}
+
+interface NodeConfigLike {
+  buttons?: unknown;
+  itemButtons?: unknown;
+  items?: unknown;
+  [key: string]: unknown;
+}
+
+// 단일 출처: port-id.util.isValidStablePortId — runtime helper 와 마이그레이션
+// 스크립트가 동일 검사를 공유해 drift 방지 (review W-10).
+const isValidExistingId = isValidStablePortId;
+
+export interface BackfillHit {
+  workflowId: string;
+  nodeId: string;
+  location: string; // e.g. "buttons[0]" / "items[1].buttons[2]"
+  newId: string;
+}
+
+/**
+ * config 의 모든 button 위치를 backfill. 변경이 일어나면 새 config 객체를
+ * 반환하고 hits 에 항목을 누적. 변경이 없으면 input 을 그대로 반환.
+ */
+export function backfillButtonIds(
+  workflowId: string,
+  nodeId: string,
+  config: NodeConfigLike,
+  hits: BackfillHit[],
+): NodeConfigLike {
+  let changed = false;
+  let next: NodeConfigLike | null = null;
+  const ensureCopy = (): NodeConfigLike => {
+    if (!next) next = { ...config };
+    return next;
+  };
+
+  if (Array.isArray(config.buttons)) {
+    const buttons = config.buttons as ButtonLike[];
+    const newButtons = buttons.map((b, i) => {
+      // null/undefined entry 방어 (review W-13). 빈 entry 는 fallback id 만 가진
+      // 새 객체로 대체.
+      if (b == null || typeof b !== 'object') {
+        const newId = `btn_${i}`;
+        hits.push({ workflowId, nodeId, location: `buttons[${i}]`, newId });
+        changed = true;
+        return { id: newId };
+      }
+      if (isValidExistingId(b.id)) return b;
+      const newId = `btn_${i}`;
+      hits.push({ workflowId, nodeId, location: `buttons[${i}]`, newId });
+      changed = true;
+      return { ...b, id: newId };
+    });
+    if (changed) ensureCopy().buttons = newButtons;
+  }
+
+  if (Array.isArray(config.itemButtons)) {
+    let itemBtnChanged = false;
+    const buttons = config.itemButtons as ButtonLike[];
+    const newButtons = buttons.map((b, i) => {
+      if (b == null || typeof b !== 'object') {
+        const newId = `itemBtn_${i}`;
+        hits.push({ workflowId, nodeId, location: `itemButtons[${i}]`, newId });
+        itemBtnChanged = true;
+        return { id: newId };
+      }
+      if (isValidExistingId(b.id)) return b;
+      const newId = `itemBtn_${i}`;
+      hits.push({ workflowId, nodeId, location: `itemButtons[${i}]`, newId });
+      itemBtnChanged = true;
+      return { ...b, id: newId };
+    });
+    if (itemBtnChanged) {
+      ensureCopy().itemButtons = newButtons;
+      changed = true;
+    }
+  }
+
+  if (Array.isArray(config.items)) {
+    let itemsChanged = false;
+    const items = config.items as CarouselItemLike[];
+    const newItems = items.map((item, i) => {
+      if (!item || typeof item !== 'object' || !Array.isArray(item.buttons)) {
+        return item;
+      }
+      let buttonsChanged = false;
+      const buttons = item.buttons as ButtonLike[];
+      const newButtons = buttons.map((b, j) => {
+        if (b == null || typeof b !== 'object') {
+          const newId = `items_${i}_btn_${j}`;
+          hits.push({
+            workflowId,
+            nodeId,
+            location: `items[${i}].buttons[${j}]`,
+            newId,
+          });
+          buttonsChanged = true;
+          return { id: newId };
+        }
+        if (isValidExistingId(b.id)) return b;
+        const newId = `items_${i}_btn_${j}`;
+        hits.push({
+          workflowId,
+          nodeId,
+          location: `items[${i}].buttons[${j}]`,
+          newId,
+        });
+        buttonsChanged = true;
+        return { ...b, id: newId };
+      });
+      if (buttonsChanged) {
+        itemsChanged = true;
+        return { ...item, buttons: newButtons };
+      }
+      return item;
+    });
+    if (itemsChanged) {
+      ensureCopy().items = newItems;
+      changed = true;
+    }
+  }
+
+  return changed && next ? next : config;
+}
+
+async function main(): Promise<void> {
+  loadDotenv();
+  // DB_PASSWORD 는 fallback 두지 않는다 — 운영 환경에 dev 패스워드가 새는
+  // 사고 방지 (review W-3). 로컬 dev 는 backend/.env 에 명시.
+  const password = process.env.DB_PASSWORD;
+  if (!password) {
+    throw new Error(
+      'DB_PASSWORD is required — set it in backend/.env or as an env var before running this migration.',
+    );
+  }
+  const ds = new DataSource({
+    type: 'postgres',
+    host: process.env.DB_HOST ?? 'localhost',
+    port: Number(process.env.DB_PORT ?? 5432),
+    username: process.env.DB_USERNAME ?? 'workflow',
+    password,
+    database: process.env.DB_DATABASE ?? 'workflow',
+  });
+  await ds.initialize();
+  try {
+    await runMigration(ds);
+  } finally {
+    // ds.destroy() 누수 방지 (review W-8) — 예외가 나도 connection pool 종료.
+    await ds.destroy();
+  }
+}
+
+async function runMigration(ds: DataSource): Promise<void> {
+  const rows = (await ds.query<
+    Array<{
+      workflow_id: string;
+      id: string;
+      type: string;
+      config: Record<string, unknown>;
+    }>
+  >(
+    `SELECT w.id AS workflow_id, n.id, n.type, n.config
+       FROM workflow w
+       JOIN node n ON n.workflow_id = w.id
+      WHERE n.type = ANY($1)
+      ORDER BY w.created_at, n.id`,
+    [Array.from(BUTTON_NODE_TYPES)],
+  )) as Array<{
+    workflow_id: string;
+    id: string;
+    type: string;
+    config: Record<string, unknown>;
+  }>;
+
+  const hits: BackfillHit[] = [];
+  const pendingUpdates: Array<{ nodeId: string; newConfig: unknown }> = [];
+
+  for (const row of rows) {
+    const newConfig = backfillButtonIds(
+      row.workflow_id,
+      row.id,
+      row.config,
+      hits,
+    );
+    if (newConfig !== row.config) {
+      pendingUpdates.push({ nodeId: row.id, newConfig });
+    }
+  }
+
+  console.log(
+    `\nScanned ${rows.length} button-node rows across all workspaces.`,
+  );
+  console.log(
+    `Backfills planned: ${hits.length} (across ${pendingUpdates.length} nodes).`,
+  );
+  for (const hit of hits) {
+    console.log(
+      `  [${DRY_RUN ? 'DRY' : 'APPLY'}] wf=${hit.workflowId} node=${hit.nodeId} ${hit.location} ← id="${hit.newId}"`,
+    );
+  }
+
+  if (!DRY_RUN && pendingUpdates.length > 0) {
+    if (!CLI_WORKSPACE_ID || !CLI_USER_ID) {
+      throw new Error(
+        '--apply requires --workspace-id <uuid> and --user-id <uuid> so the audit_log row is attributable. Re-run with both flags.',
+      );
+    }
+    await ds.transaction(async (manager) => {
+      for (const update of pendingUpdates) {
+        await manager.query(`UPDATE node SET config = $1 WHERE id = $2`, [
+          JSON.stringify(update.newConfig),
+          update.nodeId,
+        ]);
+      }
+      await manager.query(
+        `INSERT INTO audit_log (workspace_id, user_id, action, resource_type, resource_id, metadata, created_at)
+         VALUES ($1, $2, 'migrate-button-ids', 'workflow', NULL, $3, NOW())`,
+        [
+          CLI_WORKSPACE_ID,
+          CLI_USER_ID,
+          JSON.stringify({
+            nodes_updated: pendingUpdates.length,
+            backfill_count: hits.length,
+            timestamp_utc: new Date().toISOString(),
+          }),
+        ],
+      );
+    });
+    console.log(
+      `\nAPPLIED: ${pendingUpdates.length} nodes updated, ${hits.length} button ids backfilled.`,
+    );
+  } else if (DRY_RUN) {
+    console.log('\nDRY-RUN — no DB writes. Re-run with --apply to persist.');
+  }
+}
+
+if (require.main === module) {
+  main().catch((err: unknown) => {
+    console.error(err);
+    process.exit(1);
+  });
+}

```

#### 전체 파일 컨텍스트
```
/**
 * F-2 button id backfill 마이그레이션 스크립트.
 *
 * 배경: shadow-workflow 가 buttons[*].id 를 자동 부여하기 시작하면 (F-2 의
 * label-slug 정책), 기존 워크플로 중 id 가 비어있던 button entry 는 후속
 * update_node 에서 새 slug 를 받게 된다. canvas 에 이미 `btn_0` 같은
 * resolver-fallback 포트로 연결된 edge 가 있다면 button.id 와 edge.target_port
 * 가 어긋나 edge 가 dangling 상태가 된다.
 *
 * 본 스크립트는 shadow auto-generate 를 활성화하기 전에 실행해, 모든 워크플로의
 * 빈 button id 를 resolver fallback 패턴 (`btn_${i}` / `itemBtn_${i}` /
 * `items_${i}_btn_${j}`) 으로 채워 넣는다. 이후 shadow 가 update_node 를
 * 처리해도 id 가 살아있으므로 그대로 보존되어 edge 가 끊기지 않는다.
 *
 * Usage (run from repo root OR backend/ — `backend/.env` is auto-loaded):
 *
 *   # dry-run — prints planned changes, no DB write
 *   npx ts-node backend/src/scripts/migrate-button-ids.ts --dry-run
 *
 *   # apply — requires workspace/user ids for the audit_log row
 *   npx ts-node backend/src/scripts/migrate-button-ids.ts --apply \
 *     --workspace-id <uuid> --user-id <uuid>
 *
 * 대상 노드 타입: carousel / chart / table / template.
 * 대상 위치: config.buttons[*], config.itemButtons[*], config.items[*].buttons[*].
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { isValidStablePortId } from '../nodes/core/port-id.util';

/**
 * `.env` 로드는 main() 진입 시에만 수행 — module import 만으로 process.env 가
 * 오염되면 단위 테스트가 통제 불가능해진다 (review W-9).
 */
function loadDotenv(): void {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.warn(
      `[migrate-button-ids] .env not loaded at ${envPath} (${result.error.message}) — relying on process.env only.`,
    );
  }
}

const DRY_RUN =
  process.argv.includes('--dry-run') || !process.argv.includes('--apply');

function parseCliFlag(name: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`${name}=`));
  if (eqIdx >= 0) return process.argv[eqIdx].split('=', 2)[1];
  const flagIdx = process.argv.indexOf(name);
  if (flagIdx >= 0 && flagIdx < process.argv.length - 1) {
    return process.argv[flagIdx + 1];
  }
  return undefined;
}

const CLI_WORKSPACE_ID = parseCliFlag('--workspace-id');
const CLI_USER_ID = parseCliFlag('--user-id');

const BUTTON_NODE_TYPES = new Set(['carousel', 'chart', 'table', 'template']);

interface ButtonLike {
  id?: unknown;
  [key: string]: unknown;
}

interface CarouselItemLike {
  buttons?: unknown;
  [key: string]: unknown;
}

interface NodeConfigLike {
  buttons?: unknown;
  itemButtons?: unknown;
  items?: unknown;
  [key: string]: unknown;
}

// 단일 출처: port-id.util.isValidStablePortId — runtime helper 와 마이그레이션
// 스크립트가 동일 검사를 공유해 drift 방지 (review W-10).
const isValidExistingId = isValidStablePortId;

export interface BackfillHit {
  workflowId: string;
  nodeId: string;
  location: string; // e.g. "buttons[0]" / "items[1].buttons[2]"
  newId: string;
}

/**
 * config 의 모든 button 위치를 backfill. 변경이 일어나면 새 config 객체를
 * 반환하고 hits 에 항목을 누적. 변경이 없으면 input 을 그대로 반환.
 */
export function backfillButtonIds(
  workflowId: string,
  nodeId: string,
  config: NodeConfigLike,
  hits: BackfillHit[],
): NodeConfigLike {
  let changed = false;
  let next: NodeConfigLike | null = null;
  const ensureCopy = (): NodeConfigLike => {
    if (!next) next = { ...config };
    return next;
  };

  if (Array.isArray(config.buttons)) {
    const buttons = config.buttons as ButtonLike[];
    const newButtons = buttons.map((b, i) => {
      // null/undefined entry 방어 (review W-13). 빈 entry 는 fallback id 만 가진
      // 새 객체로 대체.
      if (b == null || typeof b !== 'object') {
        const newId = `btn_${i}`;
        hits.push({ workflowId, nodeId, location: `buttons[${i}]`, newId });
        changed = true;
        return { id: newId };
      }
      if (isValidExistingId(b.id)) return b;
      const newId = `btn_${i}`;
      hits.push({ workflowId, nodeId, location: `buttons[${i}]`, newId });
      changed = true;
      return { ...b, id: newId };
    });
    if (changed) ensureCopy().buttons = newButtons;
  }

  if (Array.isArray(config.itemButtons)) {
    let itemBtnChanged = false;
    const buttons = config.itemButtons as ButtonLike[];
    const newButtons = buttons.map((b, i) => {
      if (b == null || typeof b !== 'object') {
        const newId = `itemBtn_${i}`;
        hits.push({ workflowId, nodeId, location: `itemButtons[${i}]`, newId });
        itemBtnChanged = true;
        return { id: newId };
      }
      if (isValidExistingId(b.id)) return b;
      const newId = `itemBtn_${i}`;
      hits.push({ workflowId, nodeId, location: `itemButtons[${i}]`, newId });
      itemBtnChanged = true;
      return { ...b, id: newId };
    });
    if (itemBtnChanged) {
      ensureCopy().itemButtons = newButtons;
      changed = true;
    }
  }

  if (Array.isArray(config.items)) {
    let itemsChanged = false;
    const items = config.items as CarouselItemLike[];
    const newItems = items.map((item, i) => {
      if (!item || typeof item !== 'object' || !Array.isArray(item.buttons)) {
        return item;
      }
      let buttonsChanged = false;
      const buttons = item.buttons as ButtonLike[];
      const newButtons = buttons.map((b, j) => {
        if (b == null || typeof b !== 'object') {
          const newId = `items_${i}_btn_${j}`;
          hits.push({
            workflowId,
            nodeId,
            location: `items[${i}].buttons[${j}]`,
            newId,
          });
          buttonsChanged = true;
          return { id: newId };
        }
        if (isValidExistingId(b.id)) return b;
        const newId = `items_${i}_btn_${j}`;
        hits.push({
          workflowId,
          nodeId,
          location: `items[${i}].buttons[${j}]`,
          newId,
        });
        buttonsChanged = true;
        return { ...b, id: newId };
      });
      if (buttonsChanged) {
        itemsChanged = true;
        return { ...item, buttons: newButtons };
      }
      return item;
    });
    if (itemsChanged) {
      ensureCopy().items = newItems;
      changed = true;
    }
  }

  return changed && next ? next : config;
}

async function main(): Promise<void> {
  loadDotenv();
  // DB_PASSWORD 는 fallback 두지 않는다 — 운영 환경에 dev 패스워드가 새는
  // 사고 방지 (review W-3). 로컬 dev 는 backend/.env 에 명시.
  const password = process.env.DB_PASSWORD;
  if (!password) {
    throw new Error(
      'DB_PASSWORD is required — set it in backend/.env or as an env var before running this migration.',
    );
  }
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'workflow',
    password,
    database: process.env.DB_DATABASE ?? 'workflow',
  });
  await ds.initialize();
  try {
    await runMigration(ds);
  } finally {
    // ds.destroy() 누수 방지 (review W-8) — 예외가 나도 connection pool 종료.
    await ds.destroy();
  }
}

async function runMigration(ds: DataSource): Promise<void> {
  const rows = (await ds.query<
    Array<{
      workflow_id: string;
      id: string;
      type: string;
      config: Record<string, unknown>;
    }>
  >(
    `SELECT w.id AS workflow_id, n.id, n.type, n.config
       FROM workflow w
       JOIN node n ON n.workflow_id = w.id
      WHERE n.type = ANY($1)
      ORDER BY w.created_at, n.id`,
    [Array.from(BUTTON_NODE_TYPES)],
  )) as Array<{
    workflow_id: string;
    id: string;
    type: string;
    config: Record<string, unknown>;
  }>;

  const hits: BackfillHit[] = [];
  const pendingUpdates: Array<{ nodeId: string; newConfig: unknown }> = [];

  for (const row of rows) {
    const newConfig = backfillButtonIds(
      row.workflow_id,
      row.id,
      row.config,
      hits,
    );
    if (newConfig !== row.config) {
      pendingUpdates.push({ nodeId: row.id, newConfig });
    }
  }

  console.log(
    `\nScanned ${rows.length} button-node rows across all workspaces.`,
  );
  console.log(
    `Backfills planned: ${hits.length} (across ${pendingUpdates.length} nodes).`,
  );
  for (const hit of hits) {
    console.log(
      `  [${DRY_RUN ? 'DRY' : 'APPLY'}] wf=${hit.workflowId} node=${hit.nodeId} ${hit.location} ← id="${hit.newId}"`,
    );
  }

  if (!DRY_RUN && pendingUpdates.length > 0) {
    if (!CLI_WORKSPACE_ID || !CLI_USER_ID) {
      throw new Error(
        '--apply requires --workspace-id <uuid> and --user-id <uuid> so the audit_log row is attributable. Re-run with both flags.',
      );
    }
    await ds.transaction(async (manager) => {
      for (const update of pendingUpdates) {
        await manager.query(`UPDATE node SET config = $1 WHERE id = $2`, [
          JSON.stringify(update.newConfig),
          update.nodeId,
        ]);
      }
      await manager.query(
        `INSERT INTO audit_log (workspace_id, user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES ($1, $2, 'migrate-button-ids', 'workflow', NULL, $3, NOW())`,
        [
          CLI_WORKSPACE_ID,
          CLI_USER_ID,
          JSON.stringify({
            nodes_updated: pendingUpdates.length,
            backfill_count: hits.length,
            timestamp_utc: new Date().toISOString(),
          }),
        ],
      );
    });
    console.log(
      `\nAPPLIED: ${pendingUpdates.length} nodes updated, ${hits.length} button ids backfilled.`,
    );
  } else if (DRY_RUN) {
    console.log('\nDRY-RUN — no DB writes. Re-run with --apply to persist.');
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}

```

---

### 파일 9: backend/src/scripts/migrate-node-output-refs.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/scripts/migrate-node-output-refs.spec.ts b/backend/src/scripts/migrate-node-output-refs.spec.ts
index 8b41ffa8..c4672fea 100644
--- a/backend/src/scripts/migrate-node-output-refs.spec.ts
+++ b/backend/src/scripts/migrate-node-output-refs.spec.ts
@@ -12,7 +12,7 @@ import {
   RESULT_FIELDS,
   RENAMED_OUTPUT_FIELDS,
   RENAMED_META_FIELDS,
-} from '../../scripts/migrate-node-output-refs';
+} from './migrate-node-output-refs';
 
 function typeMap(entries: Record<string, string>): Map<string, string> {
   return new Map(Object.entries(entries));

```

#### 전체 파일 컨텍스트
```
/**
 * Unit tests for the expression-rewriter logic inside
 * `migrate-node-output-refs.ts`. The DB-touching `main()` path is exercised
 * manually (staging dry-run before prod apply); this suite only covers
 * the pure-string passes so idempotency and edge cases are locked in.
 */
import {
  rewriteExpression,
  walkAndRewrite,
  RELOCATED_FIELDS,
  META_FIELDS,
  RESULT_FIELDS,
  RENAMED_OUTPUT_FIELDS,
  RENAMED_META_FIELDS,
} from './migrate-node-output-refs';

function typeMap(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('rewriteExpression', () => {
  describe('information_extractor double-nested path', () => {
    const labels = typeMap({ IE: 'information_extractor' });

    it('rewrites output.output.extracted → output.result.extracted', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["IE"].output.output.extracted.orderNumber }}',
        labels,
      );
      expect(result).toBe(
        '{{ $node["IE"].output.result.extracted.orderNumber }}',
      );
      expect(hits).toHaveLength(1);
      expect(hits[0].reason).toMatch(/extracted/);
    });

    it('rewrites each RESULT_FIELDS entry', () => {
      for (const field of RESULT_FIELDS.information_extractor ?? []) {
        const { result } = rewriteExpression(
          `{{ $node["IE"].output.output.${field} }}`,
          labels,
        );
        expect(result).toBe(`{{ $node["IE"].output.result.${field} }}`);
      }
    });

    it('rewrites double-nested meta fields to meta.* (not output.result)', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["IE"].output.output.collectionRetryCount }}',
        labels,
      );
      expect(result).toBe('{{ $node["IE"].meta.collectionRetryCount }}');
      expect(hits[0].reason).toMatch(/meta/);
    });

    it('audits unknown double-nested fields without rewriting', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["IE"].output.output._turnDebugHistory }}',
        labels,
      );
      expect(result).toBe('{{ $node["IE"].output.output._turnDebugHistory }}');
      expect(hits[0].reason).toMatch(/manual review/);
    });

    it('is idempotent — running twice leaves a rewritten path unchanged', () => {
      const first = rewriteExpression(
        '{{ $node["IE"].output.output.extracted.foo }}',
        labels,
      );
      const second = rewriteExpression(first.result, labels);
      expect(second.result).toBe(first.result);
      expect(second.hits).toHaveLength(0);
    });
  });

  describe('relocation to config (literal fields)', () => {
    it('moves http_request.url → config.url', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["HTTP"].output.url }}',
        typeMap({ HTTP: 'http_request' }),
      );
      expect(result).toBe('{{ $node["HTTP"].config.url }}');
      expect(hits[0].reason).toMatch(/moved to config/);
    });

    it('moves send_email.subject → config.subject', () => {
      const { result } = rewriteExpression(
        '{{ $node["Email"].output.subject }}',
        typeMap({ Email: 'send_email' }),
      );
      expect(result).toBe('{{ $node["Email"].config.subject }}');
    });

    it('moves presentation literal config (carousel.layout → config.layout)', () => {
      const { result } = rewriteExpression(
        '{{ $node["C"].output.layout }}',
        typeMap({ C: 'carousel' }),
      );
      expect(result).toBe('{{ $node["C"].config.layout }}');
    });
  });

  describe('relocation to meta (execution metrics)', () => {
    it('moves http_request.statusCode → meta.statusCode', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["HTTP"].output.statusCode }}',
        typeMap({ HTTP: 'http_request' }),
      );
      expect(result).toBe('{{ $node["HTTP"].meta.statusCode }}');
      expect(hits[0].reason).toMatch(/moved to meta/);
    });

    it('moves ai_agent.inputTokens → meta.inputTokens (post Stage 5)', () => {
      const { result } = rewriteExpression(
        '{{ $node["AI"].output.inputTokens }}',
        typeMap({ AI: 'ai_agent' }),
      );
      expect(result).toBe('{{ $node["AI"].meta.inputTokens }}');
    });
  });

  describe('LLM result wrapping (output.result.*)', () => {
    it('ai_agent.response → output.result.response', () => {
      const { result } = rewriteExpression(
        '{{ $node["AI"].output.response }}',
        typeMap({ AI: 'ai_agent' }),
      );
      expect(result).toBe('{{ $node["AI"].output.result.response }}');
    });

    it('text_classifier.categories → output.result.categories', () => {
      const { result } = rewriteExpression(
        '{{ $node["TC"].output.categories }}',
        typeMap({ TC: 'text_classifier' }),
      );
      expect(result).toBe('{{ $node["TC"].output.result.categories }}');
    });
  });

  describe('intra-output renames', () => {
    it('form.output.submittedData → output.interaction.data', () => {
      const { result } = rewriteExpression(
        '{{ $node["F"].output.submittedData.email }}',
        typeMap({ F: 'form' }),
      );
      expect(result).toBe('{{ $node["F"].output.interaction.data.email }}');
    });

    it('form.output.submittedData (root, no trailing field) rewrites too', () => {
      // A user may reference the whole object: `{{ $node["F"].output.submittedData }}`
      // with no trailing accessor. Pass 4 matches the terminal field, so the
      // rename still fires.
      const { result } = rewriteExpression(
        '{{ $node["F"].output.submittedData }}',
        typeMap({ F: 'form' }),
      );
      expect(result).toBe('{{ $node["F"].output.interaction.data }}');
    });

    it('template.output.content → output.rendered', () => {
      const { result } = rewriteExpression(
        '{{ $node["T"].output.content }}',
        typeMap({ T: 'template' }),
      );
      expect(result).toBe('{{ $node["T"].output.rendered }}');
    });
  });

  describe('discriminator dropout warning', () => {
    it.each([['carousel'], ['table'], ['chart'], ['template'], ['form']])(
      'flags %s.output.type without rewriting',
      (type) => {
        const { result, hits } = rewriteExpression(
          `{{ $node["N"].output.type === "${type}" }}`,
          typeMap({ N: type }),
        );
        expect(result).toBe(`{{ $node["N"].output.type === "${type}" }}`);
        expect(
          hits.some((h) => h.reason.includes('discriminator dropped')),
        ).toBe(true);
      },
    );
  });

  describe('status literal unification', () => {
    it("replaces status === 'submitted' with 'resumed'", () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["F"].status === \'submitted\' }}',
        typeMap({ F: 'form' }),
      );
      expect(result).toContain("=== 'resumed'");
      expect(hits.some((h) => h.field === 'status')).toBe(true);
    });

    it("replaces status === 'button_click' with 'resumed'", () => {
      const { result } = rewriteExpression(
        '{{ $node["C"].status === "button_click" }}',
        typeMap({ C: 'carousel' }),
      );
      expect(result).toContain("=== 'resumed'");
    });

    it("replaces status === 'button_continue' with 'resumed'", () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["C"].status === \'button_continue\' }}',
        typeMap({ C: 'carousel' }),
      );
      expect(result).toContain("=== 'resumed'");
      expect(hits.some((h) => h.field === 'status')).toBe(true);
    });

    it('does NOT rewrite output.interaction.type == "button_click" (payload discriminator)', () => {
      // The interaction payload still carries the original click type even
      // after the status field is unified. Ensure pass 5 targets only the
      // top-level status comparison, not interaction.type.
      const { result } = rewriteExpression(
        '{{ $node["C"].output.interaction.type === "button_click" }}',
        typeMap({ C: 'carousel' }),
      );
      expect(result).toBe(
        '{{ $node["C"].output.interaction.type === "button_click" }}',
      );
    });

    it('leaves non-target status literals alone', () => {
      const { result } = rewriteExpression(
        '{{ $node["X"].status === "waiting_for_input" }}',
        typeMap({ X: 'form' }),
      );
      expect(result).toBe('{{ $node["X"].status === "waiting_for_input" }}');
    });
  });

  describe('legacy error envelope field detection (Pass 6)', () => {
    it.each([['nodeId'], ['nodeType'], ['timestamp'], ['originalInput']])(
      'flags legacy output.error.%s without rewriting',
      (field) => {
        const { result, hits } = rewriteExpression(
          `{{ $node["H"].output.error.${field} }}`,
          typeMap({ H: 'http_request' }),
        );
        expect(result).toBe(`{{ $node["H"].output.error.${field} }}`);
        expect(
          hits.some((h) => h.reason.includes(`legacy output.error.${field}`)),
        ).toBe(true);
      },
    );
  });

  describe('structural path preservation', () => {
    it('does not re-rewrite .output.result.<f>', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["AI"].output.result.response }}',
        typeMap({ AI: 'ai_agent' }),
      );
      expect(result).toBe('{{ $node["AI"].output.result.response }}');
      expect(hits).toHaveLength(0);
    });

    it('does not touch .output.config.<f> for fields already in config', () => {
      const { result } = rewriteExpression(
        '{{ $node["AI"].output.config.systemPrompt }}',
        typeMap({ AI: 'ai_agent' }),
      );
      // nested output.config.X should collapse to config.X (pass 3).
      expect(result).toBe('{{ $node["AI"].config.systemPrompt }}');
    });

    it('does not rewrite fields on unknown node types', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["Unknown"].output.weirdField }}',
        typeMap({ Unknown: 'no_such_type' }),
      );
      expect(result).toBe('{{ $node["Unknown"].output.weirdField }}');
      expect(hits).toHaveLength(0);
    });
  });

  describe('multiple rewrites in one expression', () => {
    it('composes relocation + status unification in a single pass', () => {
      const { result } = rewriteExpression(
        '{{ $node["F"].output.submittedData.x && $node["F"].status === \'submitted\' }}',
        typeMap({ F: 'form' }),
      );
      expect(result).toContain('output.interaction.data.x');
      expect(result).toContain("=== 'resumed'");
    });

    it('passes plain text / non-$node expressions through unchanged', () => {
      const { result, hits } = rewriteExpression(
        '{{ $input.user.email + " on " + $execution.startedAt }}',
        typeMap({ F: 'form' }),
      );
      expect(result).toBe(
        '{{ $input.user.email + " on " + $execution.startedAt }}',
      );
      expect(hits).toHaveLength(0);
    });
  });

  describe('smoke coverage of every RELOCATED_FIELDS entry', () => {
    it('rewrites at least one field for each known node type', () => {
      for (const [nodeType, fields] of Object.entries(RELOCATED_FIELDS)) {
        if (fields.length === 0) continue;
        const field = fields[0];
        const labels = typeMap({ N: nodeType });
        const { result } = rewriteExpression(
          `{{ $node["N"].output.${field} }}`,
          labels,
        );
        expect(result).toBe(`{{ $node["N"].config.${field} }}`);
      }
    });
  });

  describe('smoke coverage of every META_FIELDS entry', () => {
    it('rewrites at least one field for each known node type', () => {
      for (const [nodeType, fields] of Object.entries(META_FIELDS)) {
        if (fields.length === 0) continue;
        const field = fields[0];
        const labels = typeMap({ N: nodeType });
        const { result } = rewriteExpression(
          `{{ $node["N"].output.${field} }}`,
          labels,
        );
        expect(result).toBe(`{{ $node["N"].meta.${field} }}`);
      }
    });
  });

  describe('RENAMED_OUTPUT_FIELDS coverage', () => {
    it('applies every configured rename', () => {
      for (const [nodeType, renames] of Object.entries(RENAMED_OUTPUT_FIELDS)) {
        const labels = typeMap({ N: nodeType });
        for (const [from, to] of renames) {
          const { result } = rewriteExpression(
            `{{ $node["N"].output.${from} }}`,
            labels,
          );
          expect(result).toBe(`{{ $node["N"].output.${to} }}`);
        }
      }
    });
  });

  describe('RENAMED_META_FIELDS coverage (D4 — Switch meta.value alias)', () => {
    it('rewrites $node["S"].meta.value → meta.resolvedValue for switch', () => {
      const labels = typeMap({ S: 'switch' });
      const { result, hits } = rewriteExpression(
        '{{ $node["S"].meta.value }}',
        labels,
      );
      expect(result).toBe('{{ $node["S"].meta.resolvedValue }}');
      expect(hits).toHaveLength(1);
      expect(hits[0].reason).toMatch(
        /meta\.value renamed to meta\.resolvedValue/,
      );
    });

    it('does not touch meta.value on non-switch nodes', () => {
      const labels = typeMap({ X: 'http_request' });
      const before = '{{ $node["X"].meta.value }}';
      const { result, hits } = rewriteExpression(before, labels);
      expect(result).toBe(before);
      expect(hits).toHaveLength(0);
    });

    it('chains output.value → meta.value → meta.resolvedValue for legacy switch refs', () => {
      // Pass 4 (META_FIELDS.switch includes "value") rewrites
      // .output.value → .meta.value, then pass 4b applies the rename to
      // .meta.resolvedValue. End-to-end this means a workflow stuck on the
      // pre-meta-channel path also lands on the canonical name.
      const labels = typeMap({ S: 'switch' });
      const { result } = rewriteExpression(
        '{{ $node["S"].output.value }}',
        labels,
      );
      expect(result).toBe('{{ $node["S"].meta.resolvedValue }}');
    });

    it('applies every configured RENAMED_META_FIELDS entry', () => {
      for (const [nodeType, renames] of Object.entries(RENAMED_META_FIELDS)) {
        const labels = typeMap({ N: nodeType });
        for (const [from, to] of renames) {
          const { result } = rewriteExpression(
            `{{ $node["N"].meta.${from} }}`,
            labels,
          );
          expect(result).toBe(`{{ $node["N"].meta.${to} }}`);
        }
      }
    });
  });
});

describe('walkAndRewrite', () => {
  const labels = typeMap({
    IE: 'information_extractor',
    HTTP: 'http_request',
    F: 'form',
  });

  it('walks nested objects and arrays, rewriting every string leaf', () => {
    const hits: Array<{
      field: string;
      reason: string;
      before: string;
      after: string;
    }> = [];
    const input = {
      body: '{{ $node["HTTP"].output.url }}',
      nested: {
        items: [
          '{{ $node["IE"].out

... (truncated due to prompt size limit) ...
```

---

### 파일 10: backend/src/scripts/migrate-node-output-refs.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/scripts/migrate-node-output-refs.ts b/backend/src/scripts/migrate-node-output-refs.ts
new file mode 100644
index 00000000..f1a7b6b0
--- /dev/null
+++ b/backend/src/scripts/migrate-node-output-refs.ts
@@ -0,0 +1,649 @@
+/**
+ * Workflow expression migration script — Phase 3 preparation.
+ *
+ * Rewrites `$node["<Label>"].output.<field>` references to
+ * `$node["<Label>"].config.<field>` for fields that moved from the legacy
+ * flat handler output into the new `config` slot. See
+ * `plan/node-output-shape-proposal.md` for the field mapping.
+ *
+ * Usage (run from repo root OR backend/ — `backend/.env` is auto-loaded):
+ *
+ *   # dry-run — prints diff, no DB write
+ *   npx ts-node backend/src/scripts/migrate-node-output-refs.ts --dry-run
+ *
+ *   # apply — requires workspace/user ids for the audit_log row
+ *   npx ts-node backend/src/scripts/migrate-node-output-refs.ts --apply \
+ *     --workspace-id <uuid> --user-id <uuid>
+ *
+ * Inline env override (skips `.env`):
+ *   DB_PASSWORD=… npx ts-node backend/src/scripts/migrate-node-output-refs.ts --apply …
+ *
+ * The script walks every workflow's nodes, scans the JSONB `config` field
+ * for expression strings, and applies a set of per-node-type rewrites.
+ * Each substitution is logged and, when `--apply` is set, persisted in a
+ * transaction along with an audit row in the `audit_log` table.
+ */
+
+import * as path from 'path';
+import * as dotenv from 'dotenv';
+import { DataSource } from 'typeorm';
+
+// Load `backend/.env` relative to this script so the CLI works from any
+// CWD (repo root, backend/, CI runner). `dotenv.config` does NOT override
+// values already present in process.env, so CI / Docker env injection and
+// inline `DB_PASSWORD=… npx ts-node …` overrides keep working.
+{
+  const envPath = path.resolve(__dirname, '..', '..', '.env');
+  const result = dotenv.config({ path: envPath });
+  if (result.error && require.main === module) {
+    console.warn(
+      `[migrate-node-output-refs] .env not loaded at ${envPath} (${result.error.message}) — relying on process.env only.`,
+    );
+  }
+}
+
+const DRY_RUN =
+  process.argv.includes('--dry-run') || !process.argv.includes('--apply');
+
+/** Parse a `--flag=value` or `--flag value` pair from argv. */
+function parseCliFlag(name: string): string | undefined {
+  const eqIdx = process.argv.findIndex((a) => a.startsWith(`${name}=`));
+  if (eqIdx >= 0) return process.argv[eqIdx].split('=', 2)[1];
+  const flagIdx = process.argv.indexOf(name);
+  if (flagIdx >= 0 && flagIdx < process.argv.length - 1) {
+    return process.argv[flagIdx + 1];
+  }
+  return undefined;
+}
+
+const CLI_WORKSPACE_ID = parseCliFlag('--workspace-id');
+const CLI_USER_ID = parseCliFlag('--user-id');
+
+/**
+ * For each node type, list the config fields that used to live at the root
+ * of the handler output and now live under `config`. Expressions referencing
+ * these via `$node["X"].output.<field>` must be rewritten to
+ * `$node["X"].config.<field>` since the handler no longer echoes them at
+ * `output`.
+ */
+export const RELOCATED_FIELDS: Record<string, readonly string[]> = {
+  send_email: ['integrationId', 'to', 'cc', 'subject', 'bodyType'],
+  database_query: ['integrationId', 'query', 'queryType', 'parameters'],
+  http_request: ['method', 'url', 'authentication', 'integrationId'],
+  if_else: ['conditions', 'combineMode'],
+  switch: ['switchValue', 'cases'],
+  filter: ['inputField', 'conditions', 'combineMode', 'strictComparison'],
+  foreach: ['arrayField'],
+  loop: ['count', 'maxIterations'],
+  map: ['inputField', 'errorPolicy'],
+  merge: ['strategy', 'outputFormat'],
+  split: ['fieldPath'],
+  variable_declaration: ['variables'],
+  variable_modification: ['modifications'],
+  transform: ['operations'],
+  code: ['language'],
+  // `categories` is NOT here — the runtime matched categories live on
+  // `output.result.categories` (see RESULT_FIELDS.text_classifier), while
+  // the author-declared schema stays on `config.categories` and is
+  // addressed directly by existing workflow authors.
+  text_classifier: ['inputField'],
+  information_extractor: ['schema', 'maxCollectionRetries'],
+  template: ['outputFormat', 'format'],
+  // Presentation literal config fields — Stage 3 (Principle 1.1).
+  form: ['title', 'submitLabel', 'fields'],
+  carousel: [
+    'layout',
+    'titleField',
+    'descriptionField',
+    'imageField',
+    // static carousel items literal — dynamic carousel's resolved items
+    // stay at output.items and should NOT be rewritten. The script only
+    // has access to the node type, not the mode; however, if the expression
+    // targets `items` on a carousel that's in dynamic mode, the rewrite is
+    // wrong. Operators must review carousel hits manually via the audit log.
+  ],
+  chart: ['chartType', 'title', 'xAxis', 'yAxis'],
+  table: ['columns', 'pageSize', 'sortBy', 'sortOrder'],
+};
+
+/**
+ * Fields that moved from root into `meta` (observability metadata). The
+ * same mapping pattern applies: `$node["X"].output.<field>` →
+ * `$node["X"].meta.<field>`.
+ */
+export const META_FIELDS: Record<string, readonly string[]> = {
+  send_email: ['durationMs', 'deliveryStatus'],
+  database_query: ['durationMs'],
+  http_request: ['statusCode', 'duration', 'headers'],
+  switch: ['expression', 'value', 'matchedCase'],
+  text_classifier: ['model', 'inputTokens', 'outputTokens', 'totalTokens'],
+  information_extractor: [
+    'model',
+    'inputTokens',
+    'outputTokens',
+    'totalTokens',
+    'thinkingTokens',
+    'collectionRetryCount',
+  ],
+  // ai_agent post-Stage-5: tokens / tool call count / RAG sources move from
+  // `output.metadata.*` to the top-level `meta.*`.
+  ai_agent: [
+    'model',
+    'inputTokens',
+    'outputTokens',
+    'totalTokens',
+    'thinkingTokens',
+    'toolCalls',
+    'ragSources',
+  ],
+};
+
+/**
+ * Fields that moved **into `output.result.*`** (LLM-category convention,
+ * CONVENTIONS §8). The rewrite shape is
+ * `$node["X"].output.<field>` → `$node["X"].output.result.<field>`.
+ * Used for information_extractor's post-Stage-1 shape.
+ */
+export const RESULT_FIELDS: Record<string, readonly string[]> = {
+  information_extractor: [
+    'extracted',
+    'messages',
+    'endReason',
+    'turnCount',
+    'originalInput',
+  ],
+  // ai_agent post-Stage-5: single-turn / multi-turn / condition all surface
+  // domain data under `output.result.*`.
+  ai_agent: ['response', 'messages', 'endReason', 'turnCount', 'condition'],
+  // text_classifier post-Stage-5: `category`/`categories`/`confidence`/
+  // `originalInput` live under `output.result.*`.
+  text_classifier: ['category', 'categories', 'confidence', 'originalInput'],
+};
+
+/**
+ * Fields that were renamed inside `output` (same nesting, new key). Applied
+ * as a final substring replacement after the structural passes above.
+ */
+export const RENAMED_OUTPUT_FIELDS: Record<
+  string,
+  ReadonlyArray<readonly [string, string]>
+> = {
+  // Template handler now exposes the resolved string as `rendered` (matching
+  // table/carousel's runtime-rendered HTML field).
+  template: [['content', 'rendered']],
+  // Form submission data moved under the unified interaction envelope.
+  form: [['submittedData', 'interaction.data']],
+};
+
+/**
+ * Fields that were renamed inside `meta` (same nesting, new key). Applied
+ * after the structural passes. The shape is `meta.<from>` → `meta.<to>` —
+ * scoped per node type so unrelated nodes that happen to expose `meta.<from>`
+ * keep working.
+ */
+export const RENAMED_META_FIELDS: Record<
+  string,
+  ReadonlyArray<readonly [string, string]>
+> = {
+  // D4 (logic-node-followups): `meta.value` was kept as a deprecated alias
+  // when the canonical field was renamed to `meta.resolvedValue`. The alias
+  // is now removed; rewrite any lingering references.
+  switch: [['value', 'resolvedValue']],
+};
+
+interface WorkflowNode {
+  id: string;
+  type: string;
+  label: string;
+  config: Record<string, unknown>;
+}
+
+interface RewriteHit {
+  workflowId: string;
+  nodeId: string;
+  field: string;
+  before: string;
+  after: string;
+  reason: string;
+}
+
+/**
+ * Scan a string for `$node["<label>"].output.<field>` occurrences that match
+ * a known relocation and return the rewritten string + list of hits.
+ *
+ * Passes:
+ *  1. Double-nested legacy path `$node["X"].output.output.<f>` →
+ *     `$node["X"].output.result.<f>` (information_extractor pre Stage 1).
+ *  2. Double-nested legacy meta `$node["X"].output.meta.<f>` →
+ *     `$node["X"].meta.<f>` (legacy port-selector shape).
+ *  3. Double-nested legacy config `$node["X"].output.config.<f>` →
+ *     `$node["X"].config.<f>`.
+ *  4. Single-level `$node["X"].output.<f>` mappings against
+ *     RELOCATED_FIELDS / META_FIELDS / RESULT_FIELDS.
+ *
+ * Passes 1–3 are idempotent; pass 4 is idempotent only when a field is not
+ * simultaneously in RELOCATED_FIELDS and the string still references
+ * `.output.<f>` (second run is a no-op since the first already rewrote).
+ */
+export interface RewriteHitDetail {
+  field: string;
+  reason: string;
+  before: string;
+  after: string;
+}
+
+export function rewriteExpression(
+  str: string,
+  nodeTypeByLabel: Map<string, string>,
+): { result: string; hits: RewriteHitDetail[] } {
+  const hits: RewriteHitDetail[] = [];
+
+  // Pass 1: `$node["X"].output.output.<field>` → resolve based on node type
+  //   information_extractor: move into `output.result.<field>` when the field
+  //   is a known result field, into `meta.<field>` when it's a metric, else
+  //   keep the inner `.output.` so the fix surfaces in the audit log.
+  let current = str.replace(
+    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.output\.([A-Za-z_][A-Za-z0-9_]*)/g,
+    (match, dbl, sgl, field) => {
+      const label = (dbl ?? sgl) as string;
+      const type = nodeTypeByLabel.get(label);
+      if (!type) return match;
+
+      if (META_FIELDS[type]?.includes(field)) {
+        const replacement = match.replace('.output.output.', '.meta.');
+        hits.push({
+          field,
+          reason: `${type}: ${field} double-nested → meta`,
+          before: match,
+          after: replacement,
+        });
+        return replacement;
+      }
+      if (RESULT_FIELDS[type]?.includes(field)) {
+        const replacement = match.replace('.output.output.', '.output.result.');
+        hits.push({
+          field,
+          reason: `${type}: ${field} double-nested → output.result`,
+          before: match,
+          after: replacement,
+        });
+        return replacement;
+      }
+      // Unrecognised double-nested field — record an audit hit so the
+      // operator notices (e.g. `_turnDebugHistory`, `_llmCalls`, `error`).
+      hits.push({
+        field,
+        reason: `${type}: double-nested .output.output.${field} — manual review needed`,
+        before: match,
+        after: match,
+      });
+      return match;
+    },
+  );
+
+  // Pass 2: `$node["X"].output.meta.<field>` → `$node["X"].meta.<field>`.
+  current = current.replace(
+    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.meta\.([A-Za-z_][A-Za-z0-9_]*)/g,
+    (match, _dbl, _sgl, field) => {
+      const replacement = match.replace('.output.meta.', '.meta.');
+      hits.push({
+        field,
+        reason: `nested .output.meta.${field} → meta`,
+        before: match,
+        after: replacement,
+      });
+      return replacement;
+    },
+  );
+
+  // Pass 3: `$node["X"].output.config.<field>` → `$node["X"].config.<field>`.
+  current = current.replace(
+    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.config\.([A-Za-z_][A-Za-z0-9_]*)/g,
+    (match, _dbl, _sgl, field) => {
+      const replacement = match.replace('.output.config.', '.config.');
+      hits.push({
+        field,
+        reason: `nested .output.config.${field} → config`,
+        before: match,
+        after: replacement,
+      });
+      return replacement;
+    },
+  );
+
+  // Pass 4: single-level `$node["X"].output.<field>`.
+  current = current.replace(
+    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.([A-Za-z_][A-Za-z0-9_]*)/g,
+    (match, dbl, sgl, field) => {
+      // Skip if it's actually `.output.output.<f>` / `.output.meta.<f>` /
+      // `.output.config.<f>` / `.output.result.<f>` — those are structural
+      // sub-paths the handler now emits and must not be rewritten again.
+      if (
+        field === 'output' ||
+        field === 'meta' ||
+        field === 'config' ||
+        field === 'result' ||
+        field === 'error' ||
+        field === 'interaction' ||
+        field === 'partial'
+      ) {
+        return match;
+      }
+      const label = (dbl ?? sgl) as string;
+      const type = nodeTypeByLabel.get(label);
+      if (!type) return match;
+
+      // Discriminator `output.type === 'carousel' | 'table' | ...` is dropped
+      // in Stage 3 (Principle 1.1.4). Record a warning so the operator can
+      // review and either remove the branch or compare against `$node["X"]`
+      // presence instead.
+      if (
+        field === 'type' &&
+        (type === 'carousel' ||
+          type === 'table' ||
+          type === 'chart' ||
+          type === 'template' ||
+          type === 'form')
+      ) {
+        hits.push({
+          field,
+          reason: `${type}: output.type discriminator dropped — manual review (Principle 1.1.4)`,
+          before: match,
+          after: match,
+        });
+        return match;
+      }
+
+      if (RELOCATED_FIELDS[type]?.includes(field)) {
+        const replacement = match.replace('.output.', '.config.');
+        hits.push({
+          field,
+          reason: `${type}: ${field} moved to config`,
+          before: match,
+          after: replacement,
+        });
+        return replacement;
+      }
+      if (META_FIELDS[type]?.includes(field)) {
+        const replacement = match.replace('.output.', '.meta.');
+        hits.push({
+          field,
+          reason: `${type}: ${field} moved to meta`,
+          before: match,
+          after: replacement,
+        });
+        return replacement;
+      }
+      if (RESULT_FIELDS[type]?.includes(field)) {
+        const replacement = match.replace('.output.', '.output.result.');
+        hits.push({
+          field,
+          reason: `${type}: ${field} moved to output.result`,
+          before: match,
+          after: replacement,
+        });
+        return replacement;
+      }
+
+      // Intra-output rename (e.g. `template.content` → `template.rendered`,
+      // `form.submittedData` → `form.interaction.data`). The rename table
+      // may substitute multi-segment paths (e.g. 'interaction.data'), which
+      // the regex only captured as `field` — we embed the replacement
+      // segment verbatim in the rewritten expression.
+      const renames = RENAMED_OUTPUT_FIELDS[type];
+      if (renames) {
+        const rename = renames.find(([from]) => from === field);
+        if (rename) {
+          const [from, to] = rename;
+          const replacement = match.replace(`.output.${from}`, `.output.${to}`);
+          hits.push({
+            field,
+            reason: `${type}: output.${from} renamed to output.${to}`,
+            before: match,
+            after: replacement,
+          });
+          return replacement;
+        }
+      }
+      return match;
+    },
+  );
+
+  // Pass 4b: `$node["X"].meta.<from>` → `$node["X"].meta.<to>` per
+  // RENAMED_META_FIELDS. Idempotent because the regex only fires on the
+  // legacy key.
+  current = current.replace(
+    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.meta\.([A-Za-z_][A-Za-z0-9_]*)/g,
+    (match, dbl, sgl, field) => {
+      const label = (dbl ?? sgl) as string;
+      const type = nodeTypeByLabel.get(label);
+      if (!type) return match;
+      const renames = RENAMED_META_FIELDS[type];
+      if (!renames) return match;
+      const rename = renames.find(([from]) => from === field);
+      if (!rename) return match;
+      const [from, to] = rename;
+      const replacement = match.replace(`.meta.${from}`, `.meta.${to}`);
+      hits.push({
+        field,
+        reason: `${type}: meta.${from} renamed to meta.${to}`,
+        before: match,
+        after: replacement,
+      });
+      return replacement;
+    },
+  );
+
+  // Pass 5: status literal transitions. Stage 3 unifies `submitted` /
+  // `button_click` / `button_continue` into `resumed`, with the original
+  // semantics preserved via `output.interaction.type`.
+  current = current.replace(
+    /\.status\s*(===|==)\s*['"](submitted|button_click|button_continue)['"]/g,
+    (match, op, status) => {
+      const replacement = match.replace(
+        /['"](submitted|button_click|button_continue)['"]/,
+        "'resumed'",
+      );
+      hits.push({
+        field: 'status',
+        reason: `status '${status}' unified to 'resumed' (Stage 3) — verify matching output.interaction.type === '${status}' branch`,
+        before: match,
+        after: replacement,
+      });
+      return replacement;
+    },
+  );
+
+  // Pass 6 (audit-only): legacy error envelope fields that were removed
+  // from the error-handling spec cannot be safely rewritten — the operator
+  // must review and migrate manually.
+  current.replace(
+    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.error\.(nodeId|nodeType|timestamp|originalInput)\b/g,
+    (match, _dbl, _sgl, field) => {
+      hits.push({
+        field,
+        reason: `legacy output.error.${field} removed — move to output.error.details.${field === 'originalInput' ? 'originalInput' : field} or inspect NodeExecution row`,
+        before: match,
+        after: match,
+      });
+      return match;
+    },
+  );
+
+  return { result: current, hits };
+}
+
+/**
+ * Recursively walk the node.config JSONB, applying `rewriteExpression` to
+ * every string value. Returns the new object and accumulated hits.
+ */
+export function walkAndRewrite(
+  value: unknown,
+  nodeTypeByLabel: Map<string, string>,
+  hits: RewriteHitDetail[],
+): unknown {
+  if (typeof value === 'string') {
+    const { result, hits: stringHits } = rewriteExpression(
+      value,
+      nodeTypeByLabel,
+    );
+    hits.push(...stringHits);
+    return result;
+  }
+  if (Array.isArray(value)) {
+    return value.map((v) => walkAndRewrite(v, nodeTypeByLabel, hits));
+  }
+  if (value && typeof value === 'object') {
+    const out: Record<string, unknown> = {};
+    for (const [k, v] of Object.entries(value)) {
+      out[k] = walkAndRewrite(v, nodeTypeByLabel, hits);
+    }
+    return out;
+  }
+  return value;
+}
+
+async function main(): Promise<void> {
+  const ds = new DataSource({
+    type: 'postgres',
+    host: process.env.DB_HOST ?? 'localhost',
+    port: Number(process.env.DB_PORT ?? 5432),
+    username: process.env.DB_USERNAME ?? 'workflow',
+    password: process.env.DB_PASSWORD ?? 'workflow_dev',
+    database: process.env.DB_DATABASE ?? 'workflow',
+  });
+  await ds.initialize();
+
+  // Single JOIN query replaces the legacy N+1 per-workflow fetch —
+  // one round-trip regardless of how many workflows the workspace has.
+  const rows = (await ds.query<
+    Array<{
+      workflow_id: string;
+      id: string;
+      type: string;
+      label: string;
+      config: Record<string, unknown>;
+    }>
+  >(
+    `SELECT w.id AS workflow_id, n.id, n.type, n.label, n.config
+       FROM workflow w
+       JOIN node n ON n.workflow_id = w.id
+      ORDER BY w.created_at, n.id`,
+  )) as Array<{
+    workflow_id: string;
+    id: string;
+    type: string;
+    label: string;
+    config: Record<string, unknown>;
+  }>;
+
+  // Group rows by workflow so label→type lookup stays workflow-scoped:
+  // two workflows in the same workspace may legitimately use the same
+  // label for different node types.
+  const nodesByWorkflow = new Map<string, WorkflowNode[]>();
+  for (const row of rows) {
+    const bucket = nodesByWorkflow.get(row.workflow_id) ?? [];
+    bucket.push({
+      id: row.id,
+      type: row.type,
+      label: row.label,
+      config: row.config,
+    });
+    nodesByWorkflow.set(row.workflow_id, bucket);
+  }
+
+  let totalHits = 0;
+  const perWorkflow: RewriteHit[] = [];
+  // Pre-compute all rewrites in memory so the APPLY phase can run inside a
+  // single transaction — partial application would leave some node.config
+  // on the new expression paths while others are still on the legacy ones.
+  const pendingUpdates: Array<{ nodeId: string; newConfig: unknown }> = [];
+
+  for (const [workflowId, nodes] of nodesByWorkflow) {
+    const typeByLabel = new Map<string, string>();
+    for (const n of nodes) typeByLabel.set(n.label, n.type);
+
+    for (const node of nodes) {
+      const hits: RewriteHitDetail[] = [];
+      const newConfig = walkAndRewrite(node.config, typeByLabel, hits);
+      if (hits.length === 0) continue;
+
+      totalHits += hits.length;
+      for (const h of hits) {
+        perWorkflow.push({
+          workflowId,
+          nodeId: node.id,
+          field: h.field,
+          before: h.before,
+          after: h.after,
+          reason: h.reason,
+        });
+      }
+      pendingUpdates.push({ nodeId: node.id, newConfig });
+    }
+  }
+
+  // Summary (always printed — dry-run users rely on the full log)
+  console.log(`\nScanned ${nodesByWorkflow.size} workflows.`);
+  console.log(`Total substitutions: ${totalHits}`);
+  for (const hit of perWorkflow) {
+    console.log(
+      `  [${DRY_RUN ? 'DRY' : 'APPLY'}] wf=${hit.workflowId} node=${hit.nodeId} ${hit.before} → ${hit.after}  (${hit.reason})`,
+    );
+  }
+
+  if (!DRY_RUN && pendingUpdates.length > 0) {
+    if (!CLI_WORKSPACE_ID || !CLI_USER_ID) {
+      throw new Error(
+        '--apply requires --workspace-id <uuid> and --user-id <uuid> so the audit_log row is attributable. Re-run with both flags.',
+      );
+    }
+    // Re-run safety: the rewriter itself is idempotent (passes 1–4 skip
+    // already-migrated paths and pass 6 is audit-only), so a double
+    // `--apply` will simply produce zero hits. But we still emit one
+    // audit_log row per apply run so repeat runs can be traced. Tag the
+    // row with a UTC timestamp so operators can see re-runs at a glance.
+    await ds.transaction(async (manager) => {
+      for (const update of pendingUpdates) {
+        await manager.query(
+          'UPDATE node SET config = $1::jsonb, updated_at = NOW() WHERE id = $2',
+          [JSON.stringify(update.newConfig), update.nodeId],
+        );
+      }
+      if (totalHits > 0) {
+        await manager.query(
+          `INSERT INTO audit_log (workspace_id, user_id, action, resource_type, resource_id, details)
+           VALUES ($1, $2, 'node_output_refs_migrated', 'workflow', gen_random_uuid(), $3::jsonb)`,
+          [
+            CLI_WORKSPACE_ID,
+            CLI_USER_ID,
+            JSON.stringify({
+              totalHits,
+              applied: true,
+              nodesUpdated: pendingUpdates.length,
+              appliedAt: new Date().toISOString(),
+            }),
+          ],
+        );
+      }
+    });
+  }
+
+  await ds.destroy();
+
+  if (DRY_RUN) {
+    console.log(
+      `\nDry-run complete. Re-run with --apply to persist the changes.`,
+    );
+  }
+}
+
+// Only auto-run when executed as a script. Jest / unit tests that `import`
+// this module to exercise `rewriteExpression` would otherwise open a DB
+// connection at load time.
+if (require.main === module) {
+  main().catch((err: unknown) => {
+    console.error(err);
+    process.exit(1);
+  });
+}

```

---

### 파일 11: plan/in-progress/cleanup-script-prod.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/cleanup-script-prod.md b/plan/in-progress/cleanup-script-prod.md
new file mode 100644
index 00000000..72b32ff3
--- /dev/null
+++ b/plan/in-progress/cleanup-script-prod.md
@@ -0,0 +1,55 @@
+---
+worktree: cleanup-script-prod-a3f81c
+started: 2026-05-15
+owner: developer
+---
+
+# cleanup-invalid-queue-jobs 스크립트 운영 사용 가능화
+
+## 배경
+
+`backend/scripts/cleanup-invalid-queue-jobs.ts` 는 BullMQ 큐(`DOCUMENT_EMBEDDING_QUEUE`, `GRAPH_EXTRACTION_QUEUE`)에서 `documentId` 가 비어있는 손상 job 을 골라 제거하는 1회성 정리 도구. 운영자가 "생각보다 빈번하게" 사용한다고 보고 → prod 컨테이너에서도 실행 가능해야 함.
+
+현재 제약:
+- 스크립트는 `ts-node` 실행 전제 (devDeps), 그러나 prod Dockerfile 의 `runner` 스테이지는 `dist/` 와 prod-only node_modules 만 가짐.
+- `tsconfig.build.json` 이 `src/**` 만 빌드하므로 `scripts/` 가 컴파일 산출물에 없음.
+
+## 회귀 조사 결과 (서브에이전트, 2026-05-15)
+
+운영자가 "또 쌓였다"고 느끼는 정체는 **누가 손상 job 을 enqueue 하는 신규 버그가 아니라**, 다음 두 가지의 합작:
+
+1. `knowledge-base.module.ts:42-49` 의 두 큐가 `removeOnFail` 미설정 — `InvalidJobPayloadError extends UnrecoverableError` 가드가 손상 페이로드를 `failed` 상태로 즉시 옮기지만 삭제는 안 됨. cleanup 스크립트가 `failed` 도 sweep 대상이라 잔재가 누적됨.
+2. `docker-compose.yml` 의 `redis_data:/data` named volume — 가드 도입(2026-05-13) 이전에 enqueue 된 손상 job 이 영속.
+
+Producer 측 6 개 호출지점 모두 정상 (`ParseUUIDPipe`/DB-derived uuid). 새 손상 job 을 만드는 경로 없음.
+
+**본 plan 의 범위 밖** — `removeOnFail` 정책 추가는 별도 plan `queue-removeonfail-policy.md` 로 분리 예정.
+
+## 작업 단위
+
+- [x] 스펙/일관성 사전 점검 — `/consistency-check --impl-prep`. Critical 1건 발견됐으나 본 작업 scope 외 spec 정합성 문제로 `spec-update-embedding-pipeline-consistency.md` 에 분리.
+- [x] `cleanup-invalid-jobs.util.ts` + `.spec.ts` 작성 (`src/modules/knowledge-base/queues/`). TDD, 14 테스트 통과.
+- [x] `backend/scripts/*.ts` → `backend/src/scripts/` 이동 (tsconfig.build.json 의 `rootDir: ./src` 제약 때문에 include 변경만으로는 컴파일 실패). 빌드 산출물은 `dist/scripts/*.js` 로 매핑됨. Dockerfile 변동 불필요.
+- [x] `backend/package.json` 에 `cleanup:queue-jobs` npm script 추가
+- [x] 스크립트 강화 (cleanup-invalid-queue-jobs.ts 재작성)
+  - sweep 로직을 util 모듈로 위임 (스크립트는 thin CLI 진입점만)
+  - `--pause-during-sweep` 플래그 (TOCTOU 자동화)
+  - 마지막 줄에 queue별/합계 JSON summary 출력
+  - docstring — 운영 호출 예 + 수동 워커 stop 절차 옵션화
+- [x] migrate-* 두 스크립트의 import 경로 + docstring 호출 경로 갱신 (동작 무변경)
+- [x] TEST WORKFLOW — lint(0 errors, 17 warnings 기존 부채), unit test 3484/3484 통과, build OK, dist 진입점 스모크 통과. `[skip-e2e]` (인프라 의존, 본 변경 영역이 e2e 트리거 영역 아님).
+- [ ] REVIEW WORKFLOW — `/ai-review` → RESOLUTION.md → 재테스트
+- [ ] PR 생성
+
+## Side-effect 점검
+
+- `backend/scripts/*.ts` 가 `backend/src/scripts/` 로 이동했고, 빌드 산출물에 `dist/scripts/*.js` 가 추가됨. `nest-cli.json` 의 swagger 플러그인은 `*.dto.ts`/`*.controller.ts` 패턴만 트리거하므로 스크립트 파일은 영향 없음.
+- Dockerfile `COPY ... /app/backend/dist ./backend/dist` 가 그대로 동봉. Dockerfile 변경 불필요.
+- `start:prod` 의 `node dist/main` 진입점은 변동 없음.
+- `backend/scripts/migrations/` (SQL) 는 그대로 유지.
+
+## 후속 (별도 plan 분리 필요)
+
+- [ ] `queue-removeonfail-policy.md` — 두 큐에 `removeOnFail: { age: 7d, count: 1000 }` 추가 + producer-side `isValidDocumentId` 가드. 운영자 수동 sweep 빈도를 근본적으로 제거.
+- [ ] migrate-node-output-refs.ts 의 17 warnings (`@typescript-eslint/no-unsafe-*`) — 기존 부채. 본 PR 외 plan 으로 정리.
+- [ ] `spec-update-embedding-pipeline-consistency.md` — Critical 1건 + Warning 6건 + Info 6건 (project-planner 위임).

```

#### 전체 파일 컨텍스트
```
---
worktree: cleanup-script-prod-a3f81c
started: 2026-05-15
owner: developer
---

# cleanup-invalid-queue-jobs 스크립트 운영 사용 가능화

## 배경

`backend/scripts/cleanup-invalid-queue-jobs.ts` 는 BullMQ 큐(`DOCUMENT_EMBEDDING_QUEUE`, `GRAPH_EXTRACTION_QUEUE`)에서 `documentId` 가 비어있는 손상 job 을 골라 제거하는 1회성 정리 도구. 운영자가 "생각보다 빈번하게" 사용한다고 보고 → prod 컨테이너에서도 실행 가능해야 함.

현재 제약:
- 스크립트는 `ts-node` 실행 전제 (devDeps), 그러나 prod Dockerfile 의 `runner` 스테이지는 `dist/` 와 prod-only node_modules 만 가짐.
- `tsconfig.build.json` 이 `src/**` 만 빌드하므로 `scripts/` 가 컴파일 산출물에 없음.

## 회귀 조사 결과 (서브에이전트, 2026-05-15)

운영자가 "또 쌓였다"고 느끼는 정체는 **누가 손상 job 을 enqueue 하는 신규 버그가 아니라**, 다음 두 가지의 합작:

1. `knowledge-base.module.ts:42-49` 의 두 큐가 `removeOnFail` 미설정 — `InvalidJobPayloadError extends UnrecoverableError` 가드가 손상 페이로드를 `failed` 상태로 즉시 옮기지만 삭제는 안 됨. cleanup 스크립트가 `failed` 도 sweep 대상이라 잔재가 누적됨.
2. `docker-compose.yml` 의 `redis_data:/data` named volume — 가드 도입(2026-05-13) 이전에 enqueue 된 손상 job 이 영속.

Producer 측 6 개 호출지점 모두 정상 (`ParseUUIDPipe`/DB-derived uuid). 새 손상 job 을 만드는 경로 없음.

**본 plan 의 범위 밖** — `removeOnFail` 정책 추가는 별도 plan `queue-removeonfail-policy.md` 로 분리 예정.

## 작업 단위

- [x] 스펙/일관성 사전 점검 — `/consistency-check --impl-prep`. Critical 1건 발견됐으나 본 작업 scope 외 spec 정합성 문제로 `spec-update-embedding-pipeline-consistency.md` 에 분리.
- [x] `cleanup-invalid-jobs.util.ts` + `.spec.ts` 작성 (`src/modules/knowledge-base/queues/`). TDD, 14 테스트 통과.
- [x] `backend/scripts/*.ts` → `backend/src/scripts/` 이동 (tsconfig.build.json 의 `rootDir: ./src` 제약 때문에 include 변경만으로는 컴파일 실패). 빌드 산출물은 `dist/scripts/*.js` 로 매핑됨. Dockerfile 변동 불필요.
- [x] `backend/package.json` 에 `cleanup:queue-jobs` npm script 추가
- [x] 스크립트 강화 (cleanup-invalid-queue-jobs.ts 재작성)
  - sweep 로직을 util 모듈로 위임 (스크립트는 thin CLI 진입점만)
  - `--pause-during-sweep` 플래그 (TOCTOU 자동화)
  - 마지막 줄에 queue별/합계 JSON summary 출력
  - docstring — 운영 호출 예 + 수동 워커 stop 절차 옵션화
- [x] migrate-* 두 스크립트의 import 경로 + docstring 호출 경로 갱신 (동작 무변경)
- [x] TEST WORKFLOW — lint(0 errors, 17 warnings 기존 부채), unit test 3484/3484 통과, build OK, dist 진입점 스모크 통과. `[skip-e2e]` (인프라 의존, 본 변경 영역이 e2e 트리거 영역 아님).
- [ ] REVIEW WORKFLOW — `/ai-review` → RESOLUTION.md → 재테스트
- [ ] PR 생성

## Side-effect 점검

- `backend/scripts/*.ts` 가 `backend/src/scripts/` 로 이동했고, 빌드 산출물에 `dist/scripts/*.js` 가 추가됨. `nest-cli.json` 의 swagger 플러그인은 `*.dto.ts`/`*.controller.ts` 패턴만 트리거하므로 스크립트 파일은 영향 없음.
- Dockerfile `COPY ... /app/backend/dist ./backend/dist` 가 그대로 동봉. Dockerfile 변경 불필요.
- `start:prod` 의 `node dist/main` 진입점은 변동 없음.
- `backend/scripts/migrations/` (SQL) 는 그대로 유지.

## 후속 (별도 plan 분리 필요)

- [ ] `queue-removeonfail-policy.md` — 두 큐에 `removeOnFail: { age: 7d, count: 1000 }` 추가 + producer-side `isValidDocumentId` 가드. 운영자 수동 sweep 빈도를 근본적으로 제거.
- [ ] migrate-node-output-refs.ts 의 17 warnings (`@typescript-eslint/no-unsafe-*`) — 기존 부채. 본 PR 외 plan 으로 정리.
- [ ] `spec-update-embedding-pipeline-consistency.md` — Critical 1건 + Warning 6건 + Info 6건 (project-planner 위임).

```

---

### 파일 12: plan/in-progress/spec-update-embedding-pipeline-consistency.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/spec-update-embedding-pipeline-consistency.md b/plan/in-progress/spec-update-embedding-pipeline-consistency.md
new file mode 100644
index 00000000..009e17ca
--- /dev/null
+++ b/plan/in-progress/spec-update-embedding-pipeline-consistency.md
@@ -0,0 +1,41 @@
+---
+worktree: cleanup-script-prod-a3f81c
+started: 2026-05-15
+owner: developer (→ project-planner 위임)
+---
+
+# spec-update: 8-embedding-pipeline 정합성 정비
+
+> 작성 배경: `cleanup-script-prod-a3f81c` worktree 의 사전 일관성 검토(`/consistency-check --impl-prep`) 에서 spec 자체의 기존 정합성 문제 다수 발견. 본 worktree 의 변경(스크립트 packaging) 과는 무관하므로 별도 plan 으로 분리. **project-planner 에 위임 필요**.
+
+검토 산출물: `review/consistency/2026/05/15/22_32_15/SUMMARY.md`
+
+## Critical (BLOCK 사유, 별도 작업으로 해소 필요)
+
+- [ ] **WebSocket 이벤트 명명 3중 충돌**
+  - `spec/5-system/8-embedding-pipeline.md §8` — 채널 `kb:${documentId}`, 콜론+언더스코어 이벤트 (`document:embedding_started` 등), `document:embedding_error` / `document:embedding_retry` 정의
+  - `spec/5-system/6-websocket-protocol.md §4.3` — 다른 채널/이벤트 type 형식, 위 두 이벤트 누락
+  - `spec/2-navigation/5-knowledge-base.md §2.4.1` — 채널 `embedding:{knowledgeBaseId}` 등 또 다른 표기
+  - 권위 문서 결정 후 나머지 두 문서 정합 필요. Graph RAG 이벤트(`graph_started` 등) 도 `6-websocket-protocol.md` 에 누락 → 함께 추가 권장.
+
+## Warning (정비 항목)
+
+- [ ] §2 임베딩 실패 에러 저장 위치 — "Document.metadata" → "Document.embedding_error_message" 로 수정 (단순 오기)
+- [ ] §9.4 `retry-failed` API 의 `scope` 허용값 — `'all'` 포함 여부 결정 후 `5-knowledge-base.md §2.4.1` 과 동기화
+- [ ] §6.2 IVFFlat DDL 예시 → HNSW 로 갱신 또는 V022/V023 마이그레이션 참조 주석
+- [ ] Rationale "후속 검토" 목록 — V024 로 완료된 항목에 완료 표시
+- [ ] Rationale 형식 — 작업 일지 → 결정 배경·근거·폐기 대안 중심으로 재작성
+- [ ] Rationale 본문의 폐기된 `memory/` 경로 직접 참조 제거
+- [ ] Rationale 본문의 옛 flat review 경로(`review/2026-05-02_13-18-24/`) 참조 제거
+
+## Info (선택)
+
+- [ ] `DocumentChunk` 정의가 `1-data-model.md §2.12.1` 과 `8-embedding-pipeline.md §6.1` 양쪽에 중복 — 후자에서 링크 참조로 전환 권장
+- [ ] `## 1. 개요` → `## Overview` 권장 패턴화
+- [ ] `document:embedding_error` 의미 변경(2026-05-11) 에 대한 §8 ↔ §9.2 교차 참조 한 줄 추가
+
+## 처리 방침
+
+- 본 worktree(`cleanup-script-prod-a3f81c`) 의 변경은 위 항목과 인과관계 없음. 따라서 본 worktree 의 구현은 차단하지 않음.
+- 위 항목은 `project-planner` skill 진입으로 별도 worktree 에서 처리.
+- 본 plan 은 `complete/` 로 이동시키지 않는다 — project-planner 가 인수받아 별도 plan 으로 분리하거나, 본 파일을 이어받아 처리.

```

#### 전체 파일 컨텍스트
```
---
worktree: cleanup-script-prod-a3f81c
started: 2026-05-15
owner: developer (→ project-planner 위임)
---

# spec-update: 8-embedding-pipeline 정합성 정비

> 작성 배경: `cleanup-script-prod-a3f81c` worktree 의 사전 일관성 검토(`/consistency-check --impl-prep`) 에서 spec 자체의 기존 정합성 문제 다수 발견. 본 worktree 의 변경(스크립트 packaging) 과는 무관하므로 별도 plan 으로 분리. **project-planner 에 위임 필요**.

검토 산출물: `review/consistency/2026/05/15/22_32_15/SUMMARY.md`

## Critical (BLOCK 사유, 별도 작업으로 해소 필요)

- [ ] **WebSocket 이벤트 명명 3중 충돌**
  - `spec/5-system/8-embedding-pipeline.md §8` — 채널 `kb:${documentId}`, 콜론+언더스코어 이벤트 (`document:embedding_started` 등), `document:embedding_error` / `document:embedding_retry` 정의
  - `spec/5-system/6-websocket-protocol.md §4.3` — 다른 채널/이벤트 type 형식, 위 두 이벤트 누락
  - `spec/2-navigation/5-knowledge-base.md §2.4.1` — 채널 `embedding:{knowledgeBaseId}` 등 또 다른 표기
  - 권위 문서 결정 후 나머지 두 문서 정합 필요. Graph RAG 이벤트(`graph_started` 등) 도 `6-websocket-protocol.md` 에 누락 → 함께 추가 권장.

## Warning (정비 항목)

- [ ] §2 임베딩 실패 에러 저장 위치 — "Document.metadata" → "Document.embedding_error_message" 로 수정 (단순 오기)
- [ ] §9.4 `retry-failed` API 의 `scope` 허용값 — `'all'` 포함 여부 결정 후 `5-knowledge-base.md §2.4.1` 과 동기화
- [ ] §6.2 IVFFlat DDL 예시 → HNSW 로 갱신 또는 V022/V023 마이그레이션 참조 주석
- [ ] Rationale "후속 검토" 목록 — V024 로 완료된 항목에 완료 표시
- [ ] Rationale 형식 — 작업 일지 → 결정 배경·근거·폐기 대안 중심으로 재작성
- [ ] Rationale 본문의 폐기된 `memory/` 경로 직접 참조 제거
- [ ] Rationale 본문의 옛 flat review 경로(`review/2026-05-02_13-18-24/`) 참조 제거

## Info (선택)

- [ ] `DocumentChunk` 정의가 `1-data-model.md §2.12.1` 과 `8-embedding-pipeline.md §6.1` 양쪽에 중복 — 후자에서 링크 참조로 전환 권장
- [ ] `## 1. 개요` → `## Overview` 권장 패턴화
- [ ] `document:embedding_error` 의미 변경(2026-05-11) 에 대한 §8 ↔ §9.2 교차 참조 한 줄 추가

## 처리 방침

- 본 worktree(`cleanup-script-prod-a3f81c`) 의 변경은 위 항목과 인과관계 없음. 따라서 본 worktree 의 구현은 차단하지 않음.
- 위 항목은 `project-planner` skill 진입으로 별도 worktree 에서 처리.
- 본 plan 은 `complete/` 로 이동시키지 않는다 — project-planner 가 인수받아 별도 plan 으로 분리하거나, 본 파일을 이어받아 처리.

```
