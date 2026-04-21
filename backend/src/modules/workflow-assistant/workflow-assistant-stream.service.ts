import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LlmService } from '../llm/llm.service';
import { ChatMessage } from '../llm/interfaces/llm-client.interface';
import { LlmConfig } from '../llm-config/entities/llm-config.entity';
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
import { toWorkflowView } from './tools/workflow-view';
import {
  ActivePlanContext,
  findActivePlanContext,
} from './tools/active-plan-context';
import { buildSystemPrompt } from './prompts/system-prompt';
import { AssistantMessageRequestDto } from './dto/assistant-message-request.dto';
import {
  AssistantToolCallRecord,
  AssistantPlanRecord,
  WorkflowAssistantMessage,
} from './entities/workflow-assistant-message.entity';

/**
 * `evaluateFinishGuard` 의 반환 payload. `finish` tool_result 로 그대로
 * 직렬화되어 LLM 에 전달된다.
 */
interface FinishGuardError {
  ok: false;
  error: 'PLAN_NOT_COMPLETE';
  pendingSteps: Array<{ id: string; description: string }>;
  openQuestions: string[];
  message: string;
}

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

// 한 turn 안에서 허용할 tool call 총합. 13-step 안팎의 중규모 plan
// (add_node ≈ step 수 + add_edge ≈ step 수 + 탐색 몇 건) 이 한 번에 끝날 수
// 있도록 32 로 여유를 둔다. 초과 시 ASSISTANT_TOO_MANY_TOOL_CALLS 로 탈출.
const MAX_TOOL_CALLS_PER_TURN = 32;
const MAX_HISTORY_TURNS = 30;

/**
 * Workflow AI Assistant의 대화 한 턴을 처리한다.
 *
 * 흐름:
 *  1. 세션·히스토리 로드 → 시스템 프롬프트 + 기존 메시지로 context 조립
 *  2. 사용자 메시지를 DB에 저장
 *  3. ShadowWorkflow에 현재 워크플로우 스냅샷 적재
 *  4. LlmService.chatStream 루프 — text/tool_call/done 이벤트 처리
 *       - explore: DB·registry 조회가 필요한 도구는 ExploreToolsService로
 *         위임, `get_current_workflow` 만은 shadow 접근이 필요하므로 루프
 *         안의 buildCurrentWorkflowResult() 로 선처리 (handleExploreCall 의
 *         switch 에는 방어용 INTERNAL 응답이 남아 있음)
 *       - plan: PlanCard 이벤트만 SSE로 발행, shadow 변경 없음
 *       - edit: ShadowWorkflow 적용 → 성공 시 SSE로 발행, tool_result를 LLM에 반환
 *       - finish: evaluateFinishGuard() 로 plan 완결성(남은 step, openQuestions)
 *         을 검사. 미완이면 `PLAN_NOT_COMPLETE` tool_result 로 되돌려 루프를
 *         한 번 더 돌린다. finishBlockCount 로 같은 턴 2회 block 을 막아
 *         무한 루프를 방지하고, 두 번째 finish 는 정상 탈출로 허용한다.
 *         성공·차단 모두 pendingToolCalls 에 persist 되어 이후 세션
 *         rehydrate 시 "이미 완료된 plan" 으로 인식된다.
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

    const configIdOverride =
      dto.llmConfigId ?? session.llmConfigId ?? undefined;
    let llmConfig: LlmConfig;
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
      if (derived)
        await this.sessionService.setTitleIfEmpty(sessionId, derived);
    }

    // LLM messages 조립
    // 세션 전반을 이어가는 "active plan" 컨텍스트 — history + 이번 턴 상태
    // 로부터 매 턴 derive 한다. 사용자의 원 요청, 진행한 step, 남은 step,
    // openQuestions 를 프롬프트에 고정으로 노출해 LLM 이 plan 을 잊지 않게
    // 한다. 이 시점에는 pendingToolCalls 가 비어있으나, 이후 finish guard
    // 등에서 재계산할 때는 해당 배열을 포함해 derive 한다.
    const activePlanForPrompt = findActivePlanContext(
      history,
      null,
      [],
      dto.content,
    );
    const systemPrompt = buildSystemPrompt(
      this.nodeRegistry.listDefinitions(),
      shadow.snapshot(),
      activePlanForPrompt,
    );
    const recentHistory = history.slice(-MAX_HISTORY_TURNS * 3);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.flatMap(toChatMessages),
      { role: 'user', content: dto.content },
    ];
    const tools = buildAssistantTools();

    // 턴 단위 assistant 상태. 여러 tool-loop 라운드를 돌아도 한 개의 assistant
    // 메시지 row로 저장되므로 round 경계를 넘어 누적한다.
    let assistantText = '';
    const pendingToolCalls: AssistantToolCallRecord[] = [];
    let planForTurn: AssistantPlanRecord | null = null;
    let totalToolCallsThisTurn = 0;
    // 한 턴 안에서 finish 를 PLAN_NOT_COMPLETE 로 block 한 횟수. 같은 turn 에서
    // 2번 이상 block 하면 무한 루프 위험이 있으므로 두 번째 finish 는 허용한다.
    let finishBlockCount = 0;
    // `clear_plan` 이 이번 턴에 호출되었는지. evaluateFinishGuard 에서 이
    // 플래그가 켜져 있으면 pending step 이 남아도 finish 를 허용한다.
    let planClearedThisTurn = false;

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
      // finish tool 호출이 이 라운드에서 처리되었는지. 처리된 뒤에도 stream
      // 에서 오는 done 이벤트(usage 포함)를 계속 소비해야 usage 정보가
      // 클라이언트에 전달되고 로그에 남는다.
      let finishResolved = false;

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
              // 실행 턴에서 LLM 이 plan 의 일부만 실행한 채로 finish 를
              // 호출하는 경우, 사용자는 "다 끝났다"는 잘못된 신호를 받는다.
              // 서버가 pending 을 감지해 tool_result 를 error 로 반환하면
              // LLM 이 다음 라운드에서 남은 step 을 채우도록 유도할 수 있다.
              const block = this.evaluateFinishGuard(
                history,
                planForTurn,
                pendingToolCalls,
                finishBlockCount,
                planClearedThisTurn,
                dto.content,
              );
              if (block) {
                finishBlockCount++;
                pendingResultsForLlm.push({ id: ev.id, result: block });
                pendingToolCalls.push({
                  id: ev.id,
                  name: ev.name,
                  arguments: parsed,
                  kind,
                  result: block,
                  ...(ev.signature ? { signature: ev.signature } : {}),
                });
                // tool_calls 로 전환해 루프를 한 번 더 돌린다.
                finishReason = 'tool_calls';
              } else {
                const finishResult = { ok: true };
                pendingResultsForLlm.push({ id: ev.id, result: finishResult });
                // 성공적인 finish 도 history 에 함께 persist 해, 다음 세션이
                // rehydrate 될 때 "plan 이 이미 완료된 상태" 라는 맥락을
                // 이어갈 수 있게 한다. SSE 로는 kind='finish' 를 발행하지
                // 않으므로 UI 에는 노출되지 않는다.
                pendingToolCalls.push({
                  id: ev.id,
                  name: ev.name,
                  arguments: parsed,
                  kind,
                  result: finishResult,
                  ...(ev.signature ? { signature: ev.signature } : {}),
                });
                finishReason = 'stop';
              }
              // break 하지 않고 계속 읽어 done/usage 이벤트를 소비해야
              // Round 1 의 usage 가 클라이언트·로그에 정상 전달된다.
              finishResolved = true;
              continue;
            }

            let result: unknown;
            if (kind === 'explore') {
              // `get_current_workflow` 는 세션 외부 DB를 조회하지 않고 현재
              // turn 의 shadow 스냅샷을 그대로 돌려준다. 같은 turn 안에서
              // edit 도구를 먼저 호출한 뒤 최신 상태를 확인하기 위한 용도.
              if (ev.name === 'get_current_workflow') {
                result = this.buildCurrentWorkflowResult(shadow);
              } else {
                result = await this.handleExploreCall(
                  ev.name,
                  parsed,
                  workspaceId,
                  session.workflowId,
                );
              }
            } else if (kind === 'plan') {
              if (ev.name === 'clear_plan') {
                // Topic change marker: active plan context 는 다음 턴부터
                // history 스캔에서 제외된다. tool_result 는 단순 ack 로
                // 충분하며 SSE 로는 별도 발행하지 않아 UI 배지 오염을 피한다.
                planClearedThisTurn = true;
                result = { ok: true, cleared: true };
              } else {
                const plan = this.buildPlanFromArgs(parsed);
                planForTurn = plan;
                // 새 plan 이 발행되면 이전 clear 상태는 자연스럽게 덮어씀.
                planClearedThisTurn = false;
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
              }
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
              // Gemini thought_signature 등 provider opaque 서명. 다음 턴
              // history에서 동일 tool 호출에 반드시 echo 되어야 하므로 persist.
              ...(ev.signature ? { signature: ev.signature } : {}),
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
            // finish tool 이 이미 해석된 라운드라면 우리가 세팅한
            // finishReason('stop' 또는 'tool_calls')을 그대로 유지한다.
            // 프로바이더의 finishReason 은 tool_calls 로 오는 경우가 많은데
            // finish 후에는 그 값을 신뢰하지 않는다.
            if (!finishResolved) finishReason = ev.finishReason;
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
              // 같은 턴 내 다음 round에서 Gemini 2.5+/3.x가 요구하는
              // thought_signature를 echo하기 위해 포함.
              ...(found.signature ? { signature: found.signature } : {}),
            };
          })
          .filter(
            (
              v,
            ): v is {
              id: string;
              name: string;
              arguments: string;
              signature?: string;
            } => v !== null,
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

  // DB 혹은 registry 조회가 필요한 explore 도구들을 ExploreToolsService 로
  // 위임한다. `get_current_workflow` 는 호출 루프에서 shadow 에 직접 접근해
  // 선처리되므로 여기로 오면 안 된다 (도달 시 프로그래밍 오류).
  private async handleExploreCall(
    name: string,
    args: Record<string, unknown>,
    workspaceId: string,
    currentWorkflowId: string,
  ): Promise<unknown> {
    switch (name) {
      case 'get_node_schema':
        return this.exploreTools.getNodeSchema(asString(args.type, ''));
      case 'list_integrations':
        return this.exploreTools.listIntegrations(
          workspaceId,
          typeof args.category === 'string' ? args.category : undefined,
        );
      case 'list_workflows':
        return this.exploreTools.listWorkflows(workspaceId, {
          search: typeof args.search === 'string' ? args.search : undefined,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
          excludeId: currentWorkflowId,
        });
      case 'get_workflow':
        return this.exploreTools.getWorkflow(
          workspaceId,
          asString(args.id, ''),
          args.mode === 'full' ? 'full' : 'summary',
        );
      case 'list_knowledge_bases':
        return this.exploreTools.listKnowledgeBases(workspaceId);
      case 'get_current_workflow':
        // Safety net: should have been handled by caller with shadow access.
        return {
          ok: false,
          error: 'INTERNAL',
          message:
            'get_current_workflow must be handled by the stream loop with shadow access.',
        };
      default:
        return { ok: false, error: 'UNKNOWN_EXPLORE_TOOL' };
    }
  }

  /**
   * `finish` 호출 시점의 plan 완결성을 평가한다. ActivePlanContext 기반으로
   * 판단하며 — `cleared` 상태거나 completed 상태면 guard 가 발동하지 않는다.
   * active 상태에서 pending step 또는 openQuestions 가 남아있을 때만
   * PLAN_NOT_COMPLETE 를 반환한다.
   *
   * 아래 조건이면 null(정상 finish):
   *   - 같은 턴에 `clear_plan` 이 호출됨 — 사용자가 화제를 바꾼 것으로 간주
   *   - 같은 턴에서 이미 1회 block 했음 — 무한 루프 방지
   *   - activePlan 없음 or status !== 'active'
   *   - 이번 턴이 실행 턴도 아니고 plan 을 새로 발행한 턴도 아님
   *   - planForTurn 이 null 인데 이번 턴 편집이 active plan 과 전혀 매칭되지
   *     않으면 단발성 편집으로 간주
   */
  private evaluateFinishGuard(
    history: WorkflowAssistantMessage[],
    planForTurn: AssistantPlanRecord | null,
    pendingToolCalls: AssistantToolCallRecord[],
    finishBlockCount: number,
    planClearedThisTurn: boolean,
    pendingUserRequest: string,
  ): FinishGuardError | null {
    if (planClearedThisTurn) return null;
    if (finishBlockCount > 0) return null;
    const editThisTurn = pendingToolCalls.some((tc) => tc.kind === 'edit');
    if (!editThisTurn) return null;

    const ctx: ActivePlanContext | null = findActivePlanContext(
      history,
      planForTurn,
      pendingToolCalls,
      pendingUserRequest,
    );
    if (!ctx || ctx.status !== 'active') return null;

    // planForTurn 이 null 이면서 이번 턴 편집 중 active plan 의 step id 를
    // 가진 게 하나도 없으면 무관한 편집으로 간주하고 guard 비활성.
    if (!planForTurn) {
      const activePlanStepIds = new Set(ctx.plan.steps.map((s) => s.id));
      const linked = pendingToolCalls.some(
        (tc) =>
          typeof tc.planStepId === 'string' &&
          activePlanStepIds.has(tc.planStepId),
      );
      if (!linked) return null;
    }

    const pendingSteps = ctx.plan.steps
      .filter((s) => s.action !== 'note')
      .filter((s) => !ctx.completedStepIds.has(s.id))
      .map((s) => ({ id: s.id, description: s.description }));
    const openQuestions = ctx.plan.openQuestions ?? [];
    if (pendingSteps.length === 0 && openQuestions.length === 0) return null;

    const hint =
      pendingSteps.length > 0 && openQuestions.length > 0
        ? 'The active plan has pending steps AND unanswered openQuestions. Ask the user the remaining questions in a Korean message, and execute the pending edit tools (with their planStepId) — especially add_edge calls that keep new nodes connected back to manual_trigger.'
        : pendingSteps.length > 0
          ? 'The active plan has pending steps. Execute the remaining edit tools with their matching planStepId — especially add_edge calls that keep new nodes connected back to manual_trigger — or explain why a step should be skipped. Then call finish again. If the user has moved on to unrelated work, call clear_plan first.'
          : 'The active plan still has unanswered openQuestions. Do NOT call finish. Instead, end this turn with a short Korean message asking the user the remaining questions.';
    return {
      ok: false,
      error: 'PLAN_NOT_COMPLETE',
      pendingSteps,
      openQuestions,
      message: `Finish blocked: ${hint}`,
    };
  }

  // 같은 턴 안에서 edit 도구로 수정된 최신 shadow 를 LLM 에 되돌려준다.
  // 시스템 프롬프트 스냅샷과 동일한 보안 정책(redactConfig) · 동일한 shape
  // (`toWorkflowView`) 을 공유해 두 표현이 발산하지 않도록 한다.
  private buildCurrentWorkflowResult(shadow: ShadowWorkflow): unknown {
    return { ok: true, ...toWorkflowView(shadow.snapshot()) };
  }

  private buildPlanFromArgs(
    args: Record<string, unknown>,
  ): AssistantPlanRecord {
    const steps = Array.isArray(args.steps) ? args.steps : [];
    return {
      title: asString(args.title, 'Plan'),
      summary: asString(args.summary, ''),
      steps: steps.map((s) => {
        const step = s as Record<string, unknown>;
        return {
          id: asString(step.id, randomUUID()),
          action:
            (step.action as AssistantPlanRecord['steps'][number]['action']) ??
            'note',
          description: asString(step.description, ''),
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
        type: e.type ?? 'data',
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

// 저장된 assistant 메시지 하나는 실제로는 여러 LLM 라운드(도구 호출 → 결과
// 수신 → 최종 텍스트 응답)가 합쳐진 것이다. 다음 턴 LLM 호출 시 history에서
// 다음 두 제약을 동시에 만족시켜야 한다:
//   (1) functionCall 이 있으면 그 다음 user turn에 매칭되는 functionResponse
//       가 있어야 함 (Gemini: `function call missing`)
//   (2) 같은 메시지(Content) 안에서 functionResponse는 다른 part 타입과 섞일
//       수 없음 (Gemini: `FunctionResponse cannot be mixed with other type of
//       part`). 텍스트 응답과 functionResponse가 같은 user turn이 되지 않도록
//       분리가 필요.
// 이를 위해 assistant row를 3 파트로 분해한다:
//   (A) toolCalls만 담은 assistant turn → model(functionCall)
//   (B) tool result들 → user(functionResponse)
//   (C) 원래 content(텍스트 응답) → model(text)
// 이렇게 하면 이후 이어지는 새 user 텍스트 메시지가 (B)와 merge되지 않고
// 독립된 user turn으로 남아 Gemini 규칙을 지킨다. OpenAI/Anthropic도 이 구조를
// 문제없이 소비한다.
function toChatMessages(msg: WorkflowAssistantMessage): ChatMessage[] {
  if (msg.role === 'user') {
    return [{ role: 'user', content: msg.content ?? '' }];
  }
  if (msg.role === 'assistant') {
    const calls = msg.toolCalls ?? [];
    if (calls.length === 0) {
      return [{ role: 'assistant', content: msg.content ?? '' }];
    }
    const toolCalls = calls.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: JSON.stringify(tc.arguments ?? {}),
      ...(tc.signature ? { signature: tc.signature } : {}),
    }));
    const out: ChatMessage[] = [
      // (A) assistant 메시지에는 toolCalls만 담는다. 텍스트는 (C)로 미룬다.
      { role: 'assistant', content: '', toolCalls },
    ];
    for (const tc of calls) {
      // (B) result가 persist되지 않은 legacy row는 빈 object로 대체해 쌍을
      // 유지한다.
      const result = tc.result === undefined ? { ok: true } : tc.result;
      out.push({
        role: 'tool',
        content: JSON.stringify(result),
        toolCallId: tc.id,
      });
    }
    // (C) 최종 텍스트 응답. content가 비어 있더라도 terminal model turn을
    // 유지해 user↔model alternation이 깨지지 않게 한다 (Gemini는 history가
    // user functionResponse turn으로 끝난 상태에서 새 user text turn이 붙으면
    // 두 turn을 합쳐 버리거나 거부한다).
    out.push({ role: 'assistant', content: msg.content ?? '' });
    return out;
  }
  if (msg.role === 'tool') {
    return [
      {
        role: 'tool',
        content: msg.content ?? '',
        toolCallId: msg.toolCallId ?? undefined,
      },
    ];
  }
  return [];
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

// args.X is `unknown`; `String(...)` on an object would yield "[object Object]".
// 이 helper는 string 타입만 통과시키고, 그 외(객체·배열·null·number 등)는
// fallback으로 대체한다.
function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
