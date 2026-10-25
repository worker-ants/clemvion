import type { Logger } from '@nestjs/common';
import { throwInvalidReferences } from '../../common/utils/reference-in-scope';
import {
  type NodeIntegrationRef,
  type StoredNodeConfig,
  changedNodeIntegrationRefs,
  clearNodeIntegrationRefs,
} from './node-integration-refs';
import {
  type PersonalIntegrationUseFacts,
  isPersonalIntegration,
  judgePersonalIntegrationUse,
} from './personal-integration-use';
import {
  type IntegrationRefRow,
  type SqlRunner,
  loadIntegrationRefRows,
  loadWorkspaceMemberIds,
  logPersonalIntegrationUseRejection,
} from './personal-integration-use-facts';

/*
 * 저장 · 복제 · 가져오기 · 버전 복원에서 노드 `config` 의 통합 참조를 판정한다(CLE-PLAT-DATA 「참조의 소속」, CLE-INT-MANAGE
 * 「개인 통합 사용 판정」). 통과하지 못한 참조를 돌려주고, 거절할지 비울지는 부르는 쪽이 경로에 따라 정한다.
 *
 * 통과하지 못하는 참조는 워크스페이스에 없는 통합(다른 워크스페이스 통합 포함), 문자열이 아닌 값, 판정을 통과하지 못한 개인 통합이다.
 * 셋을 구분해 돌려주지 않는다. 응답에서 없는 통합과 남의 개인 통합이 구분되면 안 된다. 표현식 참조는 판정하지 않는다.
 */

/** 경로 종류와 그 경로만 가진 사실. 복제 · 가져오기는 요청자가 작성자라서 따로 받지 않는다. */
export type IntegrationRefCheckPath =
  { path: 'save'; saverId: string } | { path: 'clone' } | { path: 'restore' };

export interface IntegrationRefCandidate {
  /** 로그에 남길 노드 id. 캔버스 저장의 새 노드는 요청이 보낸 id 이고 복제 · 가져오기는 새로 발급한 id 다. */
  nodeId: string | null;
  ref: NodeIntegrationRef;
}

function factsFor(
  check: IntegrationRefCheckPath,
  common: { integrationOwnerId: string; workflowAuthorId: string | null },
  memberIds: ReadonlySet<string>,
): PersonalIntegrationUseFacts {
  switch (check.path) {
    case 'save':
      return { ...common, path: 'save', saverId: check.saverId };
    case 'clone':
      return { ...common, path: 'clone' };
    case 'restore':
      return {
        ...common,
        path: 'restore',
        ownerIsMember: memberIds.has(common.integrationOwnerId),
      };
  }
}

/**
 * `candidates` 가운데 그 경로에서 쓸 수 없는 참조를 순서대로 돌려준다. 쿼리는 `runner` 로 보낸다. 저장 경로는 워크플로우 행을
 * 잠근 트랜잭션의 EntityManager 를 넘긴다(CLE-WF-DATA 저장 3단계).
 */
export async function findUnusableIntegrationRefs<
  T extends IntegrationRefCandidate,
>(
  runner: SqlRunner,
  logger: Pick<Logger, 'warn'>,
  args: {
    workspaceId: string;
    /** 노드가 속한(복제 · 가져오기는 새로 만드는) 워크플로우의 작성자. */
    workflowAuthorId: string | null;
    check: IntegrationRefCheckPath;
    candidates: readonly T[];
  },
): Promise<T[]> {
  const judged = args.candidates.filter((c) => !c.ref.expression);
  if (judged.length === 0) return [];
  const rows = await loadIntegrationRefRows(
    runner,
    args.workspaceId,
    judged.flatMap((c) => (c.ref.integrationId ? [c.ref.integrationId] : [])),
  );
  const personalOwners = [...rows.values()]
    .filter(isPersonalIntegration)
    .map((row) => row.createdBy);
  const memberIds =
    args.check.path === 'restore' && personalOwners.length > 0
      ? await loadWorkspaceMemberIds(runner, args.workspaceId, personalOwners)
      : new Set<string>();

  const usable = (c: T, row: IntegrationRefRow | undefined): boolean => {
    if (!row) return false;
    if (!isPersonalIntegration(row)) return true;
    const reason = judgePersonalIntegrationUse(
      factsFor(
        args.check,
        {
          integrationOwnerId: row.createdBy,
          workflowAuthorId: args.workflowAuthorId,
        },
        memberIds,
      ),
    );
    if (reason === null) return true;
    logPersonalIntegrationUseRejection(logger, {
      path: args.check.path,
      workspaceId: args.workspaceId,
      nodeId: c.nodeId,
      integrationId: row.id,
      reason,
    });
    return false;
  };

  return judged.filter(
    (c) =>
      !usable(
        c,
        c.ref.integrationId ? rows.get(c.ref.integrationId) : undefined,
      ),
  );
}

/** 판정할 노드 하나. `stored` 는 같은 id 로 저장된 노드이고 없으면 새 노드다(모든 참조가 새 참조). */
export interface NodeRefInput {
  /** 로그 · 응답에 싣는 노드 id. 복제 · 가져오기는 새로 발급한 id 이고, 노드 생성은 저장 전이라 `null` 이다. */
  nodeId: string | null;
  type: string;
  config: unknown;
  stored?: StoredNodeConfig;
}

/** 복제 · 가져오기 · 버전 복원이 비운 참조(응답 `data.clearedIntegrationRefs` 의 원소). 비운 이유는 싣지 않는다. */
export interface ClearedIntegrationRef {
  /** 작업 뒤 노드의 id. */
  nodeId: string;
  nodeLabel: string;
  /** 노드 안의 경로. MCP 서버 항목의 `j` 는 비우기 전 순서다. */
  field: string;
}

export const INTEGRATION_REF_INVALID_MESSAGE = 'Integration not found';

/**
 * 노드 생성 · 수정과 캔버스 저장의 검사(REQ-INTMGMT-054). 새로 넣거나 바꾼 참조 가운데 쓸 수 없는 것을 모두 모아 400
 * `VALIDATION_ERROR`(`details[].code`=`INVALID_FIELD`)로 거절한다. `field` 는 `fieldPrefix` 에 노드 안의 경로를 붙인 값이다
 * (캔버스 저장은 `nodes[i].`, 노드 생성 · 수정은 빈 문자열).
 */
export async function assertNodeIntegrationRefsUsable(
  runner: SqlRunner,
  logger: Pick<Logger, 'warn'>,
  args: {
    workspaceId: string;
    workflowAuthorId: string | null;
    saverId: string;
    nodes: ReadonlyArray<NodeRefInput & { fieldPrefix: string }>;
  },
): Promise<void> {
  const candidates = args.nodes.flatMap((node) =>
    changedNodeIntegrationRefs(node.type, node.config, node.stored).map(
      (ref) => ({
        nodeId: node.nodeId,
        ref,
        field: `${node.fieldPrefix}${ref.field}`,
      }),
    ),
  );
  const unusable = await findUnusableIntegrationRefs(runner, logger, {
    workspaceId: args.workspaceId,
    workflowAuthorId: args.workflowAuthorId,
    check: { path: 'save', saverId: args.saverId },
    candidates,
  });
  if (unusable.length > 0) {
    throwInvalidReferences(
      unusable.map((c) => ({
        field: c.field,
        message: INTEGRATION_REF_INVALID_MESSAGE,
      })),
    );
  }
}

/**
 * 복제 · 가져오기 · 버전 복원의 참조 비우기(REQ-WFLIST-054 · 055, REQ-WFVER-026). 쓸 수 없는 참조를 비운 `config` 를 입력과
 * 같은 순서로 돌려주고 비운 참조를 알린다. 버전 복원은 `stored` 에 지금 노드를 넘겨 지금 노드와 다른 참조만 본다.
 */
export async function clearUnusableNodeIntegrationRefs(
  runner: SqlRunner,
  logger: Pick<Logger, 'warn'>,
  args: {
    workspaceId: string;
    workflowAuthorId: string | null;
    check: { path: 'clone' } | { path: 'restore' };
    nodes: ReadonlyArray<
      NodeRefInput & {
        nodeId: string;
        nodeLabel: string;
        config: Record<string, unknown>;
      }
    >;
  },
): Promise<{
  configs: Record<string, unknown>[];
  cleared: ClearedIntegrationRef[];
}> {
  const candidates = args.nodes.flatMap((node, index) =>
    changedNodeIntegrationRefs(node.type, node.config, node.stored).map(
      (ref) => ({ nodeId: node.nodeId, ref, index }),
    ),
  );
  const unusable = await findUnusableIntegrationRefs(runner, logger, {
    workspaceId: args.workspaceId,
    workflowAuthorId: args.workflowAuthorId,
    check: args.check,
    candidates,
  });
  const fieldsByNode = new Map<number, Set<string>>();
  for (const c of unusable) {
    const fields = fieldsByNode.get(c.index) ?? new Set<string>();
    fields.add(c.ref.field);
    fieldsByNode.set(c.index, fields);
  }
  return {
    configs: args.nodes.map((node, index) =>
      clearNodeIntegrationRefs(
        node.config,
        fieldsByNode.get(index) ?? new Set<string>(),
      ),
    ),
    cleared: unusable.map((c) => ({
      nodeId: c.nodeId,
      nodeLabel: args.nodes[c.index].nodeLabel,
      field: c.ref.field,
    })),
  };
}
