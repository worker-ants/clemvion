import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
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
import { spreadMeasured, toWorkflowView } from './tools/workflow-view';
import {
  detectPendingUserConfig,
  PendingUserConfigField,
} from './tools/detect-pending-user-config';
import {
  ActivePlanContext,
  computeToolCallsBudget,
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

/**
 * Turn-scoped guard 상태. progress-aware finish guard 가 라운드를 넘나들며
 * 참조하는 카운터들을 한 곳에 모아 (a) 호출부의 시그니처를 평탄하게 유지하고
 * (b) 새 block 사이클마다 reset 누락이 발생하지 않도록 한다.
 */
interface FinishGuardState {
  /** 이 턴에서 PLAN_NOT_COMPLETE 로 finish 가 block 된 횟수. */
  finishBlockCount: number;
  /**
   * 직전 finish block 이후 성공한 edit / plan tool call 수.
   * 0 이면 LLM 이 진척 없이 finish 를 반복 시도하는 stuck 상태로 간주한다.
   */
  editsSinceLastFinishBlock: number;
  /** `clear_plan` 이 이번 턴에 호출됐는지 — 화제 전환으로 guard 비활성. */
  planClearedThisTurn: boolean;
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
        /**
         * 여러 plan step 을 동시에 cover 하는 경우 채운다. 소비자(프론트)는
         * `planStepId` + `planStepIds` 의 union 집합을 완료 처리해야 한다.
         */
        planStepIds?: string[];
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

// 한 turn 안에서 허용할 tool call 총합은 활성 plan 의 규모에 따라 동적으로
// 결정된다 (`computeToolCallsBudget`). 기본 48, plan 이 크면 그에 비례해
// 확장, hard cap 200. 초과 시 ASSISTANT_TOO_MANY_TOOL_CALLS 로 탈출.
const MAX_HISTORY_TURNS = 30;
// progress-aware finish guard 가 LLM 을 다회 라운드 끌고 갈 수 있으므로,
// tool-call budget 과 별개로 단일 턴당 LLM 호출 횟수의 명시적 상한을 둔다.
// 50 라운드면 50-step plan 도 충분히 커버하면서 비용 폭주는 차단한다.
const MAX_TOOL_LOOP_ROUNDS = 50;

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
 *         한 번 더 돌린다. **Progress-aware**: block 이후 LLM 이 edit/plan tool
 *         을 추가 성공시키면 가드가 다시 발동해 plan 이 끝날 때까지 끌고 간다.
 *         block 후 어떤 진척도 없이 또 finish 를 호출하면 stuck 으로 간주해
 *         안전 탈출(정상 종료) 을 허용. 무한 루프 방어는 `toolCallsBudget`(plan
 *         크기에 비례, hard cap 200) + 라운드 상한(`MAX_TOOL_LOOP_ROUNDS`).
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
    // 이 턴의 tool-call budget. 턴 시작 시 활성 plan 크기에 맞춰 계산하고,
    // 같은 턴에 새 plan 이 propose_plan 으로 발행되면 그때 재확장한다.
    let toolCallsBudget = computeToolCallsBudget(
      activePlanForPrompt?.plan ?? null,
    );
    // finish guard 의 turn-scoped 상태. 한 객체로 묶어 관련 변수가
    // 흩어지지 않게 한다 (별도 reset 누락 위험 감소).
    //  - `finishBlockCount` : 이 턴에서 PLAN_NOT_COMPLETE 로 finish 가 block 된 횟수.
    //  - `editsSinceLastFinishBlock` : 직전 block 이후 성공한 edit/plan tool 수.
    //    LLM 이 block 을 받고도 어떤 진척도 못 만든 채 다시 finish 를 호출하면
    //    stuck 으로 간주해 탈출, 하나라도 진척이 있었다면 guard 가 다시 발동.
    //  - `planClearedThisTurn` : `clear_plan` 호출 여부. 화제 전환 시 guard 비활성.
    const guardState: FinishGuardState = {
      finishBlockCount: 0,
      editsSinceLastFinishBlock: 0,
      planClearedThisTurn: false,
    };
    // LLM 호출 라운드 수 — toolCallsBudget 과 별개의 라운드 상한.
    // progress-aware guard 가 N step plan 에서 N+ 라운드를 돌릴 수 있어 비용
    // 폭주를 막기 위한 명시적 안전망.
    let roundCount = 0;

    // 루프 (tool_calls가 있으면 다시 호출)
    while (true) {
      roundCount++;
      if (roundCount > MAX_TOOL_LOOP_ROUNDS) {
        yield {
          event: 'error',
          data: {
            code: 'ASSISTANT_TOO_MANY_TOOL_CALLS',
            message: `Per-turn LLM round limit (${MAX_TOOL_LOOP_ROUNDS}) exceeded. Send a follow-up message (e.g. "이어서 진행해줘") to continue executing remaining plan steps.`,
          },
        };
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
            if (totalToolCallsThisTurn > toolCallsBudget) {
              yield {
                event: 'error',
                data: {
                  code: 'ASSISTANT_TOO_MANY_TOOL_CALLS',
                  message: `Per-turn tool-call budget (${toolCallsBudget}) exhausted. Send a follow-up message (e.g. "이어서 진행해줘") to continue executing remaining plan steps.`,
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
                guardState,
                dto.content,
              );
              if (block) {
                guardState.finishBlockCount++;
                // 새 block 사이클 시작 — 진척 카운터 reset.
                guardState.editsSinceLastFinishBlock = 0;
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
                guardState.planClearedThisTurn = true;
                result = { ok: true, cleared: true };
              } else {
                const plan = this.buildPlanFromArgs(parsed);
                planForTurn = plan;
                // 새 plan 이 발행되면 이전 clear 상태는 자연스럽게 덮어씀.
                guardState.planClearedThisTurn = false;
                // 새 plan 의 크기에 맞춰 tool-call budget 을 재확장한다.
                // 기존에 이미 소비한 totalToolCallsThisTurn 은 유지되지만
                // budget 상한이 커지므로 실행 여유를 확보한다.
                toolCallsBudget = Math.max(
                  toolCallsBudget,
                  computeToolCallsBudget(plan),
                );
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
              // plan-only turn 강제: 같은 턴에 propose_plan 이 호출되었는데
              // approval 없이 바로 edit 을 시도하면 거부한다. LLM 은 한국어
              // 프롬프트로 턴 종료하고 다음 턴(사용자 approve 이후) 에서
              // 실행해야 한다.
              if (planForTurn && !planForTurn.approvedAt) {
                result = {
                  ok: false,
                  error: 'PLAN_AWAITING_APPROVAL',
                  message:
                    "You just proposed a new plan on this turn. Do NOT execute edit tools until the user approves. End this turn with a short Korean message asking the user to click the Approve button on the plan card. After approval, the user's next message will start a new turn where you can run the edits.",
                };
              } else {
                const shadowResult = shadow.apply({
                  name: ev.name as ShadowToolName,
                  arguments: parsed,
                });
                // 활성 plan 이 있는데 planStepId / planStepIds 모두 누락이면
                // 성공 결과에 warning 을 덧붙여 LLM 이 다음 호출부터 step 을
                // 명시하도록 유도한다. 이미 선언된 parsed 변수는 이 블록보다
                // 바깥에 있어 아래 pendingToolCalls.push 쪽의 parsedPlanStepId
                // 계산을 여기서도 활용할 수 있지만 중복 선언을 피해 local
                // 체크만 수행한다.
                const hasStepId =
                  typeof parsed.planStepId === 'string' ||
                  (Array.isArray(parsed.planStepIds) &&
                    parsed.planStepIds.length > 0);
                const activePlan = findActivePlanContext(
                  history,
                  planForTurn,
                  pendingToolCalls,
                  dto.content,
                );
                if (
                  shadowResult.ok &&
                  activePlan &&
                  activePlan.status === 'active' &&
                  !hasStepId
                ) {
                  result = {
                    ...shadowResult,
                    warning: 'MISSING_PLAN_STEP_ID',
                    warningMessage:
                      "Edit succeeded but no planStepId/planStepIds was attached. The plan checklist won't tick off, making the user think nothing happened. Add planStepId or planStepIds (from the active plan above) to every edit call.",
                  };
                } else {
                  result = shadowResult;
                }
                // add_node / update_node 성공 시 integration / llm-config /
                // kb / workflow selector 처럼 사용자가 직접 골라야 하는
                // 필드가 비어있으면 목록을 실어 LLM 에게 되돌린다. 시스템
                // 프롬프트의 "Closing the turn" 규칙에 따라 LLM 은 finish
                // 직전 마무리 메세지에서 이 항목을 안내해야 한다.
                if (
                  shadowResult.ok &&
                  (ev.name === 'add_node' || ev.name === 'update_node') &&
                  shadowResult.id
                ) {
                  const pending = this.collectPendingUserConfig(
                    shadow,
                    shadowResult.id,
                  );
                  if (pending.length > 0) {
                    result = {
                      ...(result as Record<string, unknown>),
                      pendingUserConfig: pending,
                    };
                  }
                }
              }
            }

            pendingResultsForLlm.push({ id: ev.id, result });
            // 진척 카운터: edit / plan tool 이 성공한 경우만 카운트.
            // explore (read-only) 와 실패 호출은 plan 의 미완 step 을 줄이지
            // 못하므로 진척으로 간주하지 않는다. clear_plan / propose_plan 은
            // plan 자체를 바꿔 미완 상태 자체를 해소할 수 있으므로 카운트.
            if (
              (kind === 'edit' || kind === 'plan') &&
              (result as { ok?: boolean })?.ok === true
            ) {
              guardState.editsSinceLastFinishBlock++;
            }
            const parsedPlanStepId =
              typeof parsed.planStepId === 'string'
                ? parsed.planStepId
                : undefined;
            const parsedPlanStepIds = Array.isArray(parsed.planStepIds)
              ? parsed.planStepIds.filter(
                  (s): s is string => typeof s === 'string',
                )
              : undefined;
            pendingToolCalls.push({
              id: ev.id,
              name: ev.name,
              arguments: parsed,
              kind,
              result,
              ...(parsedPlanStepId ? { planStepId: parsedPlanStepId } : {}),
              ...(parsedPlanStepIds && parsedPlanStepIds.length > 0
                ? { planStepIds: parsedPlanStepIds }
                : {}),
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
                  ...(parsedPlanStepId ? { planStepId: parsedPlanStepId } : {}),
                  ...(parsedPlanStepIds && parsedPlanStepIds.length > 0
                    ? { planStepIds: parsedPlanStepIds }
                    : {}),
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
   *   - 직전 block 이후 어떤 진척(edit/plan tool 성공)도 없이 또 finish 시도 —
   *     LLM 이 진짜로 stuck 된 상태이므로 무한 루프 방지로 허용. 진척이 1회라도
   *     있었다면 가드가 다시 발동해 남은 step 을 끝까지 끌고 간다.
   *   - activePlan 없음 or status !== 'active'
   *   - 이번 턴이 실행 턴도 아니고 plan 을 새로 발행한 턴도 아님
   *   - planForTurn 이 null 인데 이번 턴 편집이 active plan 과 전혀 매칭되지
   *     않으면 단발성 편집으로 간주
   *
   * @param history          DB 에서 로드된 같은 세션의 과거 메시지들
   * @param planForTurn      이번 턴에 새로 propose 된 plan (없으면 null)
   * @param pendingToolCalls 이번 턴에 지금까지 실행/시도된 tool call 들
   * @param state            turn-scoped guard 카운터
   *                         (`finishBlockCount`/`editsSinceLastFinishBlock`/`planClearedThisTurn`)
   * @param pendingUserRequest 사용자 메시지 원문 — active plan derivation 에 사용
   */
  /**
   * add_node / update_node 가 성공한 뒤 노드의 "사용자 선택 필요" 필드
   * (integration / LLM config / KB / workflow) 가 비었는지 감지한다.
   * ShadowWorkflow 에는 schema 가 없으므로 이 클래스에서 nodeRegistry 로
   * 조회해 값을 대조한다.
   */
  private collectPendingUserConfig(
    shadow: ShadowWorkflow,
    nodeId: string,
  ): PendingUserConfigField[] {
    const node = shadow.snapshot().nodes.find((n) => n.id === nodeId);
    if (!node) return [];
    const component = this.nodeRegistry.getComponent(node.type);
    if (!component) return [];
    // listDefinitions() 를 다시 돌리는 대신 zod 스키마에서 즉석 JSON 스키마를
    // 꺼낸다. z.toJSONSchema 는 .meta() 를 `ui` 필드로 flatten 하므로
    // detector 가 그대로 읽을 수 있다.
    const jsonSchema = z.toJSONSchema(component.configSchema);
    return detectPendingUserConfig(jsonSchema, node.config ?? {});
  }

  private evaluateFinishGuard(
    history: WorkflowAssistantMessage[],
    planForTurn: AssistantPlanRecord | null,
    pendingToolCalls: AssistantToolCallRecord[],
    state: FinishGuardState,
    pendingUserRequest: string,
  ): FinishGuardError | null {
    if (state.planClearedThisTurn) return null;
    // Plan-only 턴 (이번 턴에 propose_plan 으로 새 plan 이 발행됐는데 아직
    // 미승인) 은 정의상 사용자 approve 대기 상태다. 같은 턴에 LLM 이 edit 을
    // 시도해도 PLAN_AWAITING_APPROVAL 차단으로 canvas 가 변경되지 않으며,
    // 이때 finish 를 PLAN_NOT_COMPLETE 로 막으면 LLM 에게 "남은 step 실행"
    // 신호가 가서 또다시 edit 을 시도하는 무한 핑퐁이 발생한다. 가드를 비활성
    // 시키고 finish 를 정상 통과시켜 사용자가 plan card 의 "계획대로 진행"
    // 으로 다음 턴을 시작하게 한다.
    if (planForTurn && !planForTurn.approvedAt) return null;
    // Stuck 탈출: block 후 LLM 이 어떤 진척도 못 만들고 다시 finish 호출.
    // 진척이 있었으면 (editsSinceLastFinishBlock > 0) 다시 평가해 끝까지 끌고
    // 간다. toolCallsBudget 과 MAX_TOOL_LOOP_ROUNDS 가 절대 상한.
    if (state.finishBlockCount > 0 && state.editsSinceLastFinishBlock === 0)
      return null;
    // 성공한 edit 만 "이번 턴 실행 발생" 으로 간주한다. 실패한 edit (ok:false)
    // 은 canvas 를 바꾸지 않으므로 plan checklist 도 진행시키지 않는다 — 이를
    // 카운트하면 plan-only 턴이나 단발성 실패 후의 finish 가 잘못 막힌다.
    const editThisTurn = pendingToolCalls.some(
      (tc) =>
        tc.kind === 'edit' &&
        (tc.result as { ok?: boolean } | null | undefined)?.ok === true,
    );
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
        // React Flow 측정값. 초기 렌더 등 측정 전이면 undefined → 필드 누락.
        // DTO 는 이미 0/음수/NaN 을 거부하지만 방어적으로 spreadMeasured 사용.
        ...spreadMeasured(n),
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
