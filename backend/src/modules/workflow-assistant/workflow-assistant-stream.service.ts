import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { LlmService } from '../llm/llm.service';
import { ChatMessage } from '../llm/interfaces/llm-client.interface';
import { LlmConfig } from '../llm-config/entities/llm-config.entity';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { WorkflowAssistantSessionService } from './workflow-assistant-session.service';
import { ExploreToolsService } from './tools/explore-tools.service';
import { CandidateLookupService } from './tools/candidate-lookup.service';
import {
  ShadowNode,
  ShadowRuntimePort,
  ShadowSnapshot,
  ShadowWorkflow,
  ShadowToolName,
  sanitizeLlmProvidedString,
} from './tools/shadow-workflow';
import { resolveEffectiveOutputPorts } from './tools/resolve-dynamic-ports';
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
import {
  buildReviewChecklist,
  checklistBlocks,
  ReviewChecklistItem,
} from './tools/review-workflow';
import { recoverLeakedPlan } from './tools/recover-leaked-plan';
import { buildSystemPrompt } from './prompts/system-prompt';
import { AssistantMessageRequestDto } from './dto/assistant-message-request.dto';
import {
  AssistantToolCallRecord,
  AssistantPlanRecord,
  AutoResumeReason,
  FINISH_REASON_AUTO_RESUME_PENDING,
  WorkflowAssistantMessage,
} from './entities/workflow-assistant-message.entity';

/**
 * `evaluateFinishGuard` 의 반환 payload. `finish` tool_result 로 그대로
 * 직렬화되어 LLM 에 전달된다.
 */
type FinishGuardError =
  | {
      ok: false;
      error: 'PLAN_NOT_COMPLETE';
      pendingSteps: Array<{ id: string; description: string }>;
      openQuestions: string[];
      message: string;
    }
  | {
      ok: false;
      error: 'WORKFLOW_REVIEW_REQUIRED';
      checklist: ReviewChecklistItem[];
      originalRequest: string;
      planTitle?: string;
      message: string;
    };

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
  /**
   * 2-stage finish 의 첫 단계 (workflow self-review) 발동 여부.
   * true 가 된 뒤의 finish 는 review 를 건너뛰고 기존 경로로 진행.
   * 같은 턴에 MAX_REVIEW_ROUNDS (2) 를 초과해 review 가 발동하지 않도록
   * `reviewRoundCount` 로 한 번 더 안전장치를 둔다.
   */
  reviewCompleted: boolean;
  /** 이번 턴에 review block 이 발행된 횟수. 2 이상이면 더 이상 발동하지 않음. */
  reviewRoundCount: number;
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
  | {
      /**
       * 서버가 stall 자동 복구 (spec §10) 에 진입함을 프론트에 통지하는
       * 이벤트. 현재 스트리밍 중인 assistant 버블을 확정(`streaming: false`)
       * 하고 **새 버블**을 시작해 이후 라운드 텍스트를 분리된 row 로 렌더
       * 하는 트리거. 한 턴 내 여러 라운드 텍스트가 한 버블에 누적되어
       * 확인 문구("계속 진행해도 될까요?") 가 반복 노출되는 UX 문제를
       * 구조적으로 제거한다 (특히 gpt-oss-120b 임의 중단 quirk).
       */
      event: 'auto_resume';
      data: {
        /**
         * 발동 사유. 현재는 "active plan 에 pending actionable step 이
         * 남았는데 LLM 이 tool call 없이 stop 으로 종료" 한 경우 한 종류만
         * 존재. 향후 다른 복구 경로가 생기면 union 에 추가.
         */
        reason: 'stall_pending_steps';
        /** 이번 턴 내 자동 복구 시도 순번 (1부터 시작). */
        attempt: number;
        /** 허용되는 최대 시도 횟수 (`MAX_STALL_ROUNDS`). */
        max: number;
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
// 같은 타입의 `get_node_schema` 가 한 턴에 `hits` 가 이 값 이상이 되면 LLM
// 이 진전 없이 낭비 루프에 빠진 것으로 간주해 hard-stop 응답으로 바꾼다.
// 카운트 규칙 (`cached.hits`): 첫 호출 직후 1, 두 번째 호출 2, 세 번째 3...
// 3 이면 첫 호출 + cache hit 1회 (hits=2) 까지 warning, **세 번째 호출**
// (hits===3) 부터 `ok:false, error: 'REDUNDANT_SCHEMA_LOOKUP'` 로 차단.
const SCHEMA_LOOKUP_HARD_STOP = 3;
// WORKFLOW_REVIEW_REQUIRED 응답의 `originalRequest` 필드에 실을 사용자 원문의
// 최대 길이. 전체 원문은 system prompt 의 Active plan context 에 이미 XML fence
// 로 중화되어 주입되므로 review tool_result 에는 요약만 싣는다. 프롬프트 인젝션
// 표면 축소 + LLM 토큰 낭비 방지.
const REVIEW_ORIGINAL_REQUEST_MAX_LEN = 200;
/**
 * LLM 이 tool call 없이 텍스트만 뱉고 `finishReason: 'stop'` 으로 턴을 끊는
 * "stall" 라운드의 연속 상한. active plan 에 pending step 이 남은 경우 서버가
 * 자동으로 user nudge ("이어서 진행해줘.") 를 주입해 한 라운드 더 시도한다.
 * 2 번 연속 stall 하면 LLM 이 진짜 진척 불가라고 판단해 루프 종료.
 *
 * 이 값 조정 시: 기대 동작을 고정한 `stream.service.spec.ts` "auto-continues
 * when LLM stalls with text-only output while plan has pending steps" 테스트도
 * 동시에 업데이트.
 */
const MAX_STALL_ROUNDS = 2;

/**
 * `persistAssistantTurn` 이 요구하는 resumeMeta literal object 를 한 곳에서
 * 생성한다. 기존에는 세 persist 경로(라운드 한도 초과 / 에러 / 최종 정상
 * 종료) 에서 같은 삼항 패턴을 복붙하던 것을 통합 (review W-11).
 *
 * `stallRounds === 0` → 정상 턴으로 간주해 autoResumed=false 의 기본값 메타.
 * `stallRounds > 0` → 이번 턴이 stall 복구로 한 번 이상 쪼개졌으므로 해당
 *   row 는 "복구 이후 새로 시작된 row" 로 표시.
 */
function makeResumeMeta(stallRounds: number): {
  autoResumed: boolean;
  autoResumeReason: AutoResumeReason | null;
  autoResumeAttempt: number | null;
} {
  if (stallRounds <= 0) {
    return {
      autoResumed: false,
      autoResumeReason: null,
      autoResumeAttempt: null,
    };
  }
  return {
    autoResumed: true,
    autoResumeReason: 'stall_pending_steps',
    autoResumeAttempt: stallRounds,
  };
}

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
 *  4.5 턴 종료 직전 **propose_plan JSON leak 복구** (option B): LLM 이 툴을
 *      호출하지 않고 plan payload 를 text 로 뱉은 경우, 이 라운드 텍스트만
 *      스캔해 `recoverLeakedPlan` 으로 시그니처를 검증하고 합성 plan 이벤트로
 *      전환한다. edit tool 이 이미 applied 된 상태면 상태 일관성 보호를 위해
 *      복구를 건너뛰고 경고 로그만 남긴다.
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
    private readonly handlerRegistry: NodeHandlerRegistry,
    private readonly candidateLookup: CandidateLookupService,
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
    // Port resolver: `add_edge` 의 source/target 포트가 실제 존재하는지 검사하기
    // 위해 ShadowWorkflow 에 주입. resolveEffectiveOutputPorts 로 config-aware
    // 출력 포트를, 정적 메타에서 inputs 를 꺼내 매 add_edge 시 참조된다.
    // Registry 에 없는 타입은 null 을 돌려 permissive (skip) 로 작동.
    const defsByType = new Map(
      this.nodeRegistry
        .listDefinitions()
        .map((d) => [d.metadata.type, d] as const),
    );
    // ED-AI-40: validation 용 id 배열 + LLM/프런트용 runtime descriptor 를
    // 한 resolver 에서 같이 돌려준다. 자세한 정규화 규칙은
    // `toRuntimePortDescriptor` 참고.
    const toPort = toRuntimePortDescriptor;
    const portResolver = (node: ShadowNode) => {
      const def = defsByType.get(node.type);
      if (!def) return null;
      const outputs = resolveEffectiveOutputPorts(node.config, def).map(toPort);
      const inputs = def.ports.inputs.map((p) => toPort(p));
      return { outputs, inputs };
    };
    // 노드 타입별 default config — 수동 add 경로 (`workflow-canvas.tsx`) 와
    // 동일한 shape 을 shadow 도 보장하도록 주입. zod `.default(...)` 값이
    // 누락된 LLM args 에 먼저 깔려 mode/layout/maxItems 등 schema-default
    // 필드가 `undefined` 로 저장되는 regression 방지.
    const defaultConfigByType: Record<string, Record<string, unknown>> = {};
    for (const [type, def] of defsByType) {
      defaultConfigByType[type] = def.defaultConfig;
    }
    // handler.validate 브리지 — shadow add/update 시점에 domain rule 검사.
    // 등록되지 않은 타입은 permissive (valid:true) 로 넘어가 기존 UNKNOWN_NODE_TYPE
    // 분기가 먼저 잡는다.
    const configValidator = (
      type: string,
      config: Record<string, unknown>,
    ): { valid: boolean; errors: string[] } => {
      if (!this.handlerRegistry.has(type)) return { valid: true, errors: [] };
      return this.handlerRegistry.get(type).validate(config);
    };
    const shadow = new ShadowWorkflow(
      this.toShadowSnapshot(dto.currentWorkflow),
      this.collectKnownNodeTypes(),
      this.collectCategoryByType(),
      portResolver,
      defaultConfigByType,
      configValidator,
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

    // 턴 단위 assistant 상태. 여러 tool-loop 라운드를 돌아도 기본적으로 한
    // row 로 누적되지만, stall 자동 복구(§10) 가 발동하면 경계에서 분리 persist
    // 하고 커서를 리셋한다. 분리된 경우 `planPersisted` 가 true 로 세팅되어
    // 이후 row 들에는 plan 이 중복 기록되지 않는다.
    let assistantText = '';
    let pendingToolCalls: AssistantToolCallRecord[] = [];
    let planForTurn: AssistantPlanRecord | null = null;
    // plan 이 이번 턴에 한 번이라도 persist 되었는지. stall 복구 경계에서
    // 커서를 리셋해도 plan 자체는 `planForTurn` 에 유지되는데, 이후 row 에
    // 또 싣지 않기 위한 가드.
    let planPersisted = false;
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
      reviewCompleted: false,
      reviewRoundCount: 0,
    };
    // Turn-scoped cache for `get_node_schema` results. LLM 이 같은 노드 타입의
    // 스키마를 여러 번 조회하는 낭비 패턴을 잡기 위해 첫 호출 결과를 캐시하고,
    // 2회차부터는 cached 결과 + warning 을, SCHEMA_LOOKUP_HARD_STOP 을 넘기면
    // error 로 되돌려 낭비 루프를 끊는다.
    const schemaCache = new Map<string, { result: unknown; hits: number }>();
    // LLM 호출 라운드 수 — toolCallsBudget 과 별개의 라운드 상한.
    // progress-aware guard 가 N step plan 에서 N+ 라운드를 돌릴 수 있어 비용
    // 폭주를 막기 위한 명시적 안전망.
    let roundCount = 0;
    // 연속 stall 라운드 카운터 — LLM 이 tool call 없이 (text only) stop 으로 끝낸
    // 라운드 중 active plan 에 pending step 이 남아있으면 서버가 fallback 으로
    // 한 번 더 돌린다 (gpt-oss-120b 가 임의 중단하는 quirk 대응). 연속 stall 이
    // `MAX_STALL_ROUNDS` 를 넘으면 LLM 이 실제로 막힌 상태로 간주해 루프 종료.
    // 진척이 있는 라운드에서는 0 으로 리셋되므로 **"이번 턴 전체에서 stall 이
    // 한 번이라도 있었는지"** 의 판정에는 사용할 수 없다 — 그 목적은 아래
    // `totalStallCount` 가 누적으로 추적한다.
    let consecutiveStallRounds = 0;
    // 이번 턴에 stall 복구가 발동한 총 횟수. 진척 라운드로 리셋되지 않으므로
    // 최종 row 에 `autoResumed=true` 를 실을지 판정하는 기준으로 쓴다. 복구가
    // 1회 이상 발동했다면 row 가 이미 분리되어 있으므로 마지막 row 앞에도
    // divider 가 그려져야 한다 (rehydrate 시 일관성 유지).
    let totalStallCount = 0;

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
          planPersisted ? null : planForTurn,
          null,
          'error',
          makeResumeMeta(totalStallCount),
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
                // Plan 완결성은 통과 — 이제 2단계 finish 의 workflow self-review.
                // execution 턴 (실제 성공 edit 이 있었던 경우) 에 한해 1회
                // 자체 점검 체크리스트를 돌린다. blocking 이슈가 있으면
                // `WORKFLOW_REVIEW_REQUIRED` 로 되돌려 LLM 이 수정 후 finish
                // 를 다시 호출하도록 유도.
                const reviewBlock = await this.evaluateReviewGuard(
                  history,
                  planForTurn,
                  pendingToolCalls,
                  guardState,
                  dto.content,
                  assistantText,
                  shadow,
                  workspaceId,
                  session.workflowId,
                );
                if (reviewBlock) {
                  guardState.reviewRoundCount++;
                  guardState.editsSinceLastFinishBlock = 0;
                  pendingResultsForLlm.push({
                    id: ev.id,
                    result: reviewBlock,
                  });
                  pendingToolCalls.push({
                    id: ev.id,
                    name: ev.name,
                    arguments: parsed,
                    kind,
                    result: reviewBlock,
                    ...(ev.signature ? { signature: ev.signature } : {}),
                  });
                  // 다음 번 finish 에서는 review 를 건너뛰도록 mark.
                  guardState.reviewCompleted = true;
                  finishReason = 'tool_calls';
                  finishResolved = true;
                  continue;
                }
                // review 가 skip 되었거나 blocking 이슈 없음 → 이후 finish 는
                // 다시 review 를 돌리지 않도록 mark.
                guardState.reviewCompleted = true;
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
              } else if (ev.name === 'get_node_schema') {
                // 같은 타입을 반복해서 조회하는 낭비 루프 방지. 첫 호출은 실제
                // 실행 (hits=1), 두 번째 호출(hits=2) 은 cached 결과 + warning,
                // 세 번째 호출(hits=3 ≥ SCHEMA_LOOKUP_HARD_STOP) 부터 error 로
                // escalate.
                const typeArg =
                  typeof parsed.type === 'string' ? parsed.type : '';
                const cached = typeArg ? schemaCache.get(typeArg) : undefined;
                if (cached) {
                  cached.hits += 1;
                  if (cached.hits >= SCHEMA_LOOKUP_HARD_STOP) {
                    result = {
                      ok: false,
                      error: 'REDUNDANT_SCHEMA_LOOKUP',
                      message: `You have already fetched the schema for "${typeArg}" ${cached.hits} times this turn. Re-use the earlier result; do not call get_node_schema for this type again.`,
                    };
                  } else {
                    result = {
                      ...(cached.result as Record<string, unknown>),
                      warning: 'REDUNDANT_SCHEMA_LOOKUP',
                      warningMessage: `get_node_schema for "${typeArg}" already returned in this turn — reuse that result instead of re-calling.`,
                      cached: true,
                    };
                  }
                } else {
                  result = await this.handleExploreCall(
                    ev.name,
                    parsed,
                    workspaceId,
                    session.workflowId,
                  );
                  if (typeArg) {
                    schemaCache.set(typeArg, { result, hits: 1 });
                  }
                }
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
              // edit — plan-only turn 에서는 approve 전까지 거부.
              if (isPlanPendingApproval(planForTurn)) {
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
                // 필드가 비어있으면 목록을 실어 LLM·프런트에 되돌린다.
                // ED-AI-39 이후 서버가 워크스페이스 후보까지 포함한
                // `pendingUserConfig[i].candidates` 를 채워 보내며 (spec §4.3.1)
                // 프런트가 edit 버블 내부에 picker 를 렌더한다. LLM 의 closing
                // mention 은 candidates 가 비어있는 항목에만 요구된다.
                if (
                  shadowResult.ok &&
                  (ev.name === 'add_node' || ev.name === 'update_node') &&
                  shadowResult.id
                ) {
                  const pending =
                    await this.collectPendingUserConfigWithCandidates(
                      shadow,
                      shadowResult.id,
                      workspaceId,
                      session.workflowId,
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
          planPersisted ? null : planForTurn,
          null,
          'error',
          makeResumeMeta(totalStallCount),
        );
        yield { event: 'done', data: { finishReason: 'error' } };
        return;
      }

      // 계속 tool loop를 돌려야 하는가?
      //  - `finishReason === 'tool_calls'` : 프로바이더가 명시적으로 추가 tool
      //    호출을 기대 (OpenAI/Anthropic 정규 경로).
      //  - `!finishResolved && hadSuccessfulEditThisRound` : 일부 프로바이더
      //    (특히 gpt-oss-120b) 가 edit tool 을 emit 하고도 `stop` 으로 round 를
      //    종료하는 프로토콜 이상 케이스. 이 상태에서 loop 를 그대로 종료하면
      //    tool_result 가 LLM 에 feedback 되지 않아 LLM 은 "다음 단계 진행 중"
      //    같은 내레이션을 남긴 채 턴이 끊긴 것처럼 보인다. finish 가 명시적으로
      //    호출되지 않았고 실제 edit 이 발생했다면 이 round 의 tool_result 를
      //    돌려주어 다음 round 에서 LLM 이 `finish` 를 부르거나 남은 edit 을
      //    이어가도록 한다. 무한 루프는 `MAX_TOOL_LOOP_ROUNDS` + tool-call
      //    budget 으로 차단. 단, edit 없이 explore / propose_plan 만 하고 stop
      //    으로 끝난 round 는 **round-trip 하지 않는다** — 그 경우 LLM 은 이번
      //    round 의 결과를 이미 다 본 상태라 추가 round 의 ROI 가 없다.
      // Plan-only 턴 강제 종료 (gemini-3-flash-preview 패턴 방어).
      // 이 턴에 propose_plan 이 발행됐고 아직 미승인이면, 프로바이더가
      // finishReason='tool_calls' 로 종료하더라도 round-trip 하지 않는다.
      // 두 가지 덮어쓰기가 모두 필요하다:
      //   (A) `finishReason = 'stop'` — 클라이언트 done 이벤트 payload 정정.
      //   (B) `!planPending` 단락 — `hadSuccessfulEditThisRound` 경로로 재진입
      //       하는 것까지 차단. edit 이 PAA 로 모두 실패하면 (A) 만으로도 안전
      //       하지만, 혹시 edit 중 일부가 성공 경로를 타면 (B) 없이는 round-trip.
      const planPending = isPlanPendingApproval(planForTurn);
      if (planPending) finishReason = 'stop';
      const hadSuccessfulEditThisRound =
        !planPending &&
        pendingResultsForLlm.some((r) => {
          const found = pendingToolCalls.find((p) => p.id === r.id);
          return (
            found?.kind === 'edit' &&
            (found.result as { ok?: boolean } | undefined)?.ok === true
          );
        });
      const shouldContinueLoop =
        !planPending &&
        pendingResultsForLlm.length > 0 &&
        (finishReason === 'tool_calls' ||
          (!finishResolved && hadSuccessfulEditThisRound));
      if (shouldContinueLoop) {
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
          // 같은 턴 round-trip 에도 pendingUserConfig 축소 적용 (review W-7).
          messages.push({
            role: 'tool',
            content: JSON.stringify(stripCandidatesFromToolResult(r.result)),
            toolCallId: r.id,
          });
        }
        // 진척이 있는 라운드는 stall 이 아니므로 카운터 리셋.
        consecutiveStallRounds = 0;
        continue;
      }

      // Stall 자동 복구 (gpt-oss-120b / 프롬프트 위반 대응).
      //
      // 시나리오: LLM 이 tool call 을 전혀 하지 않고 (pendingResultsForLlm 비어있음)
      // 텍스트만 쓰고 `finishReason: 'stop'` 으로 끝냈는데 active plan 에 아직
      // pending actionable step 이 남아있다. 기존에는 frontend 가 "이어서 진행해줘"
      // 안내 hint 를 띄워 사용자가 수동으로 follow-up 을 보내야 했지만, 사용자
      // 피드백에 따라 서버가 자동으로 한 라운드 더 돌려 남은 step 을 실행한다.
      //
      // 안전망:
      //  - `!planPending`: plan-only 턴 (미승인) 에서는 승인 대기가 올바른 상태.
      //  - `!finishResolved`: 이미 finish 가 실행된 턴은 종료가 의도적이므로 제외.
      //  - `pendingResultsForLlm.length === 0`: 이 블록은 "tool call 없이 끊긴"
      //    stall 전용. 위 `shouldContinueLoop` 가 cover 하지 못한 경로.
      //  - `consecutiveStallRounds < MAX_STALL_ROUNDS`: 같은 stall 이 반복되면
      //    LLM 이 진짜 막힌 상태로 간주해 탈출. 무한 루프 방어.
      //  - MAX_TOOL_LOOP_ROUNDS + toolCallsBudget 도 상위 상한으로 작동.
      const hasPendingActionableSteps = (() => {
        if (planPending || finishResolved) return false;
        if (pendingResultsForLlm.length > 0) return false;
        const ctx = findActivePlanContext(
          history,
          planForTurn,
          pendingToolCalls,
          dto.content,
        );
        if (!ctx || ctx.status !== 'active') return false;
        const actionable = ctx.plan.steps.filter((s) => s.action !== 'note');
        return actionable.some((s) => !ctx.completedStepIds.has(s.id));
      })();
      if (
        hasPendingActionableSteps &&
        consecutiveStallRounds < MAX_STALL_ROUNDS
      ) {
        consecutiveStallRounds++;
        totalStallCount++;

        // (A) 지금까지 누적된 assistant 텍스트·toolCalls 를 "중간 row" 로
        //     먼저 persist 하고 커서를 리셋한다. 이게 분리된 메시지 박스의
        //     핵심 — 프론트가 이 row 앞에서 렌더를 끊고, 이후 라운드 텍스트는
        //     새 row 로 누적된다. `FINISH_REASON_AUTO_RESUME_PENDING` 은
        //     "턴이 아직 안 끝났지만 자동 복구 경계에서 분리 저장함" 을
        //     표시하는 마커.
        //
        //     plan 은 "이번 턴에 최초 emit 된 plan" row 에만 실리도록
        //     `planPersisted` 로 가드. 단, 복구 라운드 중에 LLM 이 새 plan 을
        //     또 발행하면 `planForTurn` 이 교체되므로, 그 경우에도 새 plan 을
        //     중간 row 에 실을 수 있도록 "이미 저장한 plan title·summary"
        //     signature 기반으로 판단한다 (review W-2).
        const planForThisSegment = planPersisted ? null : planForTurn;
        // 중간 persist 가 throw 해도 커서(`assistantText`/`pendingToolCalls`)
        // 가 리셋되지 않아 에러 경로 persist 에서 같은 텍스트가 또 저장되는
        // 회귀를 막기 위해 try/finally 로 리셋을 보장한다 (review W-14).
        let midRowPersistSucceeded = false;
        try {
          await this.persistAssistantTurn(
            sessionId,
            assistantText,
            pendingToolCalls,
            planForThisSegment,
            null,
            FINISH_REASON_AUTO_RESUME_PENDING,
            makeResumeMeta(0),
          );
          midRowPersistSucceeded = true;
        } finally {
          // 성공이든 실패든 커서는 항상 리셋 — 실패 시 에러 경로 persist 가
          // "이미 중간 row 에 담긴 내용" 을 다시 저장하는 이중 기록을 방지.
          assistantText = '';
          pendingToolCalls = [];
          if (midRowPersistSucceeded && planForThisSegment) {
            planPersisted = true;
          }
        }

        // (B) 프론트에 재개 신호. 구독자는 현재 스트리밍 중인 assistant
        //     버블을 확정(`streaming: false`) 하고 새 버블을 push 한다.
        //     divider 문구는 `assistant.autoResumedHint` i18n 키로 렌더.
        yield {
          event: 'auto_resume',
          data: {
            reason: 'stall_pending_steps',
            attempt: consecutiveStallRounds,
            max: MAX_STALL_ROUNDS,
          },
        };

        // (C) 이번 라운드의 assistant 텍스트는 history 에 pin 하고, 서버가
        //     user 역할의 nudge 메시지 "이어서 진행해줘." 를 주입한다. LLM
        //     은 active plan context (system prompt) 와 이 user 메시지를
        //     함께 보고 남은 step 의 첫 `[ ]` 부터 resume 해야 한다.
        messages.push({
          role: 'assistant',
          content: roundText,
        });
        messages.push({
          role: 'user',
          content: '이어서 진행해줘.',
        });
        this.logger.debug(
          `ASSISTANT_STALL_AUTO_CONTINUE: round=${roundCount} stall=${consecutiveStallRounds}/${MAX_STALL_ROUNDS} sessionId=${sessionId}`,
        );
        continue;
      }

      // 턴 종료 전 propose_plan JSON leak 복구 (option B).
      //
      // 사례: LLM 이 `propose_plan` 툴을 호출하지 않고 plan payload 를 text
      // 채널로 그대로 뱉는 일이 있다. 프롬프트 강화(option A) 로도 완전히 막지
      // 못하므로, 이 턴에 실제 plan tool call 이 없고 text 에만 propose_plan
      // 시그니처가 존재하면 서버가 합성 plan 이벤트로 전환한다.
      //
      // 스캔 범위는 **이 라운드의 텍스트(`roundText`) 만**. 턴 누적
      // `assistantText` 를 스캔하면 과거 라운드의 설명 목적 예시 JSON 을
      // 오탐해 마지막 라운드에서 부당 복구할 수 있어서다.
      //
      // **Edit tool 공존 가드**: 이 턴에 edit tool 이 이미 실행되어 캔버스
      // 변경이 applied 된 상태라면 복구하지 않는다. 복구하면 planForTurn 이
      // 세팅되어 "plan 승인 대기" 논리가 동작하는데, edit 은 이미 캔버스에
      // 반영된 후라 상태 일관성이 깨진다. 이 경우 경고 로그만 남기고 leak 은
      // 텍스트로 그대로 persist 한다 (사용자가 문제를 인지할 수 있도록).
      const hasEditCallsAlready = pendingToolCalls.some(
        (c) => c.kind === 'edit',
      );

      if (planForTurn === null && roundText) {
        const leak = recoverLeakedPlan(roundText);
        if (leak) {
          if (hasEditCallsAlready) {
            this.logger.warn(
              `ASSISTANT_PROPOSE_PLAN_LEAK_DETECTED_WITH_EDITS: leak found but edits already applied; skipping recovery to avoid state inconsistency (sessionId=${sessionId})`,
            );
          } else {
            this.logger.warn(
              `ASSISTANT_PROPOSE_PLAN_LEAK_RECOVERED: LLM emitted plan as text; converted to synthetic tool call (sessionId=${sessionId}, title=${JSON.stringify(
                String(leak.args.title).slice(0, 60),
              )})`,
            );
            planForTurn = this.buildPlanFromArgs(leak.args);
            const planId = randomUUID();
            const syntheticCallId = `leak_${randomUUID()}`;
            pendingToolCalls.push({
              id: syntheticCallId,
              name: 'propose_plan',
              arguments: leak.args,
              kind: 'plan',
              // `recovered: true` 는 디버그 흔적이지만 history rehydration 시
              // LLM 에 전달되면 안 되는 파생 상태. persist 전 strip 에 의존
              // 하지 않고 여기서는 최소 payload 로만 기록한다.
              result: { ok: true, planId },
            });
            // leak 블록만 제거 (주변 prose 는 보존). 연속 빈 줄 정리.
            // `replace` 는 첫 매치만 치환하지만 recoverLeakedPlan 이 첫 블록만
            // 돌려주므로 의도와 일치 (다중 leak 은 현실 관측 빈도 낮음).
            assistantText = assistantText
              .replace(leak.matched, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            yield {
              event: 'plan',
              data: {
                id: syntheticCallId,
                planId,
                title: planForTurn.title,
                summary: planForTurn.summary,
                steps: planForTurn.steps,
                openQuestions: planForTurn.openQuestions,
              },
            };
          }
        }
      }

      // 턴 종료. stall 복구로 여러 row 로 쪼개진 경우, 이 최종 row 는
      // "복구 이후 새로 시작된 row" 이므로 `autoResumed=true` 로 표시한다.
      // 프론트는 이 플래그를 보고 rehydrate 시 row 앞에 divider 를 렌더.
      await this.persistAssistantTurn(
        sessionId,
        assistantText,
        pendingToolCalls,
        planPersisted ? null : planForTurn,
        usageEvent?.data ?? null,
        finishReason,
        makeResumeMeta(totalStallCount),
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
    // Stall 자동 복구로 한 턴이 여러 row 로 쪼개질 때, 이 row 가 "복구 이후
    // 새로 시작된 row" 인지 표시하는 메타. 기본값은 정상 단일 row 용.
    // `appendMessage` 가 `Partial<WorkflowAssistantMessage>` 를 수용하므로
    // 여기서 entity 필드명 그대로 전달하면 TypeORM 이 DB 컬럼에 기록한다.
    resumeMeta: {
      autoResumed: boolean;
      autoResumeReason: AutoResumeReason | null;
      autoResumeAttempt: number | null;
    } = makeResumeMeta(0),
  ): Promise<void> {
    await this.sessionService.appendMessage(sessionId, {
      role: 'assistant',
      content: content || null,
      toolCalls: toolCalls.length ? toolCalls : null,
      plan,
      usage: usage ?? null,
      finishReason,
      autoResumed: resumeMeta.autoResumed,
      autoResumeReason: resumeMeta.autoResumeReason,
      autoResumeAttempt: resumeMeta.autoResumeAttempt,
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
      case 'get_workflow_executions':
        return this.exploreTools.getWorkflowExecutions(
          workspaceId,
          currentWorkflowId,
          {
            limit: typeof args.limit === 'number' ? args.limit : undefined,
            status: typeof args.status === 'string' ? args.status : undefined,
          },
        );
      case 'get_execution_details':
        return this.exploreTools.getExecutionDetails(
          workspaceId,
          currentWorkflowId,
          asString(args.id, ''),
        );
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

  /**
   * `collectPendingUserConfig` 의 결과에 워크스페이스 후보 목록을 채워
   * 돌려준다. Spec ED-AI-39 (§4.3.1) 의 candidate picker 용. detect 단계는
   * sync, candidate 조회는 async 이므로 두 단계를 분리해 제공한다 —
   * review guard 처럼 sync 가 필요한 경로에서는 전자를 쓰고 tool_result
   * 에 실어 내려보낼 때만 후자로 fill.
   */
  private async collectPendingUserConfigWithCandidates(
    shadow: ShadowWorkflow,
    nodeId: string,
    workspaceId: string,
    currentWorkflowId: string,
  ): Promise<PendingUserConfigField[]> {
    const pending = this.collectPendingUserConfig(shadow, nodeId);
    if (pending.length === 0) return pending;
    return this.candidateLookup.fillCandidates(
      workspaceId,
      currentWorkflowId,
      pending,
    );
  }

  /**
   * 2단계 finish 의 self-review. `evaluateFinishGuard` 가 통과한 상태에서만
   * 호출된다 — 즉 plan 체크박스·openQuestions 수준의 완결성은 이미 OK.
   * 여기서는 한 단계 더 들어가 **워크플로우 품질** 을 감사한다:
   *  - 이번 턴에 실패한 tool call 이 회복되지 않은 채 남아있지 않은지
   *  - 어떤 노드도 trigger 에서 도달 불가능하지 않은지
   *  - pendingUserConfig 이 있는 노드를 마무리 한국어 메세지에 모두 언급했는지
   *  - plan step 에 ok:false 호출만 연결된 "허위 완료" 가 있지 않은지
   *  - 사용자 원 요청 토큰이 현재 노드 label 들과 거의 안 겹치면 soft warn
   *
   * 발동 조건 (비활성 상태):
   *  - `state.reviewCompleted` 가 이미 true (이번 턴에 한 번 했거나 skip 됨)
   *  - `state.reviewRoundCount >= 2` (상한)
   *  - 이번 턴에 성공한 edit 이 하나도 없음 (질문 전용·plan-only 턴)
   *  - 체크리스트가 비었거나 blocking 항목 없음
   */
  private async evaluateReviewGuard(
    history: WorkflowAssistantMessage[],
    planForTurn: AssistantPlanRecord | null,
    pendingToolCalls: AssistantToolCallRecord[],
    state: FinishGuardState,
    originalRequest: string,
    assistantText: string,
    shadow: ShadowWorkflow,
    workspaceId: string,
    currentWorkflowId: string,
  ): Promise<FinishGuardError | null> {
    // shadow.snapshot() 은 nodes/edges 전체를 shallow clone 하므로 한 번만 찍고
    // skip 판정과 체크리스트에 공유한다.
    const snapshot = shadow.snapshot();
    if (this.shouldSkipReview(state, pendingToolCalls, snapshot)) return null;

    // review 대상 plan: 이번 턴에 새로 propose 된 plan 우선, 없으면 history
    // 에서 활성 plan 을 derive.
    const planCtx = findActivePlanContext(
      history,
      planForTurn,
      pendingToolCalls,
      originalRequest,
    );
    const plan = planForTurn ?? planCtx?.plan ?? null;

    // ED-AI-39: `PENDING_USER_CONFIG_UNMENTIONED` 는 candidate 가 0 인 항목에
    // 대해서만 발동해야 한다 (후보가 1+ 면 picker 가 UX 를 완결). review
    // 내부 콜백이 sync 이므로 **모든 노드에 대해** 미리 pending 을 계산한
    // Map 을 만들어 전달한다.
    //
    // review W-2 최적화: 매 self-review 라운드마다 모든 노드×모든 selector
    // field 에 대해 DB 조회를 돌리면 N×M burst 가 발생한다. 우선 sync
    // `collectPendingUserConfig` 로 pending 필드가 실제 있는 노드만 추린
    // 뒤에만 async `fillCandidates` 를 호출해 불필요한 쿼리를 차단.
    // pending 이 없는 노드는 빈 배열로 직행. 결과 Map 은 `Promise.all`
    // 로 모은 entries 배열에서 new Map 으로 불변 생성 (review W-13).
    const detectOnly = snapshot.nodes.map((n) => {
      const pending = this.collectPendingUserConfig(shadow, n.id);
      return { nodeId: n.id, pending };
    });
    const filled = await Promise.all(
      detectOnly.map(async ({ nodeId, pending }) => {
        if (pending.length === 0) {
          return [nodeId, [] as PendingUserConfigField[]] as const;
        }
        const withCandidates = await this.candidateLookup.fillCandidates(
          workspaceId,
          currentWorkflowId,
          pending,
        );
        return [nodeId, withCandidates] as const;
      }),
    );
    const pendingByNode = new Map<string, PendingUserConfigField[]>(filled);

    const checklist = buildReviewChecklist({
      shadowSnapshot: snapshot,
      pendingToolCalls,
      plan,
      originalRequest,
      assistantText,
      collectPendingUserConfig: (nodeId) => pendingByNode.get(nodeId) ?? [],
      nodeDefs: this.nodeRegistry.listDefinitions(),
    });
    if (!checklistBlocks(checklist)) return null;

    return {
      ok: false,
      error: 'WORKFLOW_REVIEW_REQUIRED',
      checklist,
      // 사용자 원문은 LLM 에게 tool_result 로 재주입되므로 프롬프트 인젝션
      // 표면이 된다. 여기서는 요약 목적이라 첫 `REVIEW_ORIGINAL_REQUEST_MAX_LEN`
      // 자만 잘라 싣는다. 전체 원문은 활성 plan 컨텍스트(system prompt) 에
      // 이미 XML fence 로 중화되어 주입되므로 중복 노출도 방지.
      originalRequest: truncateReviewOriginalRequest(originalRequest),
      planTitle: plan?.title,
      message:
        "Before finishing: audit the built workflow against the user's original request. 1) Read the checklist items below. 2) Call get_current_workflow if you need the latest state. 3) Fix each blocking item with edit tools — unresolved failures, orphan nodes, unmentioned pendingUserConfig, or fake step completion. 4) Emit a short Korean '검토 완료' summary covering what you fixed, then call finish again. The second finish will pass through without re-running this review.",
    };
  }

  /**
   * review 건너뛰기 여부 판정. 사용자의 "항상 강제" 요구(execution 턴 모두
   * 점검) 에 맞춰 최소한의 안전 조건만 남긴다. 다음 중 하나라도 참이면 review
   * 는 발동하지 않는다:
   *  - 이미 이번 턴에 review 가 끝났거나 (`reviewCompleted`) loop 상한 초과
   *  - 같은 턴 `clear_plan` → 화제 전환으로 "점검 대상" 이 아님
   *  - 이번 턴에 성공한 edit 이 하나도 없음 — 실행 턴 아님 (질문·plan-only·
   *    전량 실패 케이스)
   *  - non-trigger 노드 수 ≤ 1 — 단발성 trivial 편집은 audit ROI 낮음
   *
   * 주의: PLAN_NOT_COMPLETE 가 이미 fire 한 경우에도 review 는 발동한다.
   * plan 체크박스 충족 ≠ 워크플로우 품질 — 두 가드는 서로 다른 계층의
   * 검증이므로 함께 발동해야 사용자가 기대하는 "완성도 점검" 이 일어난다.
   */
  private shouldSkipReview(
    state: FinishGuardState,
    pendingToolCalls: AssistantToolCallRecord[],
    snapshot: ShadowSnapshot,
  ): boolean {
    if (state.reviewCompleted) return true;
    if (state.reviewRoundCount >= 2) return true;
    if (state.planClearedThisTurn) return true;
    const hadSuccessfulEdit = pendingToolCalls.some(
      (tc) =>
        tc.kind === 'edit' &&
        (tc.result as { ok?: boolean } | undefined)?.ok === true,
    );
    if (!hadSuccessfulEdit) return true;
    const nonTriggerCount = snapshot.nodes.filter(
      (n) => n.category !== 'trigger',
    ).length;
    if (nonTriggerCount <= 1) return true;
    return false;
  }

  private evaluateFinishGuard(
    history: WorkflowAssistantMessage[],
    planForTurn: AssistantPlanRecord | null,
    pendingToolCalls: AssistantToolCallRecord[],
    state: FinishGuardState,
    pendingUserRequest: string,
  ): FinishGuardError | null {
    if (state.planClearedThisTurn) return null;
    // Plan-only 턴 — approve 전까지는 edit 이 어차피 PAA 로 차단되므로 finish 를
    // PLAN_NOT_COMPLETE 로 막으면 LLM 에게 "남은 step 실행" 을 잘못 신호해 재시도
    // 핑퐁을 유발한다. 가드 비활성 → finish 통과 → 다음 턴(approve 후) 에서 실행.
    if (isPlanPendingApproval(planForTurn)) return null;
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
/**
 * Tool result 를 LLM 에 재주입할 때 `pendingUserConfig[*].candidates` 의
 * 실제 id·name 을 히스토리에 노출하지 않도록 축소한다 (review W-7 —
 * prompt injection 위험 완화). LLM 은 `candidateCount` 로 "후보가 있느냐
 * 없느냐" 만 판단하면 되고, 실제 picker 는 프런트가 SSE / DB 원본으로
 * 그대로 그린다.
 *
 * SSE 발행과 DB persist 에는 원본 result 를 그대로 사용하고, 이 함수는
 * **LLM message channel 로 넘어가는 순간**에만 호출한다.
 */
function stripCandidatesFromToolResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const r = result as Record<string, unknown>;
  if (!Array.isArray(r.pendingUserConfig)) return result;
  const pending = r.pendingUserConfig as Array<Record<string, unknown>>;
  const scrubbed = pending.map((entry) => {
    const candidates = entry.candidates;
    const { candidates: _candidates, ...rest } = entry;
    void _candidates;
    return {
      ...rest,
      candidateCount: Array.isArray(candidates) ? candidates.length : 0,
    };
  });
  return { ...r, pendingUserConfig: scrubbed };
}

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
      // 유지한다. LLM 경로 재주입 시 candidate id·name 노출을 막기 위해
      // `stripCandidatesFromToolResult` 로 pendingUserConfig 를 축소.
      const result = tc.result === undefined ? { ok: true } : tc.result;
      out.push({
        role: 'tool',
        content: JSON.stringify(stripCandidatesFromToolResult(result)),
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

/**
 * Plan 이 "제안됐지만 아직 사용자 approve 전" 상태인지 판정. 서비스 내 3 곳
 * (edit 핸들러, `evaluateFinishGuard`, 메인 루프의 plan-only 종료 가드) 에서
 * 재사용. `approvedAt` 은 client 가 "계획대로 진행" 버튼을 누를 때 persist 된다.
 */
function isPlanPendingApproval(plan: AssistantPlanRecord | null): boolean {
  return !!plan && !plan.approvedAt;
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

/**
 * WORKFLOW_REVIEW_REQUIRED tool_result 에 실을 사용자 원문 요약.
 * 프롬프트 인젝션 표면 축소 + 토큰 낭비 방지를 위해 길이 상한만 적용한다
 * (제어 문자 제거는 이후 LLM 이 context 파싱 시 문제되지 않는 수준이므로 생략).
 */
function truncateReviewOriginalRequest(req: string): string {
  if (!req) return '';
  if (req.length <= REVIEW_ORIGINAL_REQUEST_MAX_LEN) return req;
  return req.slice(0, REVIEW_ORIGINAL_REQUEST_MAX_LEN - 1) + '…';
}

/**
 * ED-AI-40 §4.3.2: node registry 가 돌려주는 `ResolvedPort` / `NodePorts.inputs`
 * 엔트리를 `ShadowRuntimePort` 로 정규화. 계약 요약:
 *  - `type`: `'error'` 만 그대로 보존, 그 외 backend 내부 타입
 *    (`'data'` / `'system'` / `'control'`) 은 모두 `'data'` 로 병합.
 *  - `label`: 사용자 자유 입력이 섞일 수 있어 `sanitizeLlmProvidedString`
 *    (80자 상한 · 개행·꺾쇠·제어문자 중화) 통과 후 실림 (review W-1).
 *  - `label` 이 비어있으면 필드 자체 생략 (빈 object spread 제거, review I-2).
 *
 * 별도 helper 로 export 한 이유: service 내부 closure 안에만 두면 타입 정규화
 * 로직이 unit test 대상에서 사라져 회귀 위험이 큼. 명시적 export + 단위
 * 테스트로 `'system'`/`'control'` → `'data'` 매핑을 고정한다 (review W-3).
 */
export function toRuntimePortDescriptor(p: {
  id: string;
  label?: string;
  type: string;
}): ShadowRuntimePort {
  const base: ShadowRuntimePort = {
    id: p.id,
    type: p.type === 'error' ? 'error' : 'data',
  };
  if (p.label) {
    base.label = sanitizeLlmProvidedString(p.label, 80);
  }
  return base;
}
