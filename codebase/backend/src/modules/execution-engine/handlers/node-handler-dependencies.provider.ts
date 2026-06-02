import { Injectable, Optional } from '@nestjs/common';
import { HandlerDependencies } from '../../../nodes/core/node-component.interface';
import { WorkflowExecutor } from '../../../nodes/core/workflow-executor.interface';
import { LlmService } from '../../llm/llm.service';
import { RagSearchService } from '../../knowledge-base/search/rag-search.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { Cafe24ApiClient } from '../../../nodes/integration/cafe24/cafe24-api.client';
import { ExecutionEventEmitter } from '../events/execution-event-emitter.service';
import { ConversationThreadService } from '../conversation-thread/conversation-thread.service';

/**
 * 노드 핸들러 (`NodeComponentRegistry.bootstrap`) 에 전달되는 런타임 의존성을
 * 한 곳으로 모은 provider.
 *
 * 옛 `ExecutionEngineService` 는 7개 서비스 (`ragSearchService` ·
 * `knowledgeBaseService` · `integrationsService` · `mcpClientService` ·
 * `cafe24ApiClient` · `eventEmitter` · `conversationThreadService`) 를
 * 자기가 직접 주입받아 단순히 `componentRegistry.bootstrap` 한 줄에 forward
 * 하기만 했다. 엔진은 이들 중 일부만 직접 사용하면서도 모두를 들고 있어
 * constructor 가 비대화 됐다 (C-6 strangle step 3).
 *
 * 본 provider 가 그 책임을 캡슐화 — 엔진은 본 provider 만 주입하고
 * `build(workflowExecutor)` 로 `HandlerDependencies` 를 받는다. 핸들러용 deps
 * 추가/제거가 엔진 constructor 시그니처를 건드리지 않게 된다.
 */
@Injectable()
export class NodeHandlerDependenciesProvider {
  constructor(
    private readonly llmService: LlmService,
    private readonly ragSearchService: RagSearchService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly integrationsService: IntegrationsService,
    private readonly mcpClientService: McpClientService,
    private readonly eventEmitter: ExecutionEventEmitter,
    @Optional() private readonly cafe24ApiClient?: Cafe24ApiClient,
    @Optional()
    private readonly conversationThreadService?: ConversationThreadService,
  ) {}

  /**
   * `componentRegistry.bootstrap` 직전에 호출. `workflowExecutor` 는 엔진
   * 자신이므로 런타임에 주입한다 — 본 provider 가 엔진을 알면 순환 의존이 발생.
   */
  build(workflowExecutor: WorkflowExecutor): HandlerDependencies {
    return {
      llmService: this.llmService,
      ragSearchService: this.ragSearchService,
      knowledgeBaseService: this.knowledgeBaseService,
      integrationsService: this.integrationsService,
      mcpClientService: this.mcpClientService,
      workflowExecutor,
      eventEmitter: this.eventEmitter,
      cafe24ApiClient: this.cafe24ApiClient,
      conversationThreadService: this.conversationThreadService,
    };
  }
}
