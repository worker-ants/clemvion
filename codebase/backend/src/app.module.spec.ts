import { ROOT_ENTITIES } from './app.module';

// 모듈 단위 forFeature 에서 사용 중인 entity 들. 새 entity 를 도메인
// 모듈의 TypeOrmModule.forFeature(...) 에 등록하면 **반드시 본 배열에도
// 추가**한다 — root 등록이 빠지면 `No metadata for "<EntityName>" was
// found` 회귀가 발생 (PR-B Part A 의 ExecutionNodeLog 사례).
//
// import 경로는 entity 정의 파일을 그대로 따른다 — 본 spec 의 동치성은
// "forFeature 로 inject 되는 모든 entity 가 root entities 에 포함" 임을
// 강제하므로, manual 추가가 진실의 단일 공급원이다.
import { User } from './modules/users/entities/user.entity';
import { Workspace } from './modules/workspaces/entities/workspace.entity';
import { WorkspaceMember } from './modules/workspaces/entities/workspace-member.entity';
import { WorkspaceInvitation } from './modules/workspaces/entities/workspace-invitation.entity';
import { Workflow } from './modules/workflows/entities/workflow.entity';
import { Folder } from './modules/folders/entities/folder.entity';
import { Node } from './modules/nodes/entities/node.entity';
import { Edge } from './modules/edges/entities/edge.entity';
import { Trigger } from './modules/triggers/entities/trigger.entity';
import { Schedule } from './modules/schedules/entities/schedule.entity';
import { Integration } from './modules/integrations/entities/integration.entity';
import { IntegrationUsageLog } from './modules/integrations/entities/integration-usage-log.entity';
import { IntegrationOAuthState } from './modules/integrations/entities/integration-oauth-state.entity';
import { IntegrationOAuthPreview } from './modules/integrations/entities/integration-oauth-preview.entity';
import { IntegrationExpiryDispatch } from './modules/integrations/entities/integration-expiry-dispatch.entity';
import { AuthConfig } from './modules/auth-configs/entities/auth-config.entity';
import { Execution } from './modules/executions/entities/execution.entity';
import { NodeExecution } from './modules/node-executions/entities/node-execution.entity';
import { ExecutionNodeLog } from './modules/execution-engine/entities/execution-node-log.entity';
import { WorkflowVersion } from './modules/workflow-versions/entities/workflow-version.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { AuditLog } from './modules/audit-logs/entities/audit-log.entity';
import { RefreshToken } from './modules/auth/entities/refresh-token.entity';
import { AuthOAuthState } from './modules/auth/entities/auth-oauth-state.entity';
import { LoginHistory } from './modules/auth/entities/login-history.entity';
import { WebAuthnCredential } from './modules/auth/entities/webauthn-credential.entity';
import { LlmConfig } from './modules/llm-config/entities/llm-config.entity';
import { LlmUsageLog } from './modules/llm/entities/llm-usage-log.entity';
import { KnowledgeBase } from './modules/knowledge-base/entities/knowledge-base.entity';
import { Document } from './modules/knowledge-base/entities/document.entity';
import { DocumentChunk } from './modules/knowledge-base/entities/document-chunk.entity';
import { GraphEntity } from './modules/knowledge-base/entities/entity.entity';
import { GraphRelation } from './modules/knowledge-base/entities/relation.entity';
import { GraphChunkEntity } from './modules/knowledge-base/entities/chunk-entity.entity';
import { AlertRule } from './modules/alerts/entities/alert-rule.entity';
import { WorkflowAssistantSession } from './modules/workflow-assistant/entities/workflow-assistant-session.entity';
import { WorkflowAssistantMessage } from './modules/workflow-assistant/entities/workflow-assistant-message.entity';

const REQUIRED_ENTITIES = [
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
  Workflow,
  Folder,
  Node,
  Edge,
  Trigger,
  Schedule,
  Integration,
  IntegrationUsageLog,
  IntegrationOAuthState,
  IntegrationOAuthPreview,
  IntegrationExpiryDispatch,
  AuthConfig,
  Execution,
  NodeExecution,
  ExecutionNodeLog,
  WorkflowVersion,
  Notification,
  AuditLog,
  RefreshToken,
  AuthOAuthState,
  LoginHistory,
  WebAuthnCredential,
  LlmConfig,
  LlmUsageLog,
  KnowledgeBase,
  Document,
  DocumentChunk,
  GraphEntity,
  GraphRelation,
  GraphChunkEntity,
  AlertRule,
  WorkflowAssistantSession,
  WorkflowAssistantMessage,
];

describe('AppModule — root entities registration guard', () => {
  // PR-B Part A 회귀 (ExecutionNodeLog 누락) 의 재발 방지 가드. forFeature
  // 로 등록된 entity 가 root TypeOrmModule.forRootAsync entities 에 빠지면
  // NestJS 의 InjectRepository resolution 시점에 `No metadata for "X" was
  // found` 에러가 발생한다. 본 spec 은 build·CI 파이프라인에서 missing 을
  // 즉시 감지한다 (lint 대안 — 사용자 결정).
  it.each(REQUIRED_ENTITIES.map((e) => [e.name, e] as const))(
    '%s 가 ROOT_ENTITIES 에 등록되어 있다',
    (_name, entity) => {
      expect(ROOT_ENTITIES).toContain(entity);
    },
  );

  it('ROOT_ENTITIES 와 REQUIRED_ENTITIES 의 cardinality 가 일치한다 (drift 차단)', () => {
    // 한쪽에만 추가하고 다른 쪽 갱신을 빠뜨리는 회귀 차단.
    expect(new Set(ROOT_ENTITIES).size).toBe(REQUIRED_ENTITIES.length);
  });
});
