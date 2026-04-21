import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LlmService } from '../llm/llm.service';
import {
  ChatMessage,
  ChatStreamEvent,
} from '../llm/interfaces/llm-client.interface';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { WorkflowAssistantSessionService } from './workflow-assistant-session.service';
import { ExploreToolsService } from './tools/explore-tools.service';
import {
  ShadowSnapshot,
  ShadowWorkflow,
  ShadowToolName,
} from './tools/shadow-workflow';
import {
  buildAssistantTools,
  TOOL_KIND_BY_NAME,
  AssistantToolKind,
} from './tools/tool-definitions';
import { buildSystemPrompt } from './prompts/system-prompt';
import { AssistantMessageRequestDto } from './dto/assistant-message-request.dto';
import {
  AssistantToolCallRecord,
  AssistantPlanRecord,
} from './entities/workflow-assistant-message.entity';

export type AssistantStreamEvent =
  | { event: 'text'; data: { delta: string } }
  | {
      event: 'tool_call';
      data: {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
        result: unknown;
        kind: AssistantToolKind;
        planStepId?: string;
      };
    }
  | {
      event: 'plan';
      data: {
        id: string;
        planId: string;
        title: string;
        summary: string;
        steps: AssistantPlanRecord['steps'];
        openQuestions?: string[];
      };
    }
  | {
      event: 'usage';
      data: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        thinkingTokens?: number;
        model: string;
      };
    }
  | { event: 'done'; data: { finishReason: string } }
  | { event: 'error'; data: { code: string; message: string } };

const MAX_TOOL_CALLS_PER_TURN = 16;
const MAX_HISTORY_TURNS = 30;

/**
 * Workflow AI Assistant의 대화 한 턴을 처리한다.
 *
 * 흐름:
 *  1. 세션·히스토리 로드 → 시스템 프롬프트 + 기존 메시지로 context 조립
 *  2. 사용자 메시지를 DB에 저장
 *  3. ShadowWorkflow에 현재 워크플로우 스냅샷 적재
 *  4. LlmService.chatStream 루프 — text/tool_call/done 이벤트 처리
 *       - explore: ExploreToolsService로 위임 → 결과를 tool_result 메시지로 주입
 *       - plan: PlanCard 이벤트만 SSE로 발행, shadow 변경 없음
 *       - edit: ShadowWorkflow 적용 → 성공 시 SSE로 발행, tool_result를 LLM에 반환
 *       - finish: 루프 종료
 *  5. assistant 턴이 종료되면 누적된 텍스트/toolCalls/plan을 DB에 저장
 */
@Injectable()
export class WorkflowAssistantStreamService {
  private readonly logger = new Logger(WorkflowAssistantStreamService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly sessionService: WorkflowAssistantSessionService,
    private readonly exploreTools: ExploreToolsService,
    private readonly nodeRegistry: NodeComponentRegistry,
  ) {}

  async *streamMessage(
    sessionId: string,
    workspaceId: string,
    userId: string,
    dto: AssistantMessageRequestDto,
    signal?: AbortSignal,
  ): AsyncIterable<AssistantStreamEvent> {
    const session = await this.sessionService.findOneForUser(
      sessionId,
      workspaceId,
      userId,
    );

    const configIdOverride = dto.llmConfigId ?? session.llmConfigId ?? undefined;
    let llmConfig;
    try {
      llmConfig = await this.llmService.resolveConfig(
        configIdOverride,
        workspaceId,
      );
    } catch (error) {
      yield {
        event: 'error',
        data: {
          code: 'ASSISTANT_NO_LLM_CONFIG',
          message:
            error instanceof BadRequestException
              ? 'No LLM config available. Please configure one first.'
              : 'Failed to resolve LLM config.',
        },
      };
      return;
    }

    // history + shadow
    const history = await this.sessionService.loadMessages(sessionId);
    const shadow = new ShadowWorkflow(
      this.toShadowSnapshot(dto.currentWorkflow),
      this.collectKnownNodeTypes(),
      this.collectCategoryByType(),
    );

    // user 메시지 저장 + session title 자동 생성
    await this.sessionService.appendMessage(sessionId, {
      role: 'user',
      content: dto.content,
    });
    if (!session.title) {
      const derived = dto.content.trim().slice(0, 40);
      if (derived) await this.sessionService.setTitleIfEmpty(sessionId, derived);
    }

    // LLM messages 조립
    const systemPrompt = buildSystemPrompt(
      this.nodeRegistry.listDefinitions(),
      shadow.snapshot(),
    );
    const recentHistory = history.slice(-MAX_HISTORY_TURNS * 3);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map(toChatMessage).filter((m): m is ChatMessage => !!m),
      { role: 'user', content: dto.content },
    ];
    const tools = buildAssistantTools();

    // 턴 단위 assistant 상태. 여러 tool-loop 라운드를 돌아도 한 개의 assistant
    // 메시지 row로 저장되므로 round 경계를 넘어 누적한다.
    let assistantText = '';
    const pendingToolCalls: AssistantToolCallRecord[] = [];
    let planForTurn: AssistantPlanRecord | null = null;
    let totalToolCallsThisTurn = 0;

    // 루프 (tool_calls가 있으면 다시 호출)
    while (true) {
      // 각 라운드에서 assistant 메시지로 누적되는 text는 이 턴 전체에 대해
      // 계속 이어 붙이되, LLM에 피드백해야 하는 tool_result는 라운드별로만
      // 수집한다.
      let roundText = '';
      const pendingResultsForLlm: Array<{ id: string; result: unknown }> = [];
      let finishReason: string = 'stop';
      let usageEvent: AssistantStreamEvent | null = null;
      let hadError = false;

      try {
        for await (const ev of this.llmService.chatStream(
          llmConfig,
          {
            model: llmConfig.defaultModel,
            messages,
            tools,
            toolChoice: 'auto',
          },
          { workflowId: session.workflowId },
          signal,
        )) {
          if (ev.type === 'text_delta') {
            assistantText += ev.delta;
            roundText += ev.delta;
            yield { event: 'text', data: { delta: ev.delta } };
          } else if (ev.type === 'tool_call_end') {
            totalToolCallsThisTurn++;
            if (totalToolCallsThisTurn > MAX_TOOL_CALLS_PER_TURN) {
              yield {
                event: 'error',
                data: {
                  code: 'ASSISTANT_TOO_MANY_TOOL_CALLS',
                  message: 'Exceeded the per-turn tool call limit.',
                },
              };
              hadError = true;
              break;
            }
            const parsed = safeParse(ev.arguments);
            const kind: AssistantToolKind =
              TOOL_KIND_BY_NAME[ev.name] ?? 'edit';

            if (kind === 'finish') {
              pendingResultsForLlm.push({ id: ev.id, result: { ok: true } });
              finishReason = 'stop';
              break;
            }

            let result: unknown;
            if (kind === 'explore') {
              result = await this.handleExploreCall(
                ev.name,
                parsed,
                workspaceId,
                session.workflowId,
              );
            } else if (kind === 'plan') {
              const plan = this.buildPlanFromArgs(parsed);
              planForTurn = plan;
              const planId = randomUUID();
              yield {
                event: 'plan',
                data: {
                  id: ev.id,
                  planId,
                  title: plan.title,
                  summary: plan.summary,
                  steps: plan.steps,
                  openQuestions: plan.openQuestions,
                },
              };
              result = { ok: true, planId };
            } else {
              // edit
              const shadowResult = shadow.apply({
                name: ev.name as ShadowToolName,
                arguments: parsed,
              });
              result = shadowResult;
            }

            pendingResultsForLlm.push({ id: ev.id, result });
            pendingToolCalls.push({
              id: ev.id,
              name: ev.name,
              arguments: parsed,
              kind,
              result,
              planStepId:
                typeof parsed.planStepId === 'string'
                  ? parsed.planStepId
                  : undefined,
            });
            if (kind === 'edit' || kind === 'explore') {
              yield {
                event: 'tool_call',
                data: {
                  id: ev.id,
                  name: ev.name,
                  arguments: parsed,
                  result,
                  kind,
                  planStepId:
                    typeof parsed.planStepId === 'string'
                      ? parsed.planStepId
                      : undefined,
                },
              };
            }
          } else if (ev.type === 'done') {
            finishReason = ev.finishReason;
            usageEvent = {
              event: 'usage',
              data: {
                ...ev.usage,
                model: ev.model,
              },
            };
          } else if (ev.type === 'error') {
            yield {
              event: 'error',
              data: { code: ev.code, message: ev.message },
            };
            hadError = true;
            break;
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Assistant stream failed: ${message}`);
        yield {
          event: 'error',
          data: { code: 'ASSISTANT_STREAM_FAILED', message },
        };
        hadError = true;
      }

      if (usageEvent) yield usageEvent;

      if (hadError) {
        await this.persistAssistantTurn(
          sessionId,
          assistantText,
          pendingToolCalls,
          planForTurn,
          null,
          'error',
        );
        yield { event: 'done', data: { finishReason: 'error' } };
        return;
      }

      // 계속 tool loop를 돌려야 하는가?
      if (finishReason === 'tool_calls' && pendingResultsForLlm.length > 0) {
        // assistant 메시지 + tool result들을 messages에 추가하고 다시 호출
        const assistantToolCalls = pendingResultsForLlm
          .map((r) => {
            const found = pendingToolCalls.find((p) => p.id === r.id);
            if (!found) return null;
            return {
              id: found.id,
              name: found.name,
              arguments: JSON.stringify(found.arguments),
            };
          })
          .filter((v): v is { id: string; name: string; arguments: string } =>
            v !== null,
          );
        messages.push({
          role: 'assistant',
          content: roundText,
          toolCalls: assistantToolCalls,
        });
        for (const r of pendingResultsForLlm) {
          messages.push({
            role: 'tool',
            content: JSON.stringify(r.result),
            toolCallId: r.id,
          });
        }
        continue;
      }

      // 턴 종료
      await this.persistAssistantTurn(
        sessionId,
        assistantText,
        pendingToolCalls,
        planForTurn,
        usageEvent?.data ?? null,
        finishReason,
      );
      yield { event: 'done', data: { finishReason } };
      return;
    }
  }

  private async persistAssistantTurn(
    sessionId: string,
    content: string,
    toolCalls: AssistantToolCallRecord[],
    plan: AssistantPlanRecord | null,
    usage:
      | {
          inputTokens: number;
          outputTokens: number;
          totalTokens: number;
          thinkingTokens?: number;
          model: string;
        }
      | null
      | undefined,
    finishReason: string,
  ): Promise<void> {
    await this.sessionService.appendMessage(sessionId, {
      role: 'assistant',
      content: content || null,
      toolCalls: toolCalls.length ? toolCalls : null,
      plan,
      usage: usage ?? null,
      finishReason,
    });
  }

  private async handleExploreCall(
    name: string,
    args: Record<string, unknown>,
    workspaceId: string,
    currentWorkflowId: string,
  ): Promise<unknown> {
    switch (name) {
      case 'get_node_schema':
        return this.exploreTools.getNodeSchema(String(args.type ?? ''));
      case 'list_integrations':
        return this.exploreTools.listIntegrations(
          workspaceId,
          typeof args.category === 'string' ? args.category : undefined,
        );
      case 'list_workflows':
        return this.exploreTools.listWorkflows(workspaceId, {
          search:
            typeof args.search === 'string' ? args.search : undefined,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
          excludeId: currentWorkflowId,
        });
      case 'get_workflow':
        return this.exploreTools.getWorkflow(
          workspaceId,
          String(args.id ?? ''),
          args.mode === 'full' ? 'full' : 'summary',
        );
      case 'list_knowledge_bases':
        return this.exploreTools.listKnowledgeBases(workspaceId);
      default:
        return { ok: false, error: 'UNKNOWN_EXPLORE_TOOL' };
    }
  }

  private buildPlanFromArgs(args: Record<string, unknown>): AssistantPlanRecord {
    const steps = Array.isArray(args.steps) ? args.steps : [];
    return {
      title: String(args.title ?? 'Plan'),
      summary: String(args.summary ?? ''),
      steps: steps.map((s) => {
        const step = s as Record<string, unknown>;
        return {
          id: String(step.id ?? randomUUID()),
          action: (step.action as AssistantPlanRecord['steps'][number]['action']) ??
            'note',
          description: String(step.description ?? ''),
          rationale:
            typeof step.rationale === 'string' ? step.rationale : undefined,
        };
      }),
      openQuestions: Array.isArray(args.openQuestions)
        ? (args.openQuestions as string[])
        : undefined,
    };
  }

  private toShadowSnapshot(
    wf: AssistantMessageRequestDto['currentWorkflow'],
  ): ShadowSnapshot {
    return {
      nodes: wf.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        category: n.category,
        label: n.label,
        positionX: n.positionX,
        positionY: n.positionY,
        config: n.config ?? {},
        containerId: n.containerId ?? null,
        toolOwnerId: n.toolOwnerId ?? null,
      })),
      edges: wf.edges.map((e) => ({
        id: e.id ?? randomUUID(),
        sourceNodeId: e.sourceNodeId,
        sourcePort: e.sourcePort ?? 'out',
        targetNodeId: e.targetNodeId,
        targetPort: e.targetPort ?? 'in',
        type: (e.type ?? 'data') as 'data' | 'error',
      })),
    };
  }

  private collectKnownNodeTypes(): Set<string> {
    return new Set(
      this.nodeRegistry.listDefinitions().map((d) => d.metadata.type),
    );
  }

  private collectCategoryByType(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const def of this.nodeRegistry.listDefinitions()) {
      map[def.metadata.type] = def.metadata.category;
    }
    return map;
  }
}

function toChatMessage(
  msg: import('./entities/workflow-assistant-message.entity').WorkflowAssistantMessage,
): ChatMessage | null {
  if (msg.role === 'user') {
    return { role: 'user', content: msg.content ?? '' };
  }
  if (msg.role === 'assistant') {
    const toolCalls = (msg.toolCalls ?? [])
      .map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: JSON.stringify(tc.arguments ?? {}),
      }));
    return {
      role: 'assistant',
      content: msg.content ?? '',
      toolCalls: toolCalls.length ? toolCalls : undefined,
    };
  }
  if (msg.role === 'tool') {
    return {
      role: 'tool',
      content: msg.content ?? '',
      toolCallId: msg.toolCallId ?? undefined,
    };
  }
  return null;
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
