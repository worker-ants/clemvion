import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BackgroundRunsService } from './background-runs.service';
import { NodeExecutionStatus } from '../../node-executions/entities/node-execution.entity';

interface FakeNodeExec {
  id: string;
  executionId: string;
  nodeId: string;
  parentNodeExecutionId: string | null;
  status: NodeExecutionStatus;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
}

const makeBgNodeExec = (
  overrides: Partial<FakeNodeExec> = {},
): FakeNodeExec => ({
  id: 'bg-ne-1',
  executionId: 'exec-1',
  nodeId: 'bg-node-1',
  parentNodeExecutionId: null,
  status: NodeExecutionStatus.COMPLETED,
  startedAt: new Date('2026-05-15T05:04:37.000Z'),
  finishedAt: new Date('2026-05-15T05:04:37.100Z'),
  durationMs: 100,
  inputData: null,
  outputData: {
    meta: {
      backgroundRunId: 'bg-run-id',
      forkedAt: '2026-05-15T05:04:37.123Z',
    },
  },
  error: null,
  ...overrides,
});

const makeBodyNodeExec = (
  overrides: Partial<FakeNodeExec> = {},
): FakeNodeExec => ({
  id: 'body-1',
  executionId: 'exec-1',
  nodeId: 'node-A',
  parentNodeExecutionId: 'bg-ne-1',
  status: NodeExecutionStatus.COMPLETED,
  startedAt: new Date('2026-05-15T05:04:38.000Z'),
  finishedAt: new Date('2026-05-15T05:04:39.000Z'),
  durationMs: 1000,
  inputData: null,
  outputData: null,
  error: null,
  ...overrides,
});

describe('BackgroundRunsService', () => {
  let service: BackgroundRunsService;
  let executionRepo: { createQueryBuilder: jest.Mock };
  let nodeExecutionRepo: { createQueryBuilder: jest.Mock };
  let notificationsService: { findByBackgroundRun: jest.Mock };

  const buildOwnershipQB = (workspaceId: string | null) => {
    const qb: Record<string, jest.Mock> = {};
    qb.leftJoin = jest.fn().mockReturnValue(qb);
    qb.select = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.getOne = jest
      .fn()
      .mockResolvedValue(
        workspaceId ? { id: 'exec-1', workflow: { workspaceId } } : null,
      );
    return qb;
  };

  const buildBgNodeExecQB = (row: FakeNodeExec | null) => {
    const qb: Record<string, jest.Mock> = {};
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.getOne = jest.fn().mockResolvedValue(row);
    return qb;
  };

  const buildBodyPageQB = (rows: FakeNodeExec[]) => {
    const qb: Record<string, jest.Mock> = {};
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.orderBy = jest.fn().mockReturnValue(qb);
    qb.addOrderBy = jest.fn().mockReturnValue(qb);
    qb.take = jest.fn().mockReturnValue(qb);
    qb.getMany = jest.fn().mockResolvedValue(rows);
    return qb;
  };

  const buildAggregateQB = (raw: Record<string, unknown> | null) => {
    const qb: Record<string, jest.Mock> = {};
    qb.select = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.setParameters = jest.fn().mockReturnValue(qb);
    qb.getRawOne = jest.fn().mockResolvedValue(raw);
    return qb;
  };

  beforeEach(() => {
    executionRepo = { createQueryBuilder: jest.fn() };
    nodeExecutionRepo = { createQueryBuilder: jest.fn() };
    notificationsService = {
      findByBackgroundRun: jest.fn().mockResolvedValue([]),
    };
    service = new BackgroundRunsService(
      executionRepo as never,
      nodeExecutionRepo as never,
      notificationsService as never,
    );
  });

  describe('getBackgroundRun', () => {
    const baseQuery = { limit: 50 };

    it('returns response with body nodeExecutions and computed status (running)', async () => {
      const bgNode = makeBgNodeExec();
      const bodyRunning = makeBodyNodeExec({
        id: 'body-1',
        status: NodeExecutionStatus.RUNNING,
        finishedAt: null,
        durationMs: null,
      });

      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([bodyRunning]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '1',
            pending: '0',
            running: '1',
            completed: '0',
            failed: '0',
            skipped: '0',
            waiting: '0',
            latestFinished: null,
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      expect(result.backgroundRunId).toBe('bg-run-id');
      expect(result.parentNodeExecutionId).toBe('bg-ne-1');
      expect(result.status).toBe('running');
      expect(result.completedAt).toBeNull();
      expect(result.durationMs).toBeNull();
      expect(result.startedAt).toBe('2026-05-15T05:04:37.123Z'); // from meta.forkedAt
      expect(result.nodeExecutions.data).toHaveLength(1);
      expect(result.nodeExecutions.data[0]?.id).toBe('body-1');
      expect(result.nodeExecutions.hasMore).toBe(false);
      expect(result.nodeExecutions.nextCursor).toBeNull();
    });

    /**
     * 자매 표면 — `executions.service.ts` 의 읽기 경로와 같은 클래스다. 이 컨트롤러도
     * `@Roles` 게이트 없이 워크스페이스 멤버 전원에게 열려 있고 같은
     * `NodeExecution.error` 를 싣는다. 한쪽만 마스킹하면 *"자매 중 하나만"* 이 재현된다.
     */
    it('body nodeExecutions[].error 의 자격증명을 마스킹한다', async () => {
      const bgNode = makeBgNodeExec();
      const failed = makeBodyNodeExec({
        id: 'body-leak',
        status: NodeExecutionStatus.FAILED,
        error: {
          code: 'HTTP_ERROR',
          message: 'auth failed: Bearer sk-live-abc123def456',
        },
      });

      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([failed]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '1',
            pending: '0',
            running: '0',
            completed: '0',
            failed: '1',
            skipped: '0',
            waiting: '0',
            latestFinished: null,
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      expect(result.nodeExecutions.data[0]?.error).toEqual({
        code: 'HTTP_ERROR',
        message: 'auth failed: ***',
      });
    });

    /**
     * **`error` 만 고쳐 두고 `outputData` 를 빼놓던 자리** (§R17 잔여 ② 부분 해소).
     *
     * 위 `error` 테스트가 초록이라 이 표면이 "마스킹된다" 고 읽히기 쉬웠지만, 같은 DTO 의
     * `outputData` 는 원문이었다. 이 컨트롤러의 노출 인구는 위 `error` 와 **똑같다**
     * (`@Roles` 없음).
     *
     * **노드 레벨이라 `inputData` 도 마스킹 대상**이다 — 재제출 카브아웃은 `Execution`
     * 레벨 한정이었고(2026-08-20 폐지), 이 표면엔 애초에 재제출 소비처가 없다.
     */
    it('body nodeExecutions[] 의 inputData·outputData 를 모두 마스킹한다', async () => {
      const bgNode = makeBgNodeExec();
      const leaky = makeBodyNodeExec({
        id: 'body-data-leak',
        status: NodeExecutionStatus.FAILED,
        error: null,
        inputData: { note: 'postgres://admin:pw@db.internal/prod' },
        outputData: { body: 'upstream said Bearer sk-live-abc123' },
      });

      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([leaky]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '1',
            pending: '0',
            running: '0',
            completed: '0',
            failed: '1',
            skipped: '0',
            waiting: '0',
            latestFinished: null,
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      // **필드별로 나눠서 잰다** (`17_38_33` testing W4). 종전엔 노드 전체를 한 문자열로
      // 합쳐 `toContain('***')` 를 하나만 뒀는데, 그러면 `outputData` 쪽 마스킹만으로
      // 통과해 `inputData` 가 비거나 `null` 로 떨어지는 회귀를 못 잡는다 — 자매 파일
      // (`executions.service.spec.ts` ①②⑥⑧⑧-b)에서 뮤테이션으로 잡아 고친 바로 그
      // 결함 클래스가 여기 남아 있었다.
      const outStr = JSON.stringify(result.nodeExecutions.data[0]?.outputData);
      const inStr = JSON.stringify(result.nodeExecutions.data[0]?.inputData);
      expect(outStr).not.toContain('sk-live-abc123');
      expect(outStr).toContain('***');
      // `inputData` 도 마스킹 — 2026-08-20 부터 Execution 레벨도 같은 규칙이다.
      expect(inStr).not.toContain('admin:pw');
      expect(inStr).toContain('***');
    });

    /**
     * **ingestion 마커 보존 캐너리** (`23_50_03` testing W4) — 자매 표면
     * (`ExecutionsService` ⑥ · `redact-stored-error.spec.ts`)에는 있는데 여기만 없었다.
     * 이 호출부가 다른 마스킹 함수로 바뀌면 12-webhook §5.3 계약이 조용히 깨진다.
     *
     * > **`inputData` 표면은 뒤늦게 붙었다** (`16_51_19` testing W1). 자매인
     * > `ExecutionsService` ⑥ 을 카브아웃 폐지에 맞춰 `inputData` 로 확장하면서 **노드
     * > 레벨인 여기는 빼먹었다** — 이 저장소가 반복해 겪는 *"자매 중 하나만"* 이 같은
     * > 작업 안에서 또 나온 것이다. 두 표면 모두 같은 §5.3 계약을 진다.
     */
    it('body nodeExecutions[] 의 `[REDACTED]` 마커를 두 표면 모두에서 덮지 않는다', async () => {
      const bgNode = makeBgNodeExec();
      const marked = makeBodyNodeExec({
        id: 'body-marker',
        error: null,
        inputData: {
          headers: {
            authorization: '[REDACTED]',
            'content-type': 'application/json',
          },
        },
        outputData: {
          request: {
            headers: {
              authorization: '[REDACTED]',
              'content-type': 'application/json',
            },
          },
        },
      });

      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([marked]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '1',
            pending: '0',
            running: '0',
            completed: '1',
            failed: '0',
            skipped: '0',
            waiting: '0',
            latestFinished: null,
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      const headers = (
        result.nodeExecutions.data[0]?.outputData as {
          request: { headers: Record<string, string> };
        }
      ).request.headers;
      expect(headers.authorization).toBe('[REDACTED]');
      expect(headers['content-type']).toBe('application/json');

      // `inputData` 표면 — 카브아웃 폐지로 이쪽도 같은 관문을 지난다.
      const inHeaders = (
        result.nodeExecutions.data[0]?.inputData as {
          headers: Record<string, string>;
        }
      ).headers;
      expect(inHeaders.authorization).toBe('[REDACTED]');
      expect(inHeaders['content-type']).toBe('application/json');
    });

    /**
     * 자매 스위트(`executions.service.spec.ts`)에는 `error: null` 통과 케이스가 있는데
     * 이쪽에는 없어 **대칭이 깨져 있었다**(`18_14_50` testing INFO). 마스킹이 `null` 을
     * 엉뚱한 값(빈 객체 등)으로 바꾸는 회귀를 이 표면에서도 잡는다.
     */
    it('error 가 null 이면 null 그대로 통과시킨다 (형태 변경 없음)', async () => {
      const bgNode = makeBgNodeExec();
      const clean = makeBodyNodeExec({ id: 'body-clean', error: null });

      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([clean]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '1',
            pending: '0',
            running: '0',
            completed: '1',
            failed: '0',
            skipped: '0',
            waiting: '0',
            latestFinished: null,
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      expect(result.nodeExecutions.data[0]?.error).toBeNull();
    });

    it('returns completed status when all body nodes finished', async () => {
      const bgNode = makeBgNodeExec();
      const body1 = makeBodyNodeExec({ id: 'b1' });
      const body2 = makeBodyNodeExec({
        id: 'b2',
        status: NodeExecutionStatus.SKIPPED,
      });
      const latestFinished = new Date('2026-05-15T05:04:50.000Z');

      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([body1, body2]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '2',
            pending: '0',
            running: '0',
            completed: '1',
            failed: '0',
            skipped: '1',
            waiting: '0',
            latestFinished,
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBe(latestFinished.toISOString());
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('returns running status when at least one body node is waiting_for_input (W-21)', async () => {
      const bgNode = makeBgNodeExec();
      const body1 = makeBodyNodeExec({ id: 'b1' });
      const body2 = makeBodyNodeExec({
        id: 'b2',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        finishedAt: null,
        durationMs: null,
      });

      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([body1, body2]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '2',
            pending: '0',
            running: '0',
            completed: '1',
            failed: '0',
            skipped: '0',
            waiting: '1',
            latestFinished: null,
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      expect(result.status).toBe('running');
      expect(result.completedAt).toBeNull();
    });

    it('returns failed status when any body node failed', async () => {
      const bgNode = makeBgNodeExec();
      const body1 = makeBodyNodeExec({ id: 'b1' });
      const body2 = makeBodyNodeExec({
        id: 'b2',
        status: NodeExecutionStatus.FAILED,
      });

      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([body1, body2]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '2',
            pending: '0',
            running: '0',
            completed: '1',
            failed: '1',
            skipped: '0',
            waiting: '0',
            latestFinished: new Date('2026-05-15T05:04:50.000Z'),
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      expect(result.status).toBe('failed');
    });

    it('returns pending status when no body NodeExecution exists yet', async () => {
      const bgNode = makeBgNodeExec();
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '0',
            pending: '0',
            running: '0',
            completed: '0',
            failed: '0',
            skipped: '0',
            waiting: '0',
            latestFinished: null,
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      expect(result.status).toBe('pending');
      expect(result.nodeExecutions.data).toEqual([]);
    });

    it('throws NotFound when execution is from a different workspace (IDOR block)', async () => {
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-OTHER'),
      );

      await expect(
        service.getBackgroundRun('exec-1', 'bg-run-id', baseQuery, 'ws-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when execution does not exist', async () => {
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB(null),
      );

      await expect(
        service.getBackgroundRun('exec-1', 'bg-run-id', baseQuery, 'ws-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when backgroundRunId is not in this execution', async () => {
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder.mockReturnValueOnce(
        buildBgNodeExecQB(null),
      );

      await expect(
        service.getBackgroundRun('exec-1', 'bg-run-id', baseQuery, 'ws-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('paginates via cursor when more than limit rows exist', async () => {
      const bgNode = makeBgNodeExec();
      // limit=2, fetch returns 3 → hasMore=true
      const rows = [
        makeBodyNodeExec({ id: 'b1' }),
        makeBodyNodeExec({ id: 'b2' }),
        makeBodyNodeExec({ id: 'b3' }),
      ];

      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB(rows))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '3',
            pending: '0',
            running: '0',
            completed: '3',
            failed: '0',
            skipped: '0',
            waiting: '0',
            latestFinished: new Date('2026-05-15T05:04:50.000Z'),
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        { limit: 2 },
        'ws-1',
      );

      expect(result.nodeExecutions.data).toHaveLength(2);
      expect(result.nodeExecutions.hasMore).toBe(true);
      expect(result.nodeExecutions.nextCursor).toBeTruthy();
      // cursor is opaque but must decode to {s, i}
      const decoded = JSON.parse(
        Buffer.from(result.nodeExecutions.nextCursor!, 'base64').toString(
          'utf8',
        ),
      ) as { s: string; i: string };
      expect(decoded.i).toBe('b2');
    });

    it('rejects invalid cursor', async () => {
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );

      await expect(
        service.getBackgroundRun(
          'exec-1',
          'bg-run-id',
          { cursor: 'not-base64!@#' },
          'ws-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('i 성분이 UUID 가 아니면 400 INVALID_CURSOR (22P02 → 500 마스킹 방지)', async () => {
      // `ne.id` 는 `uuid` 컬럼이라 파싱 불가 값이 바인딩되면 Postgres 가 SQLSTATE 22P02 로
      // 거부하는데, `GlobalExceptionFilter` 에 그 분기가 없어 **500 INTERNAL_ERROR 로
      // 마스킹**된다. 이 디코더는 형태·날짜를 이미 검증하므로 **`i` 만 빠져 있었다** —
      // base64·JSON·날짜가 전부 멀쩡한 커서로 5xx 를 만들 수 있었다.
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      const cursor = Buffer.from(
        JSON.stringify({ s: '2026-05-01T00:00:00.000Z', i: 'not-a-uuid' }),
        'utf8',
      ).toString('base64');

      // **클래스만 보지 않는다** — 인접 가드(소유권·limit)도 같은 400 을 내므로,
      // 무엇이 거부했는지까지 단언해야 대조군이 조용히 흡수되지 않는다.
      await expect(
        service.getBackgroundRun('exec-1', 'bg-run-id', { cursor }, 'ws-1'),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CURSOR' },
      });
    });

    it('[대조군] 유효한 커서는 완주하고 그 id 로 필터링한다 (nil UUID — 엄격한 술어 금지)', async () => {
      // **두 가지를 한 번에 고정한다.**
      //
      // 1. `isValidUuid`(RFC v1–v5)로 조이면 Postgres 가 **정상 조회하는** 커서를 거부한다
      //    (`spec/data-flow/12-workspace.md §"UUID 검증 강도 비대칭"`) — 그래서 fixture 가
      //    **nil UUID** 다. 술어를 바꾸면 RED.
      // 2. 유효한 커서가 실제로 `fetchBodyPage` 의 `lastId` 까지 도달하는가. 이 describe 에는
      //    **유효 커서를 넣는 테스트가 없었다**(`lastId` grep 0건) — 인코딩 쪽만 검증됐다.
      //    첫 판본은 mock 체인을 다 세우지 않아 완주를 단언하지 못했는데, 그러면 *"조건이
      //    뒤집혀도 못 잡는다"* 는 지적의 절반이 실제로 맞게 된다
      //    (`review/code/2026/09/12/23_19_03` testing WARNING).
      const NIL_UUID = '00000000-0000-0000-0000-000000000000';
      const bgNode = makeBgNodeExec();
      const bodyPageQB = buildBodyPageQB([makeBodyNodeExec({ id: 'b9' })]);

      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(bodyPageQB)
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '1',
            pending: '0',
            running: '0',
            completed: '1',
            failed: '0',
            skipped: '0',
            waiting: '0',
            latestFinished: new Date('2026-05-15T05:04:50.000Z'),
          }),
        );

      const cursor = Buffer.from(
        JSON.stringify({ s: '2026-05-01T00:00:00.000Z', i: NIL_UUID }),
        'utf8',
      ).toString('base64');

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        { cursor },
        'ws-1',
      );

      expect(result.nodeExecutions.data).toHaveLength(1);
      // 커서가 **소비됐다** — 조건이 뒤집히면 `INVALID_CURSOR` 로 던져 여기 못 온다.
      expect(bodyPageQB.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ne.id > :lastId'),
        expect.objectContaining({ lastId: NIL_UUID }),
      );
    });

    it('rejects out-of-range limit', async () => {
      await expect(
        service.getBackgroundRun('exec-1', 'bg-run-id', { limit: 999 }, 'ws-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('falls back to NodeExecution.startedAt when meta.forkedAt is missing', async () => {
      const bgNode = makeBgNodeExec({
        outputData: { meta: { backgroundRunId: 'bg-run-id' } }, // no forkedAt
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '0',
            pending: '0',
            running: '0',
            completed: '0',
            failed: '0',
            skipped: '0',
            waiting: '0',
            latestFinished: null,
          }),
        );

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      expect(result.startedAt).toBe(bgNode.startedAt.toISOString());
    });

    it('includes notifications when resourceType=background_run rows exist', async () => {
      const bgNode = makeBgNodeExec();
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildOwnershipQB('ws-1'),
      );
      nodeExecutionRepo.createQueryBuilder
        .mockReturnValueOnce(buildBgNodeExecQB(bgNode))
        .mockReturnValueOnce(buildBodyPageQB([]))
        .mockReturnValueOnce(
          buildAggregateQB({
            total: '0',
            pending: '0',
            running: '0',
            completed: '0',
            failed: '0',
            skipped: '0',
            waiting: '0',
            latestFinished: null,
          }),
        );
      notificationsService.findByBackgroundRun.mockResolvedValueOnce([
        {
          id: 'n1',
          type: 'background_failed',
          title: 'Background 본문 실패',
          message: 'failed: oops',
          channel: 'in_app',
          createdAt: new Date('2026-05-15T05:04:50.000Z'),
        },
      ]);

      const result = await service.getBackgroundRun(
        'exec-1',
        'bg-run-id',
        baseQuery,
        'ws-1',
      );

      expect(notificationsService.findByBackgroundRun).toHaveBeenCalledWith(
        'bg-run-id',
      );
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.type).toBe('background_failed');
    });
  });

  describe('verifyBackgroundRunOwnership', () => {
    const buildVerifyQB = (workspaceId: string | null) => {
      const qb: Record<string, jest.Mock> = {};
      qb.innerJoin = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.select = jest.fn().mockReturnValue(qb);
      qb.getRawOne = jest
        .fn()
        .mockResolvedValue(workspaceId ? { workspaceId } : null);
      return qb;
    };

    it('returns true when workspace matches', async () => {
      nodeExecutionRepo.createQueryBuilder.mockReturnValueOnce(
        buildVerifyQB('ws-1'),
      );
      await expect(
        service.verifyBackgroundRunOwnership('bg-run-id', 'ws-1'),
      ).resolves.toBe(true);
    });

    it('returns false when workspace differs', async () => {
      nodeExecutionRepo.createQueryBuilder.mockReturnValueOnce(
        buildVerifyQB('ws-OTHER'),
      );
      await expect(
        service.verifyBackgroundRunOwnership('bg-run-id', 'ws-1'),
      ).resolves.toBe(false);
    });

    it('returns false when row not found (channel hijack attempt)', async () => {
      nodeExecutionRepo.createQueryBuilder.mockReturnValueOnce(
        buildVerifyQB(null),
      );
      await expect(
        service.verifyBackgroundRunOwnership('nonexistent', 'ws-1'),
      ).resolves.toBe(false);
    });

    it('returns false on missing inputs', async () => {
      await expect(
        service.verifyBackgroundRunOwnership('', 'ws-1'),
      ).resolves.toBe(false);
      await expect(
        service.verifyBackgroundRunOwnership('bg-run-id', ''),
      ).resolves.toBe(false);
    });
  });
});
