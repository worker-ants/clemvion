import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import type { Client } from 'pg';

/**
 * Chat-channel e2e fixture 공용 헬퍼. Slack/Discord e2e spec 두 파일이
 * 거의 동일한 user/workspace/workflow/trigger INSERT 패턴을 병렬 유지하던
 * 중복을 단일 위치로 통합. 본 함수가 SoT 이며, 향후 user/workflow/trigger
 * schema 가 갱신될 때 변경 면적을 1곳으로 제한한다. 사용자 · 워크스페이스를 직접 만드는
 * spec 은 workflow · trigger 행만 `insertWorkflowRow` · `insertChatChannelTriggerRow` 로 넣는다.
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
 * - Telegram: trigger.config 에 `inboundSigningRef` 미설정 — secret_token 검증을 건너뛴다.
 *   인입 흐름(대화 상태 · 실행 시작)을 보는 e2e 가 쓴다.
 */
export async function setupChatChannelTrigger(args: {
  db: Client;
  provider: 'slack' | 'discord' | 'telegram';
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
      `${provider.charAt(0).toUpperCase()}${provider.slice(1)} E2E`,
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

  const workflowId = await insertWorkflowRow(db, {
    workspaceId,
    userId,
    name: `${slug}-e2e-wf`,
  });
  const { triggerId, endpointPath } = await insertChatChannelTriggerRow(db, {
    workspaceId,
    workflowId,
    name: `${slug}-e2e-trigger`,
    provider,
  });

  return { workspaceId, workflowId, triggerId, userId, endpointPath };
}

/** 켜진 워크플로우 행 하나를 넣고 id 를 돌려준다. 노드는 넣지 않는다. */
export async function insertWorkflowRow(
  db: Client,
  args: { workspaceId: string; userId: string; name: string },
): Promise<string> {
  const workflowId = randomUUID();
  await db.query(
    `INSERT INTO workflow (id, name, workspace_id, is_active, current_version, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, true, 1, $4, NOW(), NOW())`,
    [workflowId, args.name, args.workspaceId, args.userId],
  );
  return workflowId;
}

/**
 * webhook 트리거 행 하나를 넣는다. `chat_channel_health` 는 `'unknown'` 이다.
 * `provider` 가 `null` 이면 채팅 채널 설정 없이 넣는다. 서버를 거치지 않으므로 외부 채널 등록도,
 * listener 레지스트리 등록도 일어나지 않는다. Provider 별 `inboundSigningRef` 는
 * `setupChatChannelTrigger` 머리 주석과 같다.
 */
export async function insertChatChannelTriggerRow(
  db: Client,
  args: {
    workspaceId: string;
    workflowId: string;
    name: string;
    provider: 'slack' | 'discord' | 'telegram' | null;
    isActive?: boolean;
  },
): Promise<{ triggerId: string; endpointPath: string }> {
  const { provider, isActive = true } = args;
  const triggerId = randomUUID();
  // endpoint_path 는 v4 UUID 형식 강제(WH-MG-02, DB CHECK chk_trigger_endpoint_path_uuid).
  // 직접 INSERT 도 제약을 받으므로 라우팅 키는 UUID 로 발급한다(slug 가독성 라벨은 trigger name 으로만).
  const endpointPath = randomUUID();

  let config: Record<string, unknown> = {};
  if (provider !== null) {
    const chatChannelConfig: Record<string, unknown> = {
      provider,
      botTokenRef: `secret://triggers/${triggerId}/bot-token`,
    };
    if (provider === 'slack') {
      chatChannelConfig.inboundSigningRef = `secret://triggers/${triggerId}/inbound-signing`;
    }
    // Discord · Telegram 은 inboundSigningRef 를 의도적으로 비운다 — signing skip path 검증.
    config = { chatChannel: chatChannelConfig };
  }

  await db.query(
    `INSERT INTO trigger
       (id, workspace_id, workflow_id, type, name, endpoint_path, is_active, config,
        chat_channel_health, created_at, updated_at)
     VALUES ($1, $2, $3, 'webhook', $4, $5, $6, $7::jsonb, 'unknown', NOW(), NOW())`,
    [
      triggerId,
      args.workspaceId,
      args.workflowId,
      args.name,
      endpointPath,
      isActive,
      JSON.stringify(config),
    ],
  );
  return { triggerId, endpointPath };
}
