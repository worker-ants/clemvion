import { ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { NOT_A_MEMBER } from '../../common/constants/workspace-roles';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';

/** {@link lockForIntegrationWrite} 의 판정. 거절 응답은 경로마다 다르므로 호출부가 정한다. */
export type IntegrationWriteLock =
  'ok' | 'workspace_absent' | 'owner_not_member';

/**
 * 통합 행을 만들거나 개인으로 바꾸는 쓰기의 잠금 도우미. 트랜잭션의 첫 문장으로 부르고 통합 행을 다루기 전에 끝낸다.
 *
 * 1. 워크스페이스 행을 `FOR KEY SHARE` 로 읽는다. 통합 INSERT 의 FK 확인도 같은 잠금을 잡는데, 통합 행을 잠근 뒤에
 *    그것이 오면 워크스페이스 삭제 · 소유자 이양(워크스페이스 → 멤버십 순)과 순서가 엇갈려 교착(`40P01`)이 난다. 그래서
 *    공개 범위와 관계없이 먼저 잡는다.
 * 2. 개인 통합이면 통합 소유자가 될 사람의 멤버십 행을 `FOR SHARE` 로 읽는다. 라우트 가드가 멤버십을 확인한 뒤 그 사람이
 *    나가거나 제거될 수 있다. 나가기 · 제거가 먼저 잠갔으면 커밋을 기다린 뒤 행이 없어 `owner_not_member` 다. 이 쪽이 먼저
 *    잠갔으면 멤버십 삭제가 이 트랜잭션의 커밋을 기다리고, 그 뒤의 통합 삭제가 여기서 만든 행까지 지운다(READ COMMITTED).
 *    멤버십이 있는지만 본다. 역할은 라우트 가드가 본다. 근거는 노드 사용 판정의 `ownerIsMember` 와 같은 `workspace_member`
 *    행 존재다.
 *
 * 잠금을 쥔 동안 외부 호출(토큰 교환, 연결 테스트, 제공자 API)을 하지 않는다. 쓰기 경로가 이 도우미를 건너뛰지 않는지는
 * `repo-guards` 의 `integration-owner-write-guard` 가 본다.
 * 근거: [통합 관리 Rationale 「나간 멤버의 개인 통합은 나갈 때 지운다」](CLE-INT-MANAGE#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29)
 */
export async function lockForIntegrationWrite(
  manager: EntityManager,
  target: { workspaceId: string; personalOwnerId: string | null },
): Promise<IntegrationWriteLock> {
  const workspace = await manager.findOne(Workspace, {
    where: { id: target.workspaceId },
    select: { id: true },
    lock: { mode: 'for_key_share' },
  });
  if (!workspace) return 'workspace_absent';
  if (target.personalOwnerId === null) return 'ok';
  const membership = await manager.findOne(WorkspaceMember, {
    where: { workspaceId: target.workspaceId, userId: target.personalOwnerId },
    select: { id: true },
    lock: { mode: 'pessimistic_read' },
  });
  return membership ? 'ok' : 'owner_not_member';
}

/**
 * 통합 행을 만드는 경로(통합 생성, Cafe24 Private · MakeShop begin 의 설치 대기 행)의 거절. 멤버십이 없으면 403
 * `NOT_A_MEMBER` 다(REQ-INTMGMT-066). 워크스페이스가 그 사이 지워졌어도 같은 응답이다. 워크스페이스 삭제가 멤버십을 함께
 * 지우므로 라우트 가드가 지금 판정해도 같은 코드를 낸다.
 */
export function throwUnlessIntegrationCreateLocked(
  lock: IntegrationWriteLock,
): void {
  if (lock !== 'ok') throw new ForbiddenException({ ...NOT_A_MEMBER });
}
