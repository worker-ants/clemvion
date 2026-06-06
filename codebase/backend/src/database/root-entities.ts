import { AlertRule } from '../modules/alerts/entities/alert-rule.entity';
import { User } from '../modules/users/entities/user.entity';
import { Workspace } from '../modules/workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../modules/workspaces/entities/workspace-member.entity';
import { WorkspaceInvitation } from '../modules/workspaces/entities/workspace-invitation.entity';
import { Workflow } from '../modules/workflows/entities/workflow.entity';
import { Folder } from '../modules/folders/entities/folder.entity';
import { Node } from '../modules/nodes/entities/node.entity';
import { Edge } from '../modules/edges/entities/edge.entity';
import { Trigger } from '../modules/triggers/entities/trigger.entity';
import { Schedule } from '../modules/schedules/entities/schedule.entity';
import { Integration } from '../modules/integrations/entities/integration.entity';
import { IntegrationUsageLog } from '../modules/integrations/entities/integration-usage-log.entity';
import { IntegrationOAuthState } from '../modules/integrations/entities/integration-oauth-state.entity';
import { IntegrationOAuthPreview } from '../modules/integrations/entities/integration-oauth-preview.entity';
import { IntegrationExpiryDispatch } from '../modules/integrations/entities/integration-expiry-dispatch.entity';
import { AuthConfig } from '../modules/auth-configs/entities/auth-config.entity';
import { Execution } from '../modules/executions/entities/execution.entity';
import { ExecutionToken } from '../modules/external-interaction/entities/execution-token.entity';
import { NodeExecution } from '../modules/node-executions/entities/node-execution.entity';
import { ExecutionNodeLog } from '../modules/execution-engine/entities/execution-node-log.entity';
import { WorkflowVersion } from '../modules/workflow-versions/entities/workflow-version.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { AuditLog } from '../modules/audit-logs/entities/audit-log.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { AuthOAuthState } from '../modules/auth/entities/auth-oauth-state.entity';
import { LoginHistory } from '../modules/auth/entities/login-history.entity';
import { WebAuthnCredential } from '../modules/auth/webauthn/entities/webauthn-credential.entity';
import { LlmConfig } from '../modules/llm-config/entities/llm-config.entity';
import { RerankConfig } from '../modules/rerank-config/entities/rerank-config.entity';
import { LlmUsageLog } from '../modules/llm/entities/llm-usage-log.entity';
import { KnowledgeBase } from '../modules/knowledge-base/entities/knowledge-base.entity';
import { Document } from '../modules/knowledge-base/entities/document.entity';
import { DocumentChunk } from '../modules/knowledge-base/entities/document-chunk.entity';
import { GraphEntity } from '../modules/knowledge-base/entities/entity.entity';
import { GraphRelation } from '../modules/knowledge-base/entities/relation.entity';
import { GraphChunkEntity } from '../modules/knowledge-base/entities/chunk-entity.entity';
import { WorkflowAssistantSession } from '../modules/workflow-assistant/entities/workflow-assistant-session.entity';
import { WorkflowAssistantMessage } from '../modules/workflow-assistant/entities/workflow-assistant-message.entity';
import { SecretStore } from '../modules/secret-store/entities/secret-store.entity';
import { AgentMemory } from '../modules/agent-memory/entities/agent-memory.entity';

/**
 * TypeORM root metadata 등록 대상. forFeature 로 module 이 Repository 를
 * inject 받으려면 본 배열에도 entity 가 있어야 한다 (`autoLoadEntities`
 * 미사용 정책). 새 entity 를 forFeature 에 등록하면 본 배열과
 * `app.module.spec.ts` 의 REQUIRED 목록 두 곳을 함께 갱신한다 — 누락 시
 * `No metadata for "<EntityName>" was found` 회귀 발생.
 *
 * app.module 과 별도 파일로 분리한 이유: eval CLI 모듈(`eval-cli.module.ts`)
 * 같은 경량 부트스트랩이 전체 `app.module`(노드 핸들러까지 transitive import)
 * 을 끌어오지 않고 이 entity 목록만 재사용할 수 있게 하기 위함. app.module 은
 * 이 배열을 re-export 하여 기존 `ROOT_ENTITIES` import 사이트 호환을 유지한다.
 */
export const ROOT_ENTITIES = [
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
  ExecutionToken,
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
  RerankConfig,
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
  SecretStore,
  AgentMemory,
] as const;
