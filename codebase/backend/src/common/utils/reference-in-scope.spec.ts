import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import {
  assertReferenceInScope,
  throwInvalidReferences,
} from './reference-in-scope';

type Row = { id: string; workspaceId: string };

const repoWith = (found: boolean) =>
  ({
    exists: jest.fn().mockResolvedValue(found),
  }) as unknown as Repository<Row> & {
    exists: jest.Mock;
  };

describe('throwInvalidReferences', () => {
  it('400 VALIDATION_ERROR + details 배열(파이프와 같은 항목 모양)', () => {
    let caught: unknown;
    try {
      throwInvalidReferences([
        {
          field: 'nodes[1].containerId',
          message: 'Container node not found in this canvas',
        },
        {
          field: 'edges[0].targetNodeId',
          message: 'Target node not found in this canvas',
        },
      ]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toStrictEqual({
      code: 'VALIDATION_ERROR',
      message:
        'Container node not found in this canvas; Target node not found in this canvas',
      details: [
        {
          field: 'nodes[1].containerId',
          message: 'Container node not found in this canvas',
          code: 'INVALID_FIELD',
        },
        {
          field: 'edges[0].targetNodeId',
          message: 'Target node not found in this canvas',
          code: 'INVALID_FIELD',
        },
      ],
    });
  });
});

describe('assertReferenceInScope', () => {
  const where = { id: 'wf-1', workspaceId: 'ws-1' };

  it('where 를 그대로 exists 에 넘기고, 있으면 통과한다', async () => {
    const repo = repoWith(true);
    await expect(
      assertReferenceInScope(
        repo,
        where,
        'workflowId',
        'Workflow not found in this workspace',
      ),
    ).resolves.toBeUndefined();
    expect(repo.exists).toHaveBeenCalledWith({ where });
  });

  it('없으면 그 필드 하나로 거부한다 — 없는 id 와 남의 id 를 구분하지 않는다', async () => {
    const err = await assertReferenceInScope(
      repoWith(false),
      where,
      'workflowId',
      'Workflow not found in this workspace',
    ).catch((err_: unknown) => err_);
    expect((err as BadRequestException).getResponse()).toStrictEqual({
      code: 'VALIDATION_ERROR',
      message: 'Workflow not found in this workspace',
      details: [
        {
          field: 'workflowId',
          message: 'Workflow not found in this workspace',
          code: 'INVALID_FIELD',
        },
      ],
    });
  });
});
