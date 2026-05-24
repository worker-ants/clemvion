import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';

import type { Client } from 'pg';

/**
 * Chat-channel e2e fixture 공용 헬퍼. Slack/Discord e2e spec 두 파일이
 * 거의 동일한 user/workspace/workflow/trigger INSERT 패턴을 병렬 유지하던
 * 중복을 단일 위치로 통합. 본 함수가 SoT 이며, 향후 user/workflow/trigger
 * schema 가 갱신될 때 변경 면적을 1곳으로 제한한다.
 *
 * 보안 노트:
 * - `password_hash` 는 bcrypt 로 실제 해시. round=1 은 e2e 속도 우선 (production
 *   sessions 흐름은 round 12 사용 — `auth/sessions.service.ts`). 본 헬퍼는
 *   테스트 전용으로 production 경로에서 호출 금지.
 * - `ownerEmailVerified` (기본 `true`) 옵션은 chat-channel inbound webhook 의
 *   인가 모델 검증용. inbound 는 public route — trigger.secret 기반 검증만
 *   수행하므로 workspace owner 의 `emailVerified` 와 무관하게 동작한다
 *   (jwt.strategy 가드는 protected API 한정). 이 invariant 의 회귀 차단은
 *   `chat-channel-discord.e2e-spec.ts` 의 "owner.emailVerified=false" 케이스가
 *   담당.
 *
 * Provider 별 기본 동작:
 * - Slack: trigger.config 에 `inboundSigningRef` set — `secret_store` row 가
 *   비어있으면 401 응답하는 signing-required path 검증 대상.
 * - Discord: trigger.config 에 `inboundSigningRef` 미설정 — signing skip
 *   (legacy) path 검증 대상. PR #283 의 v1 결정사항.
 */
export async function setupChatChannelTrigger(args: {
  db: Client;
  provider: 'slack' | 'discord';
  ownerEmailVerified?: boolean;
}): Promise<{
  workspaceId: string;
  workflowId: string;
  triggerId: string;
  userId: string;
  endpointPath: string;
}> {
  const { db, provider, ownerEmailVerified = true } = args;
  const slug = provider;
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const passwordHash = bcrypt.hashSync(
    `e2e-${provider}-${userId.slice(0, 8)}`,
    1,
  );

  await db.query(
    `INSERT INTO "user" (id, email, name, password_hash, email_verified, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [
      userId,
      `${slug}-e2e-${userId.slice(0, 8)}@e2e.local`,
      `${provider === 'slack' ? 'Slack' : 'Discord'} E2E`,
      passwordHash,
      ownerEmailVerified,
    ],
  );

  await db.query(
    `INSERT INTO workspace (id, name, slug, owner_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [
      workspaceId,
      `${slug}-${workspaceId.slice(0, 8)}`,
      `${slug}-${workspaceId.slice(0, 8)}`,
      userId,
    ],
  );

  const workflowId = randomUUID();
  await db.query(
    `INSERT INTO workflow (id, name, workspace_id, is_active, current_version, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, true, 1, $4, NOW(), NOW())`,
    [workflowId, `${slug}-e2e-wf`, workspaceId, userId],
  );

  const triggerId = randomUUID();
  const endpointPath = `${slug}-e2e-${randomBytes(6).toString('hex')}`;

  const chatChannelConfig: Record<string, unknown> = {
    provider,
    botTokenRef: `secret://triggers/${triggerId}/bot-token`,
  };
  if (provider === 'slack') {
    chatChannelConfig.inboundSigningRef = `secret://triggers/${triggerId}/inbound-signing`;
  }
  // Discord 는 inboundSigningRef 의도적으로 비움 — signing skip path 검증.

  await db.query(
    `INSERT INTO trigger
       (id, workspace_id, workflow_id, type, name, endpoint_path, is_active, config,
        chat_channel_health, created_at, updated_at)
     VALUES ($1, $2, $3, 'webhook', $4, $5, true, $6::jsonb, 'unknown', NOW(), NOW())`,
    [
      triggerId,
      workspaceId,
      workflowId,
      `${slug}-e2e-trigger`,
      endpointPath,
      JSON.stringify({ chatChannel: chatChannelConfig }),
    ],
  );

  return { workspaceId, workflowId, triggerId, userId, endpointPath };
}
