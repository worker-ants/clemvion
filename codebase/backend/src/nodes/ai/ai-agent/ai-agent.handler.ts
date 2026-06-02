import { Logger } from '@nestjs/common';
import {
  NodeHandler,
  NodeHandlerOutput,
  ExecutionContext,
  ValidationResult,
  ResumableNodeHandlerOutput,
  ResumableMessageSource,
  ResumableMessageOptions,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { buildSystemContextPrefixFromContext } from '../shared/system-context-prefix';
import { pickNonDefaultSystemContext } from '../shared/system-context-schema';
import { LlmService } from '../../../modules/llm/llm.service';
import {
  ChatMessage,
  ToolCall,
  ToolDef,
} from '../../../modules/llm/interfaces/llm-client.interface';
import {
  AgentToolProvider,
  AgentToolResult,
  KbSearchDiagnostic,
  PresentationCallTrace,
  PresentationSchemaViolation,
} from './tool-providers/agent-tool-provider.interface';
import type { McpServerSummary } from './tool-providers/mcp-diagnostics';
import {
  aiAgentNodeMetadata,
  DEFAULT_CONTEXT_SCOPE_N,
} from './ai-agent.schema';
import {
  ExecutionEventType,
  ToolCallCompletedPayload,
  ToolCallStartedPayload,
} from '../../../modules/websocket/websocket.service';
import type {
  ConversationThread,
  ConversationTurnToolCall,
  PresentationPayload,
} from '../../../shared/conversation-thread/conversation-thread.types';
import type {
  NodeRef,
  ThreadHolder,
} from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';
import {
  applyCap,
  renderThreadAsSystemText,
} from '../../../shared/conversation-thread/thread-renderer';
import { truncateForErrorDetails } from '../../core/error-codes';

/**
 * Per-tool execution metadata recorded into `meta.turnDebug[].toolCalls`. The
 * UI uses this (rather than parsing tool message content) to render
 * success / error badges and durations on each tool item in the timeline.
 * Source-of-truth for the ConversationItem.toolStatus field on the client.
 */
export interface ToolCallTrace {
  toolCallId: string;
  name: string;
  providerKey?: string;
  status: 'success' | 'error';
  durationMs: number;
  error?: string;
}

/**
 * Cap for tool_result preview emitted via ExecutionEventEmitter (`tool_call_completed`).
 * The full content is still recorded in `messages` (sent only via the
 * `ai_message` snapshot at turn end) and persisted in `outputData`. The live
 * event is informational — it just needs enough to identify the result.
 * Limits exposure of KB chunks / MCP responses to passive WS subscribers.
 */
const TOOL_RESULT_PREVIEW_CHARS = 200;

function previewContent(content: string): string {
  if (content.length <= TOOL_RESULT_PREVIEW_CHARS) return content;
  return content.slice(0, TOOL_RESULT_PREVIEW_CHARS) + '...';
}

/**
 * Sanitize an exception message before exposing it via WS / UI / outputData.
 * Internal exceptions can carry DB connection strings, internal hostnames,
 * stack details, etc. We surface only a short user-facing summary; the full
 * original message is kept in server logs (see Logger.warn paths in
 * provider implementations).
 */
function sanitizeToolError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Strip long base64 / token-shaped substrings and truncate. The leading
  // sentence is usually safe; very long messages are almost always
  // serialized internals.
  const firstLine = raw.split('\n')[0]?.trim() ?? raw;
  if (firstLine.length > 200) return firstLine.slice(0, 200) + '...';
  return firstLine || 'Tool execution failed';
}

/**
 * 한 번의 노드 실행에서 누적된 RAG 진단 정보. KB tool 호출이 일어날 때마다
 * {@link RagAccumulator} 가 채우며, 노드 결과의 `meta.ragDiagnostics` 로 노출된다.
 */
interface RagDiagnostics {
  /** 노드 실행 중 KB tool 이 1번 이상 호출됐는지. */
  attempted: boolean;
  /** 호출된 distinct KB 수. */
  searchedKbCount: number;
  /** LLM 이 보낸 쿼리들의 합집합 (호출 순서 유지). */
  queriesUsed: string[];
  /** 모든 KB tool 호출에서 회수된 chunk 수의 합. */
  resultCount: number;
  /** 사유 — KB 미설정/빈 결과 등 사용자 디버깅용. */
  skipReason?: 'empty_kb_list' | 'no_results';
}

interface ConditionDef {
  id: string;
  label: string;
  prompt: string;
}

// Shape of the user-authored multi-turn config as it appears on
// `context.rawConfig` / `state.rawConfig` after the engine freezes
// `node.config`. All fields optional — partial configs may exist (e.g.
// no conditions / no KB) and pre-Phase-1 state rows omit rawConfig
// entirely. Used by buildMultiTurnConfigEcho to narrow `unknown` casts.
interface RawAiAgentMultiTurnConfig {
  mode?: string;
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  responseFormat?: string;
  maxTurns?: number;
  maxToolCalls?: number;
  knowledgeBases?: string[];
  conditions?: ConditionDef[];
}

interface ConditionClassification {
  providerToolCalls: Array<{ provider: AgentToolProvider; call: ToolCall }>;
  conditionToolCalls: ToolCall[];
  normalToolCalls: ToolCall[];
  matchedCondition: ConditionDef | null;
}

/** Replace non-alphanumeric/underscore chars for LLM-safe tool names. */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/** Build LLM tool name for a condition. */
function condToolName(conditionId: string): string {
  return `cond_${sanitizeId(conditionId)}`;
}

/**
 * multi-turn `_resumeState.ragSources` 의 최대 보존 개수. 노드 출력 메타용
 * `meta.ragSources` 와 별개로 resume state 에는 직전 N 건만 유지해, 장기 대화
 * 에서 outputData JSONB 가 무제한으로 비대해지는 것을 막는다. 같은 의도로
 * `MAX_TURN_DEBUG_HISTORY` 가 turnDebug 누적에 적용되어 있다.
 *
 * resume 직후 RagAccumulator.fromState 가 이 배열을 hydrate 해 chunkId dedup
 * 셋을 재구성하므로, 잘려 나간 더 오래된 청크는 향후 turn 의 dedup 에서 제외된다
 * (이는 의도된 trade-off — 장기 대화의 메모리 안정성 우선).
 */
const MAX_RESUME_RAG_SOURCES = 200;

/**
 * Default TTL (minutes) for `_retryState.expiresAt`. spec/4-nodes/3-ai/
 * 1-ai-agent.md §7.9 / spec/5-system/4-execution-engine.md §1.3 — retryable
 * error 종결 시 DB 영속되는 `_retryState` 의 만료 시한. 환경변수
 * `AI_RETRY_STATE_TTL_MINUTES` 로 override.
 */
const DEFAULT_RETRY_STATE_TTL_MINUTES = 60;

/**
 * `process.env.AI_RETRY_STATE_TTL_MINUTES` 를 분 단위 양수로 파싱. 미설정 /
 * 비숫자 / 0 이하면 default(60) 로 fallback.
 */
function resolveRetryStateTtlMinutes(): number {
  const raw = process.env.AI_RETRY_STATE_TTL_MINUTES;
  if (raw === undefined || raw === '') return DEFAULT_RETRY_STATE_TTL_MINUTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RETRY_STATE_TTL_MINUTES;
  }
  return parsed;
}

const KB_TOOL_GUIDANCE =
  '\n\n[Knowledge Base] 사용자 질문이 지식 조회를 필요로 하면 등록된 `kb_*` 도구를 호출하세요. ' +
  '사용자 입력을 그대로 query 로 쓰지 말고, 답변에 필요한 **지식 단위** 로 분해해 능동적으로 검색하세요. ' +
  '하나의 query 에는 하나의 주제만 담고, 별개의 정보가 필요하다고 판단되면 같은 turn 에 `kb_*` 를 여러 번 호출하세요 (같은 KB 라도 별개 호출). ' +
  '예) "교환과 반품 정책 알려줘" → `query="교환정책"` + `query="반품정책"` 두 번. ' +
  '각 호출의 결과는 분리된 채로 전달되며, 에이전트가 결과를 그대로 인용·종합해 답변하세요 (점수 기준 병합 없음). ' +
  '결과가 부족하면 다른 어휘 / 더 구체적인 query 로 재호출하세요. ' +
  'KB 가 필요 없는 small-talk 등에는 호출하지 마세요.';

/**
 * `presentationTools` 가 설정됐을 때 systemPrompt 끝에 자동 prepend 되는
 * 안내문. LLM 이 표·차트·캐러셀·템플릿·폼 페이로드를 **응답 본문에 JSON
 * 문자열로 작성** 하는 회귀를 차단한다 (실 사용자 보고 케이스: 마지막 메시지
 * 본문에 `{"mode":"static","items":[...]}` 가 그대로 표시됨). 도구를 직접
 * 호출하라는 명시적 지시로 모델이 tool_use 블록을 emit 하도록 유도한다.
 */
const PRESENTATION_TOOLS_GUIDANCE =
  '\n\n[Presentation Tools] 사용자에게 표·차트·캐러셀·템플릿·폼을 보여줘야 하면 ' +
  '**반드시** 등록된 `render_*` 도구 호출(tool_use)을 emit 하세요. ' +
  '응답 본문에 JSON 형식 페이로드를 직접 작성하지 마세요 — 사용자 화면에 raw JSON 텍스트가 그대로 노출됩니다. ' +
  '도구 호출은 응답 텍스트와 함께 한 turn 안에 보낼 수 있습니다.\n\n' +
  '**한 turn 안에서 페이로드를 완성** 해서 호출하세요. 빈 배열·빈 문자열·default 값에 의존한 partial 호출은 ' +
  '"No items" 같은 빈 카드만 사용자에게 보입니다. 도구별 필수 필드:\n' +
  '- `render_table`: rows (Array<Object>) + columns (Array<{field,label}>) 둘 다 채워서.\n' +
  '- `render_chart`: chartType + data (xAxis/yAxis/values 또는 series) 필수.\n' +
  '- `render_carousel`: **mode="static"** + items (Array<{title, description?, image?, buttons?}>) 최소 1개. mode="dynamic" 호출은 reject 됩니다 (워크플로 데이터 바인딩 전용).\n' +
  '- `render_template`: content (HTML/Markdown 본문 문자열) 필수.\n' +
  '- `render_form`: fields (Array<{name, type, label, ...}>) 필수.\n' +
  '검증 실패 시 schema violation 으로 즉시 반환되며 같은 turn 안에 재호출할 기회가 1회 주어집니다.\n\n' +
  '**호출 결과 해석**:\n' +
  '- `{ok: true, rendered: true, ...}` — 도구가 사용자 화면에 카드를 정상 표시했습니다. **같은 컨텐츠로 재호출하지 마세요.** ' +
  '바로 짧은 마무리 텍스트 응답으로 turn 을 종결하거나, 사용자의 다음 메시지를 기다리세요.\n' +
  '- `{error: "INVALID_PAYLOAD", ...}` — 페이로드에 누락/오류가 있어 사용자에게 표시되지 않았습니다. 오류 사유를 보고 ' +
  '같은 turn 안에서 1회 재시도 (수정된 payload 로). 두 번째 실패 후에는 텍스트로 대체 응답하세요.\n' +
  '도구 호출 4회 초과 시 자동 차단됩니다 — 사용자에게는 이미 카드가 표시된 상태이므로 추가 호출은 무의미합니다.\n' +
  '- `{ok: true, type: "form_submitted", data: {…}, message: "..."}` — 사용자가 `render_form` 을 통해 제출한 form 응답이 도착했습니다. **같은 form 을 다시 호출하지 마세요.** ' +
  '`data` 의 입력값을 reasoning 에 반영해 후속 답변(텍스트) / 다른 도구 호출 / turn 종결 중 하나로 진행하세요. 동일 form 재호출은 사용자 화면에 같은 form 이 다시 떠 회귀로 인식됩니다.';

/**
 * `render_form` submit 시 tool_result content 에 함께 직렬화되는 LLM 재호출
 * 가드 안내문. SoT: spec/4-nodes/3-ai/1-ai-agent.md §12.6.
 *
 * `{ok:true, type:'form_submitted', data, message}` shape 의 `message` 필드와
 * `PRESENTATION_TOOLS_GUIDANCE` 의 `form_submitted` 안내 라인이 같은 의미를
 * 공유하도록 단일 상수로 추출 — 두 위치의 표현이 어긋나면 LLM 이 충돌 신호로
 * 해석할 수 있다.
 *
 * **보안 경계**: `message` 필드는 하드코딩 상수만 허용 (프롬프트 인젝션 회피).
 * 사용자 입력 (formData / userMessage) 은 `data` 필드 안에 그대로 전달되며
 * `message` 에는 절대 합성하지 않는다. 향후 동적 콘텐츠를 이 채널에 삽입해야
 * 하는 경우 별도 sanitization 레이어를 반드시 추가하라.
 */
export const FORM_SUBMITTED_GUIDANCE_MESSAGE =
  '사용자가 form 을 제출했습니다. 같은 form 을 다시 호출하지 말고, data 의 입력값을 받아 후속 답변 / 다른 도구 호출 / turn 종결 중 하나로 진행하세요.';

/**
 * `render_form` submit tool_result content 의 `data` 필드에 적용되는 byte cap.
 * SoT: spec/4-nodes/3-ai/1-ai-agent.md §12.7.
 *
 * 사용자가 form 의 textarea 에 대량 텍스트를 입력하면 그대로 LLM 컨텍스트에
 * 직렬화되어 token 비용 폭주 + context window 초과 위험이 있다. 10KB 로 cap
 * 적용하고 초과 시 string 필드만 균등 truncate, `formDataTruncation` 메타로
 * LLM 에 truncate 사실 명시.
 *
 * 본 cap 은 LLM-facing tool_result content layer 한정 — Presentation 공통
 * §10.9 4-layer SSOT 중 (4) layer 만 영향. `output.interaction.data` /
 * `presentation_user` thread turn / WS wire / internal bus sentinel 의 formData
 * 는 raw 전체 (변경 없음).
 */
export const FORM_SUBMITTED_MAX_BYTES = 10 * 1024;

const FORM_DATA_TRUNCATED_MARKER = '...<truncated>';

/**
 * formData byte 크기가 cap 을 초과하면 각 string 필드의 값을 균등하게
 * truncate 한다. 모든 필드명/구조는 보존하고 비-string 필드 (number/boolean/
 * array/object) 는 건드리지 않는다 (보통 작고, JSON stringify 결과에서 차지
 * 비중이 적다).
 *
 * SoT: spec/4-nodes/3-ai/1-ai-agent.md §12.7 — 선택지 (A) per-field string
 * 균등 truncate + `formDataTruncation` 메타.
 *
 * cap 미만이면 `formDataTruncation` 은 undefined 로 반환 (호출자가 옵셔널
 * 필드로만 부착하도록).
 */
export function capFormDataBytes(
  formData: Record<string, unknown>,
  capBytes: number,
): {
  capped: Record<string, unknown>;
  formDataTruncation?: {
    originalBytes: number;
    bytesAfterCap: number;
    truncatedFields: string[];
  };
} {
  const originalBytes = Buffer.byteLength(JSON.stringify(formData), 'utf8');
  if (originalBytes <= capBytes) {
    return { capped: formData };
  }
  const stringFields = Object.entries(formData).filter(
    ([, v]) => typeof v === 'string',
  ) as Array<[string, string]>;
  if (stringFields.length === 0) {
    // 모든 필드가 비-string. truncate 대상 없음 — 보강 메타만 부착해 LLM 에
    // "cap 초과지만 truncate 불가" 신호. (실무에서는 거의 발생 안 함.)
    return {
      capped: formData,
      formDataTruncation: {
        originalBytes,
        bytesAfterCap: originalBytes,
        truncatedFields: [],
      },
    };
  }
  // 비-string 필드의 직렬화 비용을 먼저 cap 에서 제외 (그대로 보존되므로).
  const nonStringEntries = Object.entries(formData).filter(
    ([, v]) => typeof v !== 'string',
  );
  const nonStringObject = Object.fromEntries(nonStringEntries);
  const nonStringBytes = Buffer.byteLength(
    JSON.stringify(nonStringObject),
    'utf8',
  );
  // string 필드들에 할당 가능한 총 byte 예산. 음수가 되면 0 으로 clamp 후
  // marker 만 박는다.
  const stringBudget = Math.max(0, capBytes - nonStringBytes - 256); // 256B = JSON 구조 overhead 여유
  const perFieldBudget = Math.max(
    FORM_DATA_TRUNCATED_MARKER.length,
    Math.floor(stringBudget / stringFields.length),
  );
  const capped: Record<string, unknown> = { ...formData };
  const truncatedFields: string[] = [];
  for (const [key, value] of stringFields) {
    const valueBytes = Buffer.byteLength(value, 'utf8');
    if (valueBytes <= perFieldBudget) continue;
    const keepBytes = Math.max(
      0,
      perFieldBudget - FORM_DATA_TRUNCATED_MARKER.length,
    );
    // utf8 byte 단위 truncate — char 단위가 아닌 byte 안전성 보장.
    const buf = Buffer.from(value, 'utf8').subarray(0, keepBytes);
    capped[key] = buf.toString('utf8') + FORM_DATA_TRUNCATED_MARKER;
    truncatedFields.push(key);
  }
  const bytesAfterCap = Buffer.byteLength(JSON.stringify(capped), 'utf8');
  return {
    capped,
    formDataTruncation: {
      originalBytes,
      bytesAfterCap,
      truncatedFields,
    },
  };
}

/**
 * Provider 가 반환한 diagnostic delta 를 노드 단위로 누적.
 * `meta.ragDiagnostics` / `meta.ragSources` 의 값을 한곳에서 만들기 위한 헬퍼.
 */
class RagAccumulator {
  private readonly searchedKbIds = new Set<string>();
  private readonly queries: string[] = [];
  private resultCount = 0;
  private attempted = false;
  private readonly sources: unknown[] = [];
  // Dedupe by chunkId — multi-turn conversations and parallel KB tool calls
  // can return the same chunk multiple times. Keeping the first occurrence
  // (highest score from its first match) keeps the References tab tidy and
  // prevents React key collisions on `<li key={s.chunkId}>` in the UI.
  private readonly seenChunkIds = new Set<string>();

  constructor(private readonly initialKbCount: number) {}

  pushSources(items: unknown[] | undefined): void {
    if (!items || items.length === 0) return;
    for (const item of items) {
      const chunkId =
        item && typeof item === 'object'
          ? ((item as { chunkId?: unknown }).chunkId as string | undefined)
          : undefined;
      if (typeof chunkId === 'string') {
        if (this.seenChunkIds.has(chunkId)) continue;
        this.seenChunkIds.add(chunkId);
      }
      this.sources.push(item);
    }
  }

  pushDiagnostic(d: KbSearchDiagnostic | undefined): void {
    if (!d) return;
    this.attempted = true;
    this.searchedKbIds.add(d.kbId);
    this.queries.push(d.query);
    this.resultCount += d.resultCount;
  }

  getSources(): unknown[] {
    return this.sources;
  }

  getDiagnostics(): RagDiagnostics {
    if (this.initialKbCount === 0) {
      return {
        attempted: false,
        searchedKbCount: 0,
        queriesUsed: [],
        resultCount: 0,
        skipReason: 'empty_kb_list',
      };
    }
    if (!this.attempted) {
      return {
        attempted: false,
        searchedKbCount: 0,
        queriesUsed: [],
        resultCount: 0,
      };
    }
    const base: RagDiagnostics = {
      attempted: true,
      searchedKbCount: this.searchedKbIds.size,
      queriesUsed: [...this.queries],
      resultCount: this.resultCount,
    };
    if (this.resultCount === 0) {
      base.skipReason = 'no_results';
    }
    return base;
  }

  /** Multi-turn resume 를 위해 기존 ragSources 배열을 hydrate. */
  static fromState(
    initialKbCount: number,
    existingSources: unknown[],
  ): RagAccumulator {
    const acc = new RagAccumulator(initialKbCount);
    // Hydrate the dedupe set so subsequent pushSources() calls don't
    // re-add chunks that were already collected on prior turns.
    for (const item of existingSources) {
      const chunkId =
        item && typeof item === 'object'
          ? ((item as { chunkId?: unknown }).chunkId as string | undefined)
          : undefined;
      if (typeof chunkId === 'string') acc.seenChunkIds.add(chunkId);
    }
    acc.sources.push(...existingSources);
    return acc;
  }
}

/**
 * 노드 누적과 turn delta 두 accumulator 를 동시에 갱신하는 thin wrapper.
 * "delta 의 합 = 노드 전체 누적" 불변식을 호출자 규율 대신 타입 시스템 수준에서
 * 강제한다. provider 결과를 한 번 push 하면 두 곳이 항상 동기 상태.
 */
class RagAccumulatorGroup {
  constructor(
    readonly node: RagAccumulator,
    readonly turn: RagAccumulator,
  ) {}

  pushSources(items: unknown[] | undefined): void {
    this.node.pushSources(items);
    this.turn.pushSources(items);
  }

  pushDiagnostic(d: KbSearchDiagnostic | undefined): void {
    this.node.pushDiagnostic(d);
    this.turn.pushDiagnostic(d);
  }
}

/**
 * Map ConversationTurn → LLM ChatMessage (messages-mode injection,
 * spec/conventions/conversation-thread.md §5.1). Pure function — extracted
 * from `injectThreadContext` so unit tests can exercise the per-source
 * mapping in isolation.
 *
 * `presentation_user` turns are prefixed with `[from <nodeLabel>]` so the
 * LLM can attribute the input back to the originating node.
 *
 * Every returned message carries `source: 'injected'` for the WebSocket
 * emit layer (spec/5-system/6-websocket-protocol.md §4.4.6) — set once at
 * the bottom of the function rather than per-case so adding a new turn
 * source can't accidentally drop the marker. System messages are filtered
 * out before reaching the emit payload (`buildConversationConfigFromOutput`),
 * so the marker on them is harmless.
 */
function mapTurnsToChatMessages(
  turns: readonly import('../../../shared/conversation-thread/conversation-thread.types').ConversationTurn[],
): ChatMessage[] {
  return turns
    .map((t): ChatMessage => {
      switch (t.source) {
        case 'presentation_user':
          return {
            role: 'user',
            content: `[from ${t.nodeLabel}] ${t.text}`,
          } as ChatMessage;
        case 'ai_user':
          return { role: 'user', content: t.text } as ChatMessage;
        case 'ai_assistant':
          return {
            role: 'assistant',
            content: t.text,
            ...(t.toolCalls ? { toolCalls: t.toolCalls } : {}),
          } as ChatMessage;
        case 'ai_tool':
          return {
            role: 'tool',
            content: t.text,
            ...(t.toolCallId ? { toolCallId: t.toolCallId } : {}),
          } as ChatMessage;
        case 'system':
          return { role: 'system', content: t.text } as ChatMessage;
        default:
          return { role: 'user', content: t.text } as ChatMessage;
      }
    })
    .map((m) => ({ ...m, source: 'injected' as const }));
}

export class AiAgentHandler implements NodeHandler {
  metadata = aiAgentNodeMetadata;

  constructor(
    private readonly llmService: LlmService,
    private readonly toolProviders: AgentToolProvider[] = [],
    /**
     * Optional. When provided, each provider tool execution emits
     * `tool_call_started` / `tool_call_completed` events via the engine's
     * `ExecutionEventEmitter` facade (single emit sink, spec EIA §R10) on
     * channel `execution:{executionId}` so the debugging timeline can render
     * pending → success / error transitions live. Test fixtures may omit
     * this — the handler runs unchanged otherwise.
     *
     * 인라인 `import()` 타입을 쓰는 이유: 형제 의존성 `conversationThreadService`
     * (아래) 및 `HandlerDependencies.cafe24ApiClient` 와 동일하게, `nodes/` 레이어가
     * `modules/execution-engine/` 의 구체 클래스를 **top-level import 없이 타입으로만**
     * 참조해 레이어 간 import 그래프·잠재 순환을 만들지 않기 위함.
     */
    private readonly eventEmitter?: import('../../../modules/execution-engine/events/execution-event-emitter.service').ExecutionEventEmitter,
    /**
     * Optional. When provided, the handler pushes user / assistant turns
     * into the workflow-scoped ConversationThread (single mutation entrypoint
     * per spec/conventions/conversation-thread.md §2.2) and auto-injects the
     * thread on chat calls when `contextScope` is enabled.
     *
     * Test fixtures that exercise the handler in isolation may omit this;
     * the handler then degrades to its original (no-thread) behaviour.
     */
    private readonly conversationThreadService?: import('../../../modules/execution-engine/conversation-thread/conversation-thread.service').ConversationThreadService,
  ) {}

  /* ─── ConversationThread push helpers (spec §2.2) ─────────────────────── */

  /**
   * NodeRef from the engine-injected ExecutionContext (executeSingleTurn /
   * executeMultiTurn first-turn path). Engine doesn't yet propagate
   * label/type; fall back to nodeId for label and hard-code 'ai_agent' for
   * type — sufficient for thread display until engine ships richer node
   * metadata to handlers (v2).
   */
  private buildAiNodeRefFromContext(
    context: ExecutionContext,
    config: Record<string, unknown>,
  ): NodeRef {
    const id = context.nodeId ?? '';
    return {
      id,
      label: id,
      type: 'ai_agent',
      config: context.rawConfig ?? config,
    };
  }

  /**
   * NodeRef from `state` carried across multi-turn resumes. `state.rawConfig`
   * is the frozen snapshot taken at the first turn (engine `state.rawConfig`
   * policy — `spec/5-system/4-execution-engine.md §6.1`).
   */
  private buildAiNodeRefFromState(state: Record<string, unknown>): NodeRef {
    const id = (state.nodeId as string | undefined) ?? '';
    return {
      id,
      label: id,
      type: 'ai_agent',
      config: (state.rawConfig as Record<string, unknown> | undefined) ?? {},
    };
  }

  /** Thread reference carried in `state` from the first multi-turn turn. */
  private threadHolderFromState(
    state: Record<string, unknown>,
  ): ThreadHolder | undefined {
    const ref = state.conversationThreadRef as ConversationThread | undefined;
    return ref ? { conversationThread: ref } : undefined;
  }

  /**
   * Push a single user/assistant turn onto the thread. No-op when the
   * service or thread reference is missing (test fixtures, legacy paths).
   */
  private pushAiThreadTurn(
    target: ThreadHolder | undefined,
    nodeRef: NodeRef,
    source: 'ai_user' | 'ai_assistant',
    content: string,
    toolCalls?: ConversationTurnToolCall[],
    presentations?: PresentationPayload[],
  ): void {
    if (!this.conversationThreadService || !target) return;
    if (source === 'ai_user') {
      this.conversationThreadService.appendAiUserMessage(target, {
        node: nodeRef,
        content,
      });
    } else {
      this.conversationThreadService.appendAiAssistantMessage(target, {
        node: nodeRef,
        content,
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
        ...(presentations && presentations.length > 0 ? { presentations } : {}),
      });
    }
  }

  /**
   * Inject the ConversationThread (excluding the current node's own turns)
   * into the LLM chat. spec/conventions/conversation-thread.md §5.
   *
   * Returns the mutated messages + system prompt so the caller can hand
   * them to llmService.chat, plus a debug snapshot for `meta.contextInjection`.
   *
   * Single-turn: invoke once immediately before the first chat.
   * Multi-turn: invoke once during executeMultiTurn (the injected turns are
   *   then carried in `_resumeState.messages` for every subsequent chat).
   */
  private injectThreadContext(args: {
    target: ThreadHolder | undefined;
    selfNodeId: string;
    config: Record<string, unknown>;
    messages: ChatMessage[];
    finalSystemPrompt: string;
  }): {
    messages: ChatMessage[];
    finalSystemPrompt: string;
    injection: {
      appliedScope: 'none' | 'thread' | 'lastN';
      appliedMode: 'messages' | 'system_text';
      injectedTurns: number;
      droppedTurns: number;
      totalInjectedChars: number;
    };
  } {
    const noopMeta = {
      appliedScope: 'none' as const,
      appliedMode: 'messages' as const,
      injectedTurns: 0,
      droppedTurns: 0,
      totalInjectedChars: 0,
    };

    const scope = args.config.contextScope as
      | 'none'
      | 'thread'
      | 'lastN'
      | undefined;
    if (
      !this.conversationThreadService ||
      !args.target ||
      !scope ||
      scope === 'none'
    ) {
      return {
        messages: args.messages,
        finalSystemPrompt: args.finalSystemPrompt,
        injection: noopMeta,
      };
    }

    const allTurns = this.conversationThreadService.getThreadExcludingNode(
      args.target,
      args.selfNodeId,
    );
    if (allTurns.length === 0) {
      return {
        messages: args.messages,
        finalSystemPrompt: args.finalSystemPrompt,
        injection: { ...noopMeta, appliedScope: scope },
      };
    }

    const scoped =
      scope === 'lastN'
        ? allTurns.slice(
            -Math.max(
              1,
              (args.config.contextScopeN as number) ?? DEFAULT_CONTEXT_SCOPE_N,
            ),
          )
        : allTurns;

    // Cap (per spec §5.3 — char-based, last-resort safety).
    const capped = applyCap(scoped);

    const mode =
      (args.config.contextInjectionMode as 'messages' | 'system_text') ??
      'messages';

    if (mode === 'system_text') {
      const text = renderThreadAsSystemText(capped.turns);
      const newSystemPrompt = args.finalSystemPrompt
        ? `${args.finalSystemPrompt}\n\n${text}`
        : text;
      // Mirror the appended thread text into the messages array's system
      // entry so callers don't need to re-sync the two surfaces.
      const newMessages = args.messages.map((m) =>
        m.role === 'system' ? { ...m, content: newSystemPrompt } : m,
      );
      return {
        messages: newMessages,
        finalSystemPrompt: newSystemPrompt,
        injection: {
          appliedScope: scope,
          appliedMode: 'system_text',
          injectedTurns: capped.turns.length,
          droppedTurns: capped.droppedCount,
          totalInjectedChars: capped.totalChars,
        },
      };
    }

    // 'messages' mode — prepend (after system) per spec §5.1 mapping.
    const injected: ChatMessage[] = mapTurnsToChatMessages(capped.turns);

    // Insert injected turns after the leading system message (if any).
    const systemIdx = args.messages.findIndex((m) => m.role === 'system');
    const newMessages = [...args.messages];
    const insertAt = systemIdx >= 0 ? systemIdx + 1 : 0;
    newMessages.splice(insertAt, 0, ...injected);

    return {
      messages: newMessages,
      finalSystemPrompt: args.finalSystemPrompt,
      injection: {
        appliedScope: scope,
        appliedMode: 'messages',
        injectedTurns: capped.turns.length,
        droppedTurns: capped.droppedCount,
        totalInjectedChars: capped.totalChars,
      },
    };
  }

  /**
   * Tool turn opt-in gate. `includeToolTurns: true` lets KB / MCP / condition
   * tool-loop turns flow into the thread; default false keeps the thread
   * lean (only final assistant per spec §2.2 / §2.4).
   */
  private isToolTurnsEnabled(
    source: Record<string, unknown> | undefined,
  ): boolean {
    return source?.includeToolTurns === true;
  }

  /** Tool result push (opt-in via `state.includeToolTurns === true`). */
  private pushAiToolResultTurn(
    target: ThreadHolder | undefined,
    nodeRef: NodeRef,
    toolCallId: string,
    content: string,
  ): void {
    if (!this.conversationThreadService || !target) return;
    this.conversationThreadService.appendAiToolResult(target, {
      node: nodeRef,
      toolCallId,
      content,
    });
  }

  /**
   * Run a provider tool with telemetry: emit started/completed events via
   * the ExecutionEventEmitter facade,
   * catch exceptions so the LLM can still recover in the next turn, and
   * record a {@link ToolCallTrace} for `meta.turnDebug[].toolCalls`.
   */
  private async runProviderTool(args: {
    provider: AgentToolProvider;
    call: ToolCall;
    executionId: string;
    nodeId: string;
    nodeExecutionId?: string;
    workflowId?: string;
    workspaceId: string;
    config: Record<string, unknown>;
    turnIndex: number;
  }): Promise<{ result: AgentToolResult; trace: ToolCallTrace }> {
    const { provider, call, executionId, nodeId, turnIndex } = args;
    const startedAt = Date.now();

    const startedPayload: ToolCallStartedPayload = {
      nodeId,
      turnIndex,
      toolCallId: call.id,
      name: call.name,
      arguments: call.arguments,
    };
    await this.eventEmitter?.emitExecution(
      executionId,
      ExecutionEventType.TOOL_CALL_STARTED,
      startedPayload,
    );

    let result: AgentToolResult;
    let status: 'success' | 'error';
    let error: string | undefined;

    try {
      result = await provider.execute(call, {
        config: args.config,
        workspaceId: args.workspaceId,
        executionId,
        nodeExecutionId: args.nodeExecutionId,
        workflowId: args.workflowId,
      });
      status = result.status ?? 'success';
      error = result.error;
    } catch (err: unknown) {
      // Log the full original exception server-side for debugging and
      // surface only a sanitized summary to client / LLM context.
      const sanitized = sanitizeToolError(err);
      AiAgentHandler.logger.warn(
        `Provider "${provider.key}" tool ${call.name} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      result = {
        toolCallId: call.id,
        content: JSON.stringify({ error: sanitized }),
        status: 'error',
        error: sanitized,
      };
      status = 'error';
      error = sanitized;
    }

    const durationMs = Date.now() - startedAt;
    const trace: ToolCallTrace = {
      toolCallId: call.id,
      name: call.name,
      providerKey: provider.key,
      status,
      durationMs,
      ...(error !== undefined ? { error } : {}),
    };

    if (status === 'error') {
      AiAgentHandler.logger.warn(
        `Tool call ${call.name} (${call.id}) finished with status=error in ${durationMs}ms: ${error}`,
      );
    }

    const completedPayload: ToolCallCompletedPayload = {
      nodeId,
      turnIndex,
      toolCallId: call.id,
      // Preview only — full result lives in the messages snapshot sent via
      // `ai_message` and in persisted outputData.
      content: previewContent(result.content),
      status,
      ...(error !== undefined ? { error } : {}),
      durationMs,
    };
    await this.eventEmitter?.emitExecution(
      executionId,
      ExecutionEventType.TOOL_CALL_COMPLETED,
      completedPayload,
    );

    return { result, trace };
  }

  /**
   * 한 turn 의 provider tool 호출 묶음을 Promise.all 로 병렬 실행하고 결과를
   * 입력 순서대로 messages·trace·ragGroup 에 결정적으로 누적한다. 잔여 한도를
   * 초과하는 호출은 'tool_call_budget_exceeded' tool_result 로 회신해 모든
   * tool_use ↔ tool_result 매칭 요건(Anthropic) 을 만족시킨다.
   *
   * single-turn / multi-turn resume 양쪽에서 동일 정책을 보장하기 위한 단일
   * 진입점 — 이 메서드를 거치지 않고 provider 를 직접 실행하는 신규 경로는
   * 추가하지 않는다.
   */
  private async executeProviderToolBatch(args: {
    calls: Array<{ provider: AgentToolProvider; call: ToolCall }>;
    remainingBudget: number;
    executionId: string;
    nodeId: string;
    nodeExecutionId?: string;
    workflowId?: string;
    workspaceId: string;
    config: Record<string, unknown>;
    turnIndex: number;
    ragGroup: RagAccumulatorGroup;
    toolCallTraces: ToolCallTrace[];
    messages: ChatMessage[];
    /**
     * `render_*` display-only payloads — appended to the next `ai_assistant`
     * turn's top-level `presentations[]` by the caller. spec §7.10.
     */
    presentationPayloads?: PresentationPayload[];
    /** `meta.presentationCalls[]` metric accumulator (spec §7.10). */
    presentationCalls?: PresentationCallTrace[];
    /** `meta.presentationSchemaViolations[]` (spec §4.1 silent drop trace). */
    presentationSchemaViolations?: PresentationSchemaViolation[];
    /**
     * Per-`toolName` schema violation counter spanning the AI Agent execution
     * (single-turn loop / multi-turn all turns). spec §4.1: 1회 재시도 후에도
     * schema 위반이면 silent drop. counter 가 2 이상이 되면 본 batch 가
     * `presentationCalls[].status = 'dropped'` 로 강등하고 tool_result 를
     * `{ok:true, dropped:true}` 로 회신해 LLM 의 다음 turn 에서 재시도를
     *유도하지 않는다.
     */
    presentationViolationCounters?: Map<string, number>;
  }): Promise<{
    executedCount: number;
    /**
     * `render_form` blocking signal — handler enters waiting_for_input flow
     * (spec §6.1.d.ii). At most one per batch (the first tool_use wins; later
     * render_form calls in the same batch are silent-dropped as schema
     * violations by the caller).
     */
    blockingFormRender?: {
      toolCallId: string;
      formConfig: Record<string, unknown>;
    };
  }> {
    const safeBudget = Math.max(0, args.remainingBudget);
    const toRun = args.calls.slice(0, safeBudget);
    const truncated = args.calls.slice(safeBudget);

    const batchResults = await Promise.all(
      toRun.map(({ provider, call }) =>
        this.runProviderTool({
          provider,
          call,
          executionId: args.executionId,
          nodeId: args.nodeId,
          nodeExecutionId: args.nodeExecutionId,
          workflowId: args.workflowId,
          workspaceId: args.workspaceId,
          config: args.config,
          turnIndex: args.turnIndex,
        }),
      ),
    );

    let blockingFormRender:
      | { toolCallId: string; formConfig: Record<string, unknown> }
      | undefined;

    for (const { result: execResult, trace } of batchResults) {
      args.toolCallTraces.push(trace);
      args.ragGroup.pushSources(execResult.ragSourcesDelta);
      args.ragGroup.pushDiagnostic(execResult.ragDiagnosticsDelta);

      // render_* schema-violation retry gate (spec §4.1 — 1회 재시도 후 drop).
      // The counter spans the whole AI Agent execution (caller maintains the
      // Map across turns). On the 2nd+ violation for the same `toolName` we
      // (a) demote the trace status to `'dropped'`, (b) skip the LLM-visible
      // error content so the model isn't tempted to keep retrying.
      let toolResultContent = execResult.content;
      const violation = execResult.presentationSchemaViolation;
      if (violation && args.presentationViolationCounters) {
        const prev =
          args.presentationViolationCounters.get(violation.toolName) ?? 0;
        const next = prev + 1;
        args.presentationViolationCounters.set(violation.toolName, next);
        if (next > 1) {
          // Silent drop — keep tool_result well-formed so Anthropic's
          // tool_use ↔ tool_result pairing requirement holds, but signal
          // dropped status so the LLM stops retrying.
          toolResultContent = JSON.stringify({ ok: true, dropped: true });
          if (execResult.presentationCall) {
            execResult.presentationCall.status = 'dropped';
          }
          // Mark attempts on the recorded violation so downstream can see
          // how many retries the model burned.
          violation.attempts = next;
        }
      }

      // render_* (display-only) — push payload to ai_assistant turn buffer.
      if (execResult.presentationPayload && args.presentationPayloads) {
        args.presentationPayloads.push(execResult.presentationPayload);
      }
      if (execResult.presentationCall && args.presentationCalls) {
        args.presentationCalls.push(execResult.presentationCall);
      }
      if (
        execResult.presentationSchemaViolation &&
        args.presentationSchemaViolations
      ) {
        args.presentationSchemaViolations.push(
          execResult.presentationSchemaViolation,
        );
      }
      // render_form (interactive) — capture first blocking signal.
      if (execResult.blockingFormRender && !blockingFormRender) {
        blockingFormRender = execResult.blockingFormRender;
      }
      args.messages.push({
        role: 'tool',
        content: toolResultContent,
        toolCallId: execResult.toolCallId,
      });
    }

    for (const { call } of truncated) {
      args.messages.push({
        role: 'tool',
        content: JSON.stringify({ error: 'tool_call_budget_exceeded' }),
        toolCallId: call.id,
      });
    }

    return {
      executedCount: batchResults.length,
      ...(blockingFormRender ? { blockingFormRender } : {}),
    };
  }

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers no-llm-provider,
    // multi-turn-needs-system-prompt, single-turn-needs-prompt,
    // too-many-conditions, maxTurns numeric guard, per-condition
    // id/label/prompt + reserved-port collision + 2000-char prompt cap.
    const errors = evaluateMetadataBlockingErrors(this.metadata, config);
    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const mode = (config.mode as string) || 'single_turn';

    try {
      if (mode === 'multi_turn') {
        return await this.executeMultiTurn(input, config, context);
      }
      return await this.executeSingleTurn(input, config, context);
    } finally {
      // Cleanup hook fires on every execute() return — including the
      // multi-turn `waiting_for_input` path. Sessions held by providers
      // (e.g. MCP) are torn down here so the next turn rebuilds them
      // deterministically from config. Cleanup errors are swallowed —
      // they would mask the upstream success/failure that triggered the
      // return.
      await this.cleanupProviders(context.executionId);
    }
  }

  private async cleanupProviders(executionId: string): Promise<void> {
    await Promise.allSettled(
      this.toolProviders.map((p) =>
        p.cleanup
          ? p.cleanup({ executionId }).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              AiAgentHandler.logger.warn(
                `Provider "${p.key}" cleanup failed: ${msg}`,
              );
            })
          : Promise.resolve(),
      ),
    );
  }

  private async executeSingleTurn(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const llmConfigId = config.llmConfigId as string | undefined;
    const model = config.model as string | undefined;
    const systemPrompt = (config.systemPrompt as string) || '';
    const userPrompt = (config.userPrompt as string) || '';
    const temperature = config.temperature as number | undefined;
    const maxTokens = config.maxTokens as number | undefined;
    const responseFormat = (config.responseFormat as 'text' | 'json') || 'text';
    const jsonSchema = config.jsonSchema as Record<string, unknown> | undefined;
    const knowledgeBases = (config.knowledgeBases as string[]) || [];
    const maxToolCalls = (config.maxToolCalls as number) || 10;
    const conditions = (config.conditions as ConditionDef[]) || [];

    // CONVENTIONS Principle 7 — config echoes raw user input
    // (systemPrompt / userPrompt / per-condition prompt may be `{{ ... }}`
    // templates). Engine resolves expressions before dispatch so the local
    // variables hold evaluated values for runtime LLM calls. Tool-connection
    // fields (`toolNodeIds` / `toolOverrides`) are out of scope per the
    // tool-connection-rewrite plan; the rest of the config schema is
    // covered.
    const rawConfig = context.rawConfig ?? config;

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    const ragAcc = new RagAccumulator(knowledgeBases.length);
    // Single-turn 은 한 턴이라 turn delta = 노드 누적이지만, turnDebug[0]
    // 도 동일 키로 노출해 멀티턴 출력과 스키마 일관성을 유지한다.
    const turnRagAcc = new RagAccumulator(knowledgeBases.length);
    const ragGroup = new RagAccumulatorGroup(ragAcc, turnRagAcc);
    // MCP build 결과 (skipReason / connected) 누적. spec §6.2 의
    // serverSummaries[] 가 본 array 의 1:1 echo. buildTools 호출 시 ctx 로
    // 흘러간다. 비어있으면 meta emit 시 자동 omit (buildMcpDiagnosticsMeta).
    const mcpDiagnosticsAcc: McpServerSummary[] = [];
    // Render tool (`render_*`) accumulators. spec §4.1·§7.10. Single-turn
    // 은 render_form 이 silent-drop 되므로 display-only payloads 만 의미가 있다.
    const presentationPayloads: PresentationPayload[] = [];
    const presentationCalls: PresentationCallTrace[] = [];
    const presentationSchemaViolations: PresentationSchemaViolation[] = [];
    // Per-toolName retry counter for spec §4.1 schema-violation gate.
    // Spans the single-turn tool loop; multi-turn has its own counter.
    const presentationViolationCounters = new Map<string, number>();

    // System prompt: KB 검색은 더 이상 prefill 하지 않는다. LLM 이 능동 호출 결정.
    // spec/4-nodes/3-ai/0-common.md §11.4 ordering:
    //   [1] System Context Prefix  ← buildSystemContextPrefixFromContext
    //   [2] 사용자 systemPrompt
    //   [3] KB_TOOL_GUIDANCE
    //   [4] Condition suffix
    //   [5] Thread injection (system_text 모드)
    const systemContextPrefix = buildSystemContextPrefixFromContext({
      context,
      config,
      now: new Date(),
    });
    let finalSystemPrompt = systemContextPrefix + systemPrompt;
    if (knowledgeBases.length > 0) {
      finalSystemPrompt += KB_TOOL_GUIDANCE;
    }
    if (conditions.length > 0) {
      finalSystemPrompt += this.buildConditionSystemPromptSuffix(conditions);
    }
    if (
      Array.isArray(config.presentationTools) &&
      config.presentationTools.length > 0
    ) {
      finalSystemPrompt += PRESENTATION_TOOLS_GUIDANCE;
    }

    // Build messages
    let messages: ChatMessage[] = [];
    if (finalSystemPrompt) {
      messages.push({ role: 'system', content: finalSystemPrompt });
    }
    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt });
      // ConversationThread push (spec §2.2 — single-turn ai_user, 1회).
      this.pushAiThreadTurn(
        context,
        this.buildAiNodeRefFromContext(context, config),
        'ai_user',
        userPrompt,
      );
    }

    // ConversationThread inject (spec §5) — single-turn runs once before
    // the first chat. The helper updates both the system prompt and the
    // messages array in lockstep.
    const singleTurnInjection = this.injectThreadContext({
      target: context,
      selfNodeId: context.nodeId ?? '',
      config,
      messages,
      finalSystemPrompt,
    });
    messages = singleTurnInjection.messages;
    finalSystemPrompt = singleTurnInjection.finalSystemPrompt;

    const tools = await this.buildTools(
      config,
      workspaceId,
      context.executionId,
      mcpDiagnosticsAcc,
    );

    // Per-call trace so the frontend LlmInformationTab can inspect each
    // request/response/usage even for single-turn runs (tool loop commonly
    // spans several calls).
    const llmCalls: Array<{
      requestPayload: unknown;
      responsePayload: unknown;
      durationMs: number;
    }> = [];
    const toolCallTraces: ToolCallTrace[] = [];
    const singleTurnStartedAt = Date.now();
    const firstRequest = {
      model: model || llmConfig.defaultModel,
      messages: [...messages],
      temperature,
      maxTokens,
      responseFormat,
      jsonSchema,
      tools: tools.length > 0 ? tools : undefined,
    };
    let callStartedAt = Date.now();
    let result = await this.llmService.chat(
      llmConfig,
      {
        model: model || llmConfig.defaultModel,
        messages,
        temperature,
        maxTokens,
        responseFormat,
        jsonSchema,
        tools: tools.length > 0 ? tools : undefined,
      },
      undefined,
      { signal: context.abortSignal },
    );
    llmCalls.push({
      requestPayload: firstRequest,
      responsePayload: result,
      durationMs: Date.now() - callStartedAt,
    });

    let toolCallCount = 0;
    while (result.toolCalls?.length && toolCallCount < maxToolCalls) {
      const classification = this.classifyToolCalls(
        result.toolCalls,
        conditions,
      );

      // Case 1: Only condition tools (no provider, no normal) — route immediately.
      if (
        classification.providerToolCalls.length === 0 &&
        classification.normalToolCalls.length === 0 &&
        classification.matchedCondition
      ) {
        const reason = this.extractConditionReason(
          result.toolCalls,
          classification.matchedCondition.id,
        );
        messages.push({ role: 'assistant', content: result.content || '' });
        // ConversationThread push (spec §2.2 — single-turn ai_assistant on
        // condition route). render_* display-only payloads accumulated from
        // earlier batch iterations attach here (spec §7.10).
        this.pushAiThreadTurn(
          context,
          this.buildAiNodeRefFromContext(context, config),
          'ai_assistant',
          result.content || '',
          undefined,
          presentationPayloads.length > 0 ? presentationPayloads : undefined,
        );
        return this.buildConditionOutput(
          classification.matchedCondition,
          reason,
          messages,
          1,
          {
            model: result.model ?? (model || llmConfig.defaultModel),
            totalInputTokens: result.usage?.inputTokens ?? 0,
            totalOutputTokens: result.usage?.outputTokens ?? 0,
            totalThinkingTokens: result.usage?.thinkingTokens ?? 0,
            toolCalls: toolCallCount,
            ragSources: ragAcc.getSources(),
            ragDiagnostics: ragAcc.getDiagnostics(),
            mcpServerSummaries: mcpDiagnosticsAcc,
            presentationCalls:
              presentationCalls.length > 0 ? presentationCalls : undefined,
            presentationSchemaViolations:
              presentationSchemaViolations.length > 0
                ? presentationSchemaViolations
                : undefined,
            allPresentations:
              presentationPayloads.length > 0
                ? presentationPayloads
                : undefined,
          },
          {
            llmCalls,
            totalDurationMs: Date.now() - singleTurnStartedAt,
          },
          [
            {
              turnIndex: 1,
              llmCalls,
              totalDurationMs: Date.now() - singleTurnStartedAt,
              ...(toolCallTraces.length > 0
                ? { toolCalls: [...toolCallTraces] }
                : {}),
              ragSources: turnRagAcc.getSources(),
              ragDiagnostics: turnRagAcc.getDiagnostics(),
            },
          ],
          rawConfig,
        );
      }

      // Case 2/3: provider / normal / mixed-with-condition — execute and continue.
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });
      // Tool-loop assistant push (opt-in via `includeToolTurns`).
      if (this.isToolTurnsEnabled(config)) {
        this.pushAiThreadTurn(
          context,
          this.buildAiNodeRefFromContext(context, config),
          'ai_assistant',
          result.content || '',
          result.toolCalls as ConversationTurnToolCall[] | undefined,
        );
      }

      // Provider tool 호출은 같은 turn 내 Promise.all 로 병렬 실행 + budget
      // 부분 truncate 까지 일괄 처리하는 단일 진입점을 사용 (single-turn /
      // multi-turn resume 두 경로의 정책 일관성 보장). 상세 동작은
      // {@link executeProviderToolBatch} 주석 참조.
      const { executedCount: providerExecuted } =
        await this.executeProviderToolBatch({
          calls: classification.providerToolCalls,
          remainingBudget: maxToolCalls - toolCallCount,
          executionId: context.executionId,
          nodeId: context.nodeId ?? '',
          nodeExecutionId: context.nodeExecutionId,
          workflowId: context.workflowId,
          workspaceId,
          config,
          turnIndex: 1,
          ragGroup,
          toolCallTraces,
          messages,
          presentationPayloads,
          presentationCalls,
          presentationSchemaViolations,
          presentationViolationCounters,
        });
      toolCallCount += providerExecuted;

      for (const tc of classification.conditionToolCalls) {
        // Condition tool: send deferral message (does not count toward toolCallCount).
        const condDeferralContent = JSON.stringify({
          result:
            '확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.',
        });
        messages.push({
          role: 'tool',
          content: condDeferralContent,
          toolCallId: tc.id,
        });
        if (this.isToolTurnsEnabled(config)) {
          this.pushAiToolResultTurn(
            context,
            this.buildAiNodeRefFromContext(context, config),
            tc.id,
            condDeferralContent,
          );
        }
      }

      // 일반 도구도 maxToolCalls 합산 대상이므로 잔여 한도를 초과한 항목은
      // budget_exceeded 로 회신해 LLM 의 다음 turn 에서 모든 tool_use 가
      // tool_result 와 매칭되도록 한다. 현재 일반 도구는 stub 결과만 만들므로
      // 실제 외부 호출 비용은 없으나, maxToolCalls 합산 시맨틱은 spec §3.f-g
      // 와 일치시킨다.
      for (const tc of classification.normalToolCalls) {
        if (toolCallCount >= maxToolCalls) {
          const budgetContent = JSON.stringify({
            error: 'tool_call_budget_exceeded',
          });
          messages.push({
            role: 'tool',
            content: budgetContent,
            toolCallId: tc.id,
          });
          if (this.isToolTurnsEnabled(config)) {
            this.pushAiToolResultTurn(
              context,
              this.buildAiNodeRefFromContext(context, config),
              tc.id,
              budgetContent,
            );
          }
          continue;
        }
        toolCallCount++;
        const normalContent = JSON.stringify({
          result: `Tool ${tc.name} executed`,
          arguments: tc.arguments,
        });
        messages.push({
          role: 'tool',
          content: normalContent,
          toolCallId: tc.id,
        });
        if (this.isToolTurnsEnabled(config)) {
          this.pushAiToolResultTurn(
            context,
            this.buildAiNodeRefFromContext(context, config),
            tc.id,
            normalContent,
          );
        }
      }

      const loopRequest = {
        model: model || llmConfig.defaultModel,
        messages: [...messages],
        temperature,
        maxTokens,
        responseFormat,
        jsonSchema,
        tools,
      };
      callStartedAt = Date.now();
      result = await this.llmService.chat(
        llmConfig,
        {
          model: model || llmConfig.defaultModel,
          messages,
          temperature,
          maxTokens,
          responseFormat,
          jsonSchema,
          tools,
        },
        undefined,
        { signal: context.abortSignal },
      );
      llmCalls.push({
        requestPayload: loopRequest,
        responsePayload: result,
        durationMs: Date.now() - callStartedAt,
      });
    }

    // Parse JSON response if needed
    let response: unknown = result.content;
    if (responseFormat === 'json' && result.content) {
      try {
        response = JSON.parse(result.content);
      } catch {
        response = result.content;
      }
    }

    // CONVENTIONS §8 — LLM-category nodes surface their domain result under
    // `output.result.*`. Single-turn AI Agent returns a final text/JSON
    // response plus per-turn debug trace; tokens and tool-call counts move
    // to `meta.*` (Principle 2).
    const singleTurnDurationMs = Date.now() - singleTurnStartedAt;
    // ConversationThread push (spec §2.2 — single-turn final ai_assistant,
    // 1회). Stringify JSON-mode responses so the thread always carries a
    // displayable text payload. render_* display-only payloads (spec §7.10)
    // attach to this turn's top-level `presentations[]` field.
    {
      const finalText =
        typeof response === 'string'
          ? response
          : response === undefined || response === null
            ? ''
            : JSON.stringify(response);
      this.pushAiThreadTurn(
        context,
        this.buildAiNodeRefFromContext(context, config),
        'ai_assistant',
        finalText,
        undefined,
        presentationPayloads.length > 0 ? presentationPayloads : undefined,
      );
    }
    return {
      config: {
        mode: 'single_turn' as const,
        model: rawConfig.model ?? model ?? llmConfig.defaultModel,
        systemPrompt: rawConfig.systemPrompt ?? systemPrompt,
        userPrompt: rawConfig.userPrompt ?? userPrompt,
        responseFormat: rawConfig.responseFormat ?? responseFormat,
        ...(rawConfig.conditions !== undefined
          ? Array.isArray(rawConfig.conditions) &&
            (rawConfig.conditions as unknown[]).length > 0
            ? { conditions: rawConfig.conditions }
            : {}
          : conditions.length > 0
            ? { conditions }
            : {}),
        // spec §11.7 — `includeSystemContext` / `systemContextSections` 가 default 와
        // 일치하면 echo 시 생략 (사용자가 명시 opt-out / sections 변경한 경우만 노출).
        ...pickNonDefaultSystemContext(rawConfig),
      },
      output: {
        result: {
          response,
          endReason: 'out' as const,
          turnCount: 1,
          // spec §7.10 — ConversationTurn 의 top-level `presentations[]` 가
          // 단일 진실이나, 실행 내역 (execution history) 페이지가 NodeExecution.
          // outputData 만 fetch 하므로 영속화된 thread snapshot 이 없다. 그래서
          // output.result.presentations[] 로 동일 payload 를 echo — frontend
          // parseHistoryMessages 가 마지막 assistant ConversationItem 에 부여해
          // chat preview 와 동일하게 inline 렌더한다.
          ...(presentationPayloads.length > 0
            ? { presentations: presentationPayloads }
            : {}),
        },
      },
      meta: {
        durationMs: singleTurnDurationMs,
        model: result.model,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        thinkingTokens: result.usage?.thinkingTokens ?? 0,
        toolCalls: toolCallCount,
        ragSources: ragAcc.getSources(),
        ragDiagnostics: ragAcc.getDiagnostics(),
        ...(AiAgentHandler.buildMcpDiagnosticsMeta(mcpDiagnosticsAcc) ?? {}),
        // Render tool (`render_*`) trace + schema violations (spec §7.10, §4.1).
        ...(presentationCalls.length > 0 ? { presentationCalls } : {}),
        ...(presentationSchemaViolations.length > 0
          ? { presentationSchemaViolations }
          : {}),
        // ConversationThread injection debug echo (spec §5.3). Echo only
        // when injection actually happened so noop runs keep the meta lean.
        ...(singleTurnInjection.injection.appliedScope !== 'none'
          ? { contextInjection: singleTurnInjection.injection }
          : {}),
        turnDebug: [
          {
            turnIndex: 1,
            llmCalls,
            totalDurationMs: singleTurnDurationMs,
            ...(toolCallTraces.length > 0
              ? { toolCalls: [...toolCallTraces] }
              : {}),
            ragSources: turnRagAcc.getSources(),
            ragDiagnostics: turnRagAcc.getDiagnostics(),
          },
        ],
      },
      port: 'out',
      status: 'ended',
    };
  }

  private async executeMultiTurn(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const llmConfigId = config.llmConfigId as string | undefined;
    const model = config.model as string | undefined;
    const systemPrompt = (config.systemPrompt as string) || '';
    const temperature = config.temperature as number | undefined;
    const maxTokens = config.maxTokens as number | undefined;
    const knowledgeBases = (config.knowledgeBases as string[]) || [];
    const ragTopK = (config.ragTopK as number) || 5;
    const ragThreshold = (config.ragThreshold as number) || 0.7;
    const maxToolCalls = (config.maxToolCalls as number) || 10;
    const maxTurns = (config.maxTurns as number) ?? 20;
    const conditions = (config.conditions as ConditionDef[]) || [];

    // CONVENTIONS Principle 7 — config echoes raw user input on the
    // initial waiting tick (multi-turn resume snapshots `state.rawConfig`
    // separately, see Phase 1).
    const rawConfig = context.rawConfig ?? config;

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    // multi_turn 의 첫 메시지는 항상 사용자가 채팅 UI 에서 입력한다 — config
    // 의 userPrompt 는 single_turn 전용이며, mode 전환 시 leak 된 값일 수
    // 있어 무시한다 (frontend clearFields 는 이후 mode 변경에만 동작하므로
    // 여기서 server-side safety net 을 제공).
    const ragAcc = new RagAccumulator(knowledgeBases.length);

    // System Context Prefix — spec §11.4 ordering [1]. multi-turn 의 executeMultiTurn
    // 은 첫 진입 시점에만 호출되며, 결과 messages 배열이 `_resumeState.messages` 의
    // 일부로 영속된다 (system role 메시지 포함). 후속 turn (processMultiTurnMessage)
    // 은 systemPrompt 를 새로 빌드하지 않고 영속된 messages 를 그대로 재사용하므로,
    // prefix 는 자연히 turn 간 frozen.
    const systemContextPrefix = buildSystemContextPrefixFromContext({
      context,
      config,
      now: new Date(),
    });
    let finalSystemPrompt = systemContextPrefix + systemPrompt;
    if (knowledgeBases.length > 0) {
      finalSystemPrompt += KB_TOOL_GUIDANCE;
    }
    if (conditions.length > 0) {
      finalSystemPrompt += this.buildConditionSystemPromptSuffix(conditions);
    }
    if (
      Array.isArray(config.presentationTools) &&
      config.presentationTools.length > 0
    ) {
      finalSystemPrompt += PRESENTATION_TOOLS_GUIDANCE;
    }

    let messages: ChatMessage[] = [];
    if (finalSystemPrompt) {
      messages.push({ role: 'system', content: finalSystemPrompt });
    }

    // ConversationThread inject (spec §5) — multi-turn injects once during
    // executeMultiTurn so the resulting `messages` carry the prepended
    // turns into `_resumeState.messages` for every subsequent chat. Each
    // future `processMultiTurnMessage` then just appends the new user/
    // assistant pair without re-injecting.
    const multiTurnInjection = this.injectThreadContext({
      target: context,
      selfNodeId: context.nodeId ?? '',
      config,
      messages,
      finalSystemPrompt,
    });
    messages = multiTurnInjection.messages;
    finalSystemPrompt = multiTurnInjection.finalSystemPrompt;

    const resolvedModel = model || llmConfig.defaultModel;
    const multiTurnStateBase = {
      llmConfigId,
      model: resolvedModel,
      temperature,
      maxTokens,
      knowledgeBases,
      ragTopK,
      ragThreshold,
      maxToolCalls,
      maxTurns,
      // Persist mcpServers across multi-turn resumes so each post-resume turn
      // re-materializes MCP sessions deterministically from the saved config.
      mcpServers: (config.mcpServers as unknown[]) || [],
      conditions,
      // Persist presentationTools so each resume turn rebuilds the same
      // `render_*` ToolDefs (spec §4.1 — RenderToolProvider reads
      // ctx.config.presentationTools).
      presentationTools: (config.presentationTools as unknown[]) || [],
      workspaceId,
      executionId: context.executionId,
      nodeId: context.nodeId,
      nodeExecutionId: context.nodeExecutionId,
      workflowId: context.workflowId,
      // ConversationThread mutation 단일 진입점이 service.append* 인데,
      // multi-turn 후속 turn 은 ExecutionContext 가 직접 주입되지 않으므로
      // 첫 turn 시점의 thread reference 를 state 에 보관해 다음 turn 에서도
      // 같은 thread 객체를 mutate 하도록 한다 (in-memory ExecutionContext
      // 정책에 의존 — spec/conventions/conversation-thread.md §2.2 / §4).
      conversationThreadRef: context.conversationThread,
    };

    const waitingResult: ResumableNodeHandlerOutput = {
      config: {
        mode: 'multi_turn' as const,
        model: rawConfig.model ?? model ?? llmConfig.defaultModel,
        systemPrompt: rawConfig.systemPrompt ?? systemPrompt,
        maxTurns: rawConfig.maxTurns ?? maxTurns,
        maxToolCalls: rawConfig.maxToolCalls ?? maxToolCalls,
        ...(rawConfig.knowledgeBases !== undefined
          ? { knowledgeBases: rawConfig.knowledgeBases }
          : knowledgeBases.length > 0
            ? { knowledgeBases }
            : {}),
        ...(rawConfig.conditions !== undefined &&
        Array.isArray(rawConfig.conditions) &&
        (rawConfig.conditions as unknown[]).length > 0
          ? { conditions: rawConfig.conditions }
          : conditions.length > 0
            ? { conditions }
            : {}),
      },
      // CONVENTIONS §4.3 — waiting `output.result.*` carries the live
      // conversation snapshot. D6 (2026-05-17) — `messages` / `message` /
      // `turnCount` 가 종결 시점 (`output.result.*`) 과 단일 경로로 통일되어
      // 다운스트림 expression `$node["X"].output.result.*` 가 waiting/ended
      // 양쪽에서 동일하게 동작. `maxTurns` 는 static config 값이라 output 에
      // echo 하지 않는다 (Principle 1.1 — UI 진행률 분모는 config.maxTurns).
      output: {
        result: {
          messages,
          message: '',
          turnCount: 0,
        },
      },
      meta: {
        interactionType: 'ai_conversation',
        // Echo the multi-turn first-turn injection so the run-results UI can
        // show what the agent saw at the conversation's start. Subsequent
        // turns do not re-inject (spec §5: prepended turns are carried in
        // `_resumeState.messages`).
        ...(multiTurnInjection.injection.appliedScope !== 'none'
          ? { contextInjection: multiTurnInjection.injection }
          : {}),
      },
      status: 'waiting_for_input',
      _resumeState: {
        ...multiTurnStateBase,
        messages,
        turnCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        toolCalls: 0,
        ragSources: ragAcc.getSources().slice(-MAX_RESUME_RAG_SOURCES),
        ragLastDiagnostics: ragAcc.getDiagnostics(),
      },
    };
    return waitingResult;
  }

  /**
   * Process user message in multi-turn conversation.
   * Called by the execution engine when a user submits a message.
   */
  async processMultiTurnMessage(
    userMessage: string,
    state: Record<string, unknown>,
    options?: ResumableMessageOptions,
  ): Promise<unknown> {
    const stateExecutionId = state.executionId as string | undefined;
    try {
      return await this.processMultiTurnMessageInner(
        userMessage,
        state,
        options,
      );
    } finally {
      if (stateExecutionId) {
        await this.cleanupProviders(stateExecutionId);
      }
    }
  }

  private async processMultiTurnMessageInner(
    userMessage: string,
    state: Record<string, unknown>,
    options?: ResumableMessageOptions,
  ): Promise<unknown> {
    const messages = [...(state.messages as ChatMessage[])];
    const turnCount = (state.turnCount as number) + 1;
    const maxTurns = state.maxTurns as number;
    const maxToolCalls = state.maxToolCalls as number;
    const knowledgeBases = (state.knowledgeBases as string[]) || [];
    const workspaceId = (state.workspaceId as string) || '';
    const conditions = (state.conditions as ConditionDef[]) || [];
    let totalInputTokens = state.totalInputTokens as number;
    let totalOutputTokens = state.totalOutputTokens as number;
    let totalThinkingTokens = (state.totalThinkingTokens as number) ?? 0;
    let toolCallCount = state.toolCalls as number;

    // ragSources 는 turn 누적 — 새 turn 의 KB tool 호출 결과를 push 한다.
    const ragAcc = RagAccumulator.fromState(
      knowledgeBases.length,
      (state.ragSources as unknown[]) ?? [],
    );
    // 이번 턴에서만 호출된 KB delta — meta.turnDebug[].ragSources 로 노출되어
    // run-results UI 가 "어느 응답이 어느 청크를 사용했는지" 를 매핑한다.
    const turnRagAcc = new RagAccumulator(knowledgeBases.length);
    const ragGroup = new RagAccumulatorGroup(ragAcc, turnRagAcc);
    // MCP build 결과 — multi-turn 은 매 turn 마다 buildTools 재호출이므로 본
    // accumulator 도 turn 단위. 직전 turn 의 summary 는 resumeState 에 보존
    // 하지 않고 매 turn 새로 결정 — buildTools 가 결정론적이므로 안전.
    const mcpDiagnosticsAcc: McpServerSummary[] = [];
    // Render tool (`render_*`) accumulators — turn-scoped. ai_assistant turn
    // push 시 본 buffer 가 부착된다 (spec §7.10).
    const presentationPayloads: PresentationPayload[] = [];
    const presentationCalls: PresentationCallTrace[] = [];
    const presentationSchemaViolations: PresentationSchemaViolation[] = [];
    // Per-toolName retry counter for spec §4.1 schema-violation gate, within
    // this LLM turn's tool-call loop.
    const presentationViolationCounters = new Map<string, number>();

    // render_form blocking resume (spec §6.2 step 2 + step 2.c.bypass):
    // - `source: 'form_submitted'` + pendingFormToolCall set → form 제출 처리
    //   (JSON parse → tool_result splice → presentation_user thread push)
    // - `source: 'ai_message'` + pendingFormToolCall set → **form bypass** —
    //   사용자가 form 활성 중 일반 텍스트를 보냄. cancelled tool_result
    //   ({type:'cancelled', reason:'user_sent_message_instead'}) 로 채워
    //   LLM 의 tool_use ↔ tool_result 매칭 요건을 충족 + pendingFormToolCall
    //   클리어 + 정상 ai_user turn 진행.
    // - pendingFormToolCall 없음 → 기존 fallback (JSON 형태 userMessage 라면
    //   warn log) + 정상 ai_user turn.
    //
    // SoT: spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c / step 2.c.bypass.
    const messageSource: ResumableMessageSource =
      options?.source ?? 'ai_message';
    const pendingFormToolCall = state.pendingFormToolCall as
      | { toolCallId: string; formConfig: Record<string, unknown> }
      | undefined;
    if (pendingFormToolCall && messageSource === 'form_submitted') {
      let formData: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(userMessage) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') formData = parsed;
      } catch {
        // userMessage was plain text — keep it as a single `__raw__` field
        // so the LLM still receives the input rather than an empty object.
        formData = { __raw__: userMessage };
      }
      const stubIndex = messages.findIndex(
        (m) =>
          m.role === 'tool' && m.toolCallId === pendingFormToolCall.toolCallId,
      );
      // spec §12.7 — formData 크기 cap. cap 초과 시 string 필드 균등 truncate
      // + formDataTruncation 메타 부착. 비-string 필드 (number/boolean/array/
      // object) 는 보존.
      const { capped: cappedFormData, formDataTruncation } = capFormDataBytes(
        formData,
        FORM_SUBMITTED_MAX_BYTES,
      );
      const newToolResult: ChatMessage = {
        role: 'tool',
        toolCallId: pendingFormToolCall.toolCallId,
        // spec/4-nodes/3-ai/1-ai-agent.md §12.6 — 가드 필드 `ok:true` +
        // `message` 보강. 기존 `{type, data}` SoT 는 유지하여 4-layer SSOT 의
        // 다른 layer (NodeOutput interaction.type / internal bus sentinel /
        // WS wire) 영향 0. system prompt 의 재호출 금지 가드 패턴 (`ok:true`)
        // 과 매칭되도록 신호 복원 + `message` 로 명시적 후속 행동 유도.
        content: JSON.stringify({
          ok: true,
          type: 'form_submitted',
          data: cappedFormData,
          message: FORM_SUBMITTED_GUIDANCE_MESSAGE,
          ...(formDataTruncation ? { formDataTruncation } : {}),
        }),
      };
      if (stubIndex >= 0) {
        messages[stubIndex] = newToolResult;
      } else {
        messages.push(newToolResult);
      }
      // ConversationThread push — presentation_user with ai_render sentinel.
      const formHolder = this.threadHolderFromState(state);
      if (this.conversationThreadService && formHolder) {
        this.conversationThreadService.appendPresentationInteraction(
          formHolder,
          {
            node: this.buildAiNodeRefFromState(state),
            interaction: {
              type: 'form_submitted',
              data: { ...formData, via: 'ai_render' },
              receivedAt: new Date().toISOString(),
            },
          },
        );
      }
      // Clear pendingFormToolCall so subsequent turns return to normal chat
      // flow unless the LLM re-emits render_form.
      delete state.pendingFormToolCall;
    } else if (pendingFormToolCall && messageSource === 'ai_message') {
      // spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c.bypass — 사용자가 form
      // 활성 중 일반 채팅을 보낸 경우. render_form tool_use 의 tool_result 를
      // cancelled 신호로 채워 Anthropic/OpenAI 의 tool_use ↔ tool_result 매칭
      // 요건을 충족시키고, 본 user 메시지는 정상 ai_user turn 으로 진행.
      // LLM 은 form 호출이 취소됐다는 신호를 받고 다음 reasoning 에서
      // form 재호출 / 텍스트 응답 / 다른 도구 호출을 자율 결정.
      const stubIndex = messages.findIndex(
        (m) =>
          m.role === 'tool' && m.toolCallId === pendingFormToolCall.toolCallId,
      );
      const cancelledToolResult: ChatMessage = {
        role: 'tool',
        toolCallId: pendingFormToolCall.toolCallId,
        content: JSON.stringify({
          type: 'cancelled',
          reason: 'user_sent_message_instead',
        }),
      };
      if (stubIndex >= 0) {
        messages[stubIndex] = cancelledToolResult;
      } else {
        messages.push(cancelledToolResult);
      }
      delete state.pendingFormToolCall;
      // Add user message (normal chat path) — same as the no-pending branch.
      messages.push({ role: 'user', content: userMessage });
      this.pushAiThreadTurn(
        this.threadHolderFromState(state),
        this.buildAiNodeRefFromState(state),
        'ai_user',
        userMessage,
      );
    } else {
      // pendingFormToolCall 없음. source 와 무관하게 정상 ai_user turn 진행.
      // form_submitted source 인데 pendingFormToolCall 가 누락된 케이스 (race /
      // 사용자가 render_form 없는 turn 에 직접 execution.submit_form 전송 등)
      // 는 spec/4-nodes/6-presentation/0-common.md §10.9 §Rationale 마지막
      // 단락의 fallback — warn log + plain ai_user.
      if (
        messageSource === 'form_submitted' &&
        ((userMessage ?? '').startsWith('{') ||
          (userMessage ?? '').startsWith('['))
      ) {
        AiAgentHandler.logger.warn(
          `processMultiTurnMessageInner — pendingFormToolCall 없음, JSON 형태 userMessage 를 plain ai_user 메시지로 fallback. spec §10.9 §Rationale (pendingFormToolCall 누락 fallback).`,
        );
      }
      messages.push({ role: 'user', content: userMessage });
      this.pushAiThreadTurn(
        this.threadHolderFromState(state),
        this.buildAiNodeRefFromState(state),
        'ai_user',
        userMessage,
      );
    }

    // Capture render_form blocking signal across the tool loop. Set when a
    // batch processes a `render_form` tool_use; checked after each batch to
    // break the loop and enter waiting_for_input (spec §6.1.d.ii / §6.2).
    let pendingFormBlock:
      | { toolCallId: string; formConfig: Record<string, unknown> }
      | undefined;

    const llmConfigId = state.llmConfigId as string | undefined;
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );
    const model = state.model as string;
    const temperature = state.temperature as number | undefined;
    const maxTokens = state.maxTokens as number | undefined;
    // multi-turn resume 시 buildTools 에 전달할 config 은 turn-1 에서 수집한 state 를 사용.
    // 도구 연결(`toolNodeIds` / `toolOverrides`)은 스키마 제거 — 재작성 시 신규 필드로 복원.
    const turnConfig: Record<string, unknown> = {
      mode: 'multi_turn',
      knowledgeBases,
      ragTopK: state.ragTopK,
      ragThreshold: state.ragThreshold,
      mcpServers: state.mcpServers,
      conditions,
      // Presentation tools (`render_*`) — spec §4.1. multi-turn state snapshot
      // preserves the original rawConfig array so resume turns can still build
      // the same render_* ToolDefs (RenderToolProvider reads ctx.config).
      presentationTools: state.presentationTools ?? [],
    };
    const executionId = state.executionId as string | undefined;
    const tools = await this.buildTools(
      turnConfig,
      workspaceId,
      executionId,
      mcpDiagnosticsAcc,
    );

    const turnStartedAt = Date.now();
    const toolsDef = tools.length > 0 ? tools : undefined;
    const chatParams = {
      model,
      messages: [...messages],
      temperature,
      maxTokens,
      tools: toolsDef,
    };
    const llmCalls: Array<{
      requestPayload: unknown;
      responsePayload: unknown;
      durationMs: number;
    }> = [];
    const toolCallTraces: ToolCallTrace[] = [];
    let callStart = Date.now();
    let result = await this.llmService.chat(llmConfig, {
      model,
      messages,
      temperature,
      maxTokens,
      tools: toolsDef,
    });
    llmCalls.push({
      requestPayload: chatParams,
      responsePayload: result,
      durationMs: Date.now() - callStart,
    });

    while (
      result.toolCalls?.length &&
      toolCallCount < maxToolCalls &&
      !pendingFormBlock
    ) {
      const classification = this.classifyToolCalls(
        result.toolCalls,
        conditions,
      );

      // Condition-only: route immediately.
      if (
        classification.providerToolCalls.length === 0 &&
        classification.normalToolCalls.length === 0 &&
        classification.matchedCondition
      ) {
        const reason = this.extractConditionReason(
          result.toolCalls,
          classification.matchedCondition.id,
        );
        messages.push({ role: 'assistant', content: result.content || '' });
        // ConversationThread push (spec §2.2 — multi-turn ai_assistant on
        // condition route). render_* display-only payloads accumulated from
        // earlier batch iterations attach here (spec §7.10).
        this.pushAiThreadTurn(
          this.threadHolderFromState(state),
          this.buildAiNodeRefFromState(state),
          'ai_assistant',
          result.content || '',
          undefined,
          presentationPayloads.length > 0 ? presentationPayloads : undefined,
        );

        totalInputTokens += result.usage?.inputTokens ?? 0;
        totalOutputTokens += result.usage?.outputTokens ?? 0;
        totalThinkingTokens += result.usage?.thinkingTokens ?? 0;

        const prevHistory = (state.turnDebugHistory as unknown[]) || [];
        const condTurnDebugHistory = [
          ...prevHistory,
          {
            turnIndex: turnCount,
            llmCalls,
            totalDurationMs: Date.now() - turnStartedAt,
            ...(toolCallTraces.length > 0
              ? { toolCalls: [...toolCallTraces] }
              : {}),
            ragSources: turnRagAcc.getSources(),
            ragDiagnostics: turnRagAcc.getDiagnostics(),
          },
        ];

        return this.buildConditionOutput(
          classification.matchedCondition,
          reason,
          messages,
          turnCount,
          {
            model,
            totalInputTokens,
            totalOutputTokens,
            totalThinkingTokens,
            toolCalls: toolCallCount,
            ragSources: ragAcc.getSources(),
            ragDiagnostics: ragAcc.getDiagnostics(),
            mcpServerSummaries: mcpDiagnosticsAcc,
            presentationCalls:
              presentationCalls.length > 0 ? presentationCalls : undefined,
            presentationSchemaViolations:
              presentationSchemaViolations.length > 0
                ? presentationSchemaViolations
                : undefined,
            allPresentations: [
              ...((state.allPresentations as
                | PresentationPayload[]
                | undefined) ?? []),
              ...presentationPayloads,
            ],
          },
          { llmCalls, totalDurationMs: Date.now() - turnStartedAt },
          condTurnDebugHistory,
          state.rawConfig as Record<string, unknown> | undefined,
        );
      }

      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });
      // Tool-loop assistant push (multi-turn opt-in via state.rawConfig
      // .includeToolTurns).
      if (
        this.isToolTurnsEnabled(
          state.rawConfig as Record<string, unknown> | undefined,
        )
      ) {
        this.pushAiThreadTurn(
          this.threadHolderFromState(state),
          this.buildAiNodeRefFromState(state),
          'ai_assistant',
          result.content || '',
          result.toolCalls as ConversationTurnToolCall[] | undefined,
        );
      }

      // single-turn 과 동일하게 단일 진입점을 사용. resume state 는 새 turn 의
      // nodeId/nodeExecutionId 를 운반하지 않으므로 ?? '' fallback 만 다르다.
      // (usage logs / WS 이벤트는 원래 waiting NodeExecution 에 귀속)
      const { executedCount: providerExecuted, blockingFormRender } =
        await this.executeProviderToolBatch({
          calls: classification.providerToolCalls,
          remainingBudget: maxToolCalls - toolCallCount,
          executionId: executionId ?? '',
          nodeId: (state.nodeId as string | undefined) ?? '',
          nodeExecutionId: state.nodeExecutionId as string | undefined,
          workflowId: state.workflowId as string | undefined,
          workspaceId,
          config: turnConfig,
          turnIndex: turnCount,
          ragGroup,
          toolCallTraces,
          messages,
          presentationPayloads,
          presentationCalls,
          presentationSchemaViolations,
          presentationViolationCounters,
        });
      toolCallCount += providerExecuted;
      // render_form interactive: enter waiting_for_input flow (spec §6.1.d.ii).
      // Capture the first signal and break the tool loop — the assistant's
      // tool_use message + the provider's stub tool_result are already in
      // `messages`, so the LLM context is well-formed for the resume turn.
      if (blockingFormRender && !pendingFormBlock) {
        pendingFormBlock = blockingFormRender;
      }

      for (const tc of classification.conditionToolCalls) {
        toolCallCount++;
        const condDeferralContent = JSON.stringify({
          result:
            '확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.',
        });
        messages.push({
          role: 'tool',
          content: condDeferralContent,
          toolCallId: tc.id,
        });
        if (
          this.isToolTurnsEnabled(
            state.rawConfig as Record<string, unknown> | undefined,
          )
        ) {
          this.pushAiToolResultTurn(
            this.threadHolderFromState(state),
            this.buildAiNodeRefFromState(state),
            tc.id,
            condDeferralContent,
          );
        }
      }

      for (const tc of classification.normalToolCalls) {
        if (toolCallCount >= maxToolCalls) {
          const budgetContent = JSON.stringify({
            error: 'tool_call_budget_exceeded',
          });
          messages.push({
            role: 'tool',
            content: budgetContent,
            toolCallId: tc.id,
          });
          if (
            this.isToolTurnsEnabled(
              state.rawConfig as Record<string, unknown> | undefined,
            )
          ) {
            this.pushAiToolResultTurn(
              this.threadHolderFromState(state),
              this.buildAiNodeRefFromState(state),
              tc.id,
              budgetContent,
            );
          }
          continue;
        }
        toolCallCount++;
        const normalContent = JSON.stringify({
          result: `Tool ${tc.name} executed`,
          arguments: tc.arguments,
        });
        messages.push({
          role: 'tool',
          content: normalContent,
          toolCallId: tc.id,
        });
        if (
          this.isToolTurnsEnabled(
            state.rawConfig as Record<string, unknown> | undefined,
          )
        ) {
          this.pushAiToolResultTurn(
            this.threadHolderFromState(state),
            this.buildAiNodeRefFromState(state),
            tc.id,
            normalContent,
          );
        }
      }

      // Skip the next LLM call when render_form blocking was triggered —
      // the user must submit the form before LLM gets the next turn.
      if (pendingFormBlock) break;

      const loopReq = {
        model,
        messages: [...messages],
        temperature,
        maxTokens,
        tools: toolsDef,
      };
      callStart = Date.now();
      result = await this.llmService.chat(llmConfig, {
        model,
        messages,
        temperature,
        maxTokens,
        tools,
      });
      llmCalls.push({
        requestPayload: loopReq,
        responsePayload: result,
        durationMs: Date.now() - callStart,
      });
    }

    const turnDurationMs = Date.now() - turnStartedAt;
    messages.push({ role: 'assistant', content: result.content || '' });
    // ConversationThread push (spec §2.2 — multi-turn final assistant per
    // turn). The thread accumulates one assistant turn per LLM round-trip;
    // downstream AI Agent nodes with `contextScope` see the running history.
    // render_* display-only payloads emitted during this turn attach to the
    // turn's top-level `presentations[]` (spec §7.10).
    this.pushAiThreadTurn(
      this.threadHolderFromState(state),
      this.buildAiNodeRefFromState(state),
      'ai_assistant',
      result.content || '',
      undefined,
      presentationPayloads.length > 0 ? presentationPayloads : undefined,
    );

    totalInputTokens += result.usage?.inputTokens ?? 0;
    totalOutputTokens += result.usage?.outputTokens ?? 0;
    totalThinkingTokens += result.usage?.thinkingTokens ?? 0;

    const prevHistory = (state.turnDebugHistory as unknown[]) || [];
    const currentTurnDebug = {
      turnIndex: turnCount,
      llmCalls,
      totalDurationMs: turnDurationMs,
      ...(toolCallTraces.length > 0 ? { toolCalls: [...toolCallTraces] } : {}),
      ragSources: turnRagAcc.getSources(),
      ragDiagnostics: turnRagAcc.getDiagnostics(),
    };
    // WARN #5 (DB) — turnDebugHistory 가 무제한 누적되어 outputData JSONB 가
    // 수십 MB 까지 증가하던 문제. 직전 N 턴만 유지 (보통 디버깅·재실행 UI 용도).
    const MAX_TURN_DEBUG_HISTORY = 50;
    const turnDebugHistory = [...prevHistory, currentTurnDebug].slice(
      -MAX_TURN_DEBUG_HISTORY,
    );

    const isLastTurn = maxTurns > 0 && turnCount >= maxTurns;

    if (isLastTurn) {
      return this.buildMultiTurnFinalOutput(
        messages,
        result.content || '',
        turnCount,
        'max_turns',
        {
          model,
          totalInputTokens,
          totalOutputTokens,
          totalThinkingTokens,
          toolCalls: toolCallCount,
          ragSources: ragAcc.getSources(),
          ragDiagnostics: ragAcc.getDiagnostics(),
          mcpServerSummaries: mcpDiagnosticsAcc,
          allPresentations: [
            ...((state.allPresentations as PresentationPayload[] | undefined) ??
              []),
            ...presentationPayloads,
          ],
        },
        { llmCalls, totalDurationMs: turnDurationMs },
        turnDebugHistory,
        state.rawConfig as Record<string, unknown> | undefined,
      );
    }

    // CONVENTIONS Principle 7 — multi-turn resume echo. Engine snapshots
    // `state.rawConfig` (frozen) at the first turn (Phase 1), so the
    // post-resume waiting tick echoes from that snapshot rather than the
    // resolved per-turn `config`. State persisted from before Phase 1 may
    // not have rawConfig — fall back to evaluated state values for both
    // model and systemPrompt to avoid `undefined` echo (review CRIT #1).
    const turnRawConfig =
      (state.rawConfig as Record<string, unknown> | undefined) ?? {};
    const stateSystemPrompt = (state.systemPrompt as string | undefined) ?? '';
    const waitingResult: ResumableNodeHandlerOutput = {
      config: {
        mode: 'multi_turn' as const,
        model: turnRawConfig.model ?? model,
        systemPrompt: turnRawConfig.systemPrompt ?? stateSystemPrompt,
        maxTurns: turnRawConfig.maxTurns ?? maxTurns,
        maxToolCalls: turnRawConfig.maxToolCalls ?? maxToolCalls,
        ...(turnRawConfig.knowledgeBases !== undefined
          ? { knowledgeBases: turnRawConfig.knowledgeBases }
          : knowledgeBases.length > 0
            ? { knowledgeBases }
            : {}),
        ...(turnRawConfig.conditions !== undefined &&
        Array.isArray(turnRawConfig.conditions) &&
        (turnRawConfig.conditions as unknown[]).length > 0
          ? { conditions: turnRawConfig.conditions }
          : conditions.length > 0
            ? { conditions }
            : {}),
      },
      // D6 (2026-05-17) — resumed waiting tick 도 단일 경로로 통일.
      // `maxTurns` 는 config 전용 — output.result 에 echo 안 함 (Principle 1.1).
      output: {
        result: {
          messages,
          message: result.content || '',
          turnCount,
          // spec §4.1·§7.10 — execution engine 이 AI_MESSAGE WS 이벤트에
          // presentations 를 포함시키기 위해 output 에 동봉.
          ...(presentationPayloads.length > 0
            ? { presentations: presentationPayloads }
            : {}),
        },
      },
      meta: {
        // render_form blocking is the same WAITING_FOR_INPUT state machine
        // wise — only the interactionType discriminates so the frontend
        // dispatches `execution.submit_form` instead of `submit_message`.
        // spec/5-system/6-websocket-protocol.md §4.4.
        interactionType: pendingFormBlock
          ? 'ai_form_render'
          : 'ai_conversation',
      },
      status: 'waiting_for_input',
      _resumeState: {
        ...state,
        messages,
        turnCount,
        totalInputTokens,
        totalOutputTokens,
        totalThinkingTokens,
        toolCalls: toolCallCount,
        ragSources: ragAcc.getSources().slice(-MAX_RESUME_RAG_SOURCES),
        ragLastDiagnostics: ragAcc.getDiagnostics(),
        lastTurnRequest: chatParams,
        lastTurnResponse: result,
        lastTurnDurationMs: turnDurationMs,
        turnDebugHistory,
        // spec §7.4 — pendingFormToolCall set when render_form triggered
        // blocking. Resumed turn re-attaches submission to this toolCallId.
        ...(pendingFormBlock ? { pendingFormToolCall: pendingFormBlock } : {}),
        // Accumulate render_* payloads across turns so execution-history
        // (NodeExecution.outputData) can echo them even after multi-turn
        // resumes that overwrite the assistant turn buffer.
        allPresentations: [
          ...((state.allPresentations as PresentationPayload[] | undefined) ??
            []),
          ...presentationPayloads,
        ],
      },
    };
    // Attach form preview into the resumed output.interaction shape so the
    // frontend can render the form fields immediately (without waiting for
    // the next ai_message). Mirrors presentation Form node's blocking flow.
    if (pendingFormBlock) {
      const interactionWrapper = waitingResult.output as
        | Record<string, unknown>
        | undefined;
      if (interactionWrapper) {
        interactionWrapper.interaction = {
          type: 'ai_form_render',
          data: {
            toolCallId: pendingFormBlock.toolCallId,
            formConfig: pendingFormBlock.formConfig,
          },
          receivedAt: new Date().toISOString(),
        };
      }
    }
    return waitingResult;
  }

  /**
   * Engine-facing entry point used when the user ends a conversation or the
   * per-turn timer fires. Unpacks the accumulated multi-turn state and
   * delegates to the in-handler {@link buildMultiTurnFinalOutput}.
   *
   * `errorPayload` (2026-05-19): spec/4-nodes/3-ai/1-ai-agent.md §7.9 의
   * multi-turn 오류 종결 경로에서 엔진의 `handleAiTurnError` 가 LLM throw 의
   * sanitized 결과 (`code` / `message` / `details`) 를 본 entry 로 전달한다.
   * 그 외 정상 종결 (`user_ended` / `max_turns` / `condition`) 에서는 undefined.
   */
  endMultiTurnConversation(
    state: Record<string, unknown>,
    endReason: 'user_ended' | 'max_turns' | 'condition' | 'error',
    errorPayload?: { code: string; message: string; details?: unknown },
    failedUserMessage?: string,
    failedUserMessageSource?: ResumableMessageSource,
  ): unknown {
    const messages = (state.messages as ChatMessage[]) ?? [];
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const lastResponse = (lastMsg?.content as string) ?? '';
    return this.buildMultiTurnFinalOutput(
      messages,
      lastResponse,
      (state.turnCount as number) ?? 0,
      endReason,
      {
        model: state.model as string,
        totalInputTokens: (state.totalInputTokens as number) ?? 0,
        totalOutputTokens: (state.totalOutputTokens as number) ?? 0,
        totalThinkingTokens: (state.totalThinkingTokens as number) ?? 0,
        toolCalls: (state.toolCalls as number) ?? 0,
        ragSources: (state.ragSources as unknown[]) ?? [],
        ragDiagnostics: state.ragLastDiagnostics as RagDiagnostics | undefined,
        allPresentations:
          (state.allPresentations as PresentationPayload[] | undefined) ?? [],
      },
      undefined,
      (state.turnDebugHistory as unknown[]) ?? [],
      state.rawConfig as Record<string, unknown> | undefined,
      errorPayload,
      // spec §7.9 — retryable error 종결 시 본 state 의 부분집합이 top-level
      // `_retryState` 로 운반된다. buildMultiTurnFinalOutput 가 retryable
      // 여부를 errorPayload.details 에서 판정하므로, source 는 항상 넘긴다.
      state,
      // spec §7.9 — 실패한 turn 의 사용자 메시지 (+ source). retry 재진입이
      // 마지막 turn 을 replay 하기 위해 `_retryState` 에 운반한다.
      failedUserMessage,
      failedUserMessageSource,
    );
  }

  buildMultiTurnFinalOutput(
    messages: ChatMessage[],
    lastResponse: string,
    turnCount: number,
    endReason: 'user_ended' | 'max_turns' | 'condition' | 'error',
    metadata: {
      model: string;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalThinkingTokens?: number;
      toolCalls: number;
      ragSources: unknown[];
      ragDiagnostics?: RagDiagnostics;
      mcpServerSummaries?: McpServerSummary[];
      /**
       * spec §7.10 echo — accumulated render_* payloads across all turns of
       * this multi-turn execution. Used by the execution history page that
       * only fetches NodeExecution.outputData (no live thread snapshot).
       */
      allPresentations?: PresentationPayload[];
    },
    turnDebug?: {
      llmCalls?: unknown[];
      totalDurationMs?: number;
    },
    turnDebugHistory?: unknown[],
    rawConfig?: Record<string, unknown>,
    errorPayload?: { code: string; message: string; details?: unknown },
    /**
     * spec/4-nodes/3-ai/1-ai-agent.md §7.9 + spec/5-system/4-execution-engine.md
     * §1.3 — retryable error (`errorPayload.details.retryable === true`) 종결
     * 시 본 multi-turn state 의 부분집합을 top-level `_retryState` 로 운반해
     * DB 영속한다. 정상 종결 / 비-retryable error 에서는 undefined 이면 되고,
     * 그 경우 `_retryState` 키 자체가 생성되지 않는다 (회귀 가드).
     */
    retryStateSource?: Record<string, unknown>,
    /**
     * spec/4-nodes/3-ai/1-ai-agent.md §7.9 — 실패한 turn 을 일으킨 사용자
     * 메시지 (+ dispatch source). `messages` snapshot 에 포함되지 않으므로
     * `_retryState.lastUserMessage` 로 운반해 retry 재진입이 replay 한다.
     */
    failedUserMessage?: string,
    failedUserMessageSource?: ResumableMessageSource,
  ): NodeHandlerOutput {
    // CONVENTIONS §8 — wrap conversation result under `output.result.*`.
    // Tokens + tool-call counts go to `meta.*` (Principle 2). The legacy
    // `interactionType: 'ai_conversation'` marker moves to `meta.interactionType`
    // so the run-results UI's conversation Preview tab keeps rendering.
    //
    // Port routing per spec §3.2 (Multi Turn 출력 포트):
    //  - `user_ended` → `user_ended`
    //  - `max_turns` → `max_turns`
    //  - `error` → `error`
    //  - `condition` → caller must use `buildConditionOutput` so that the
    //     dynamic `{condition.id}` port is set; if it ever leaks here we
    //     fall back to `error` (defensive — there is no generic `out` port
    //     in multi-turn mode).
    const port = AiAgentHandler.multiTurnPortForEndReason(endReason);
    // spec §7.9 (2026-05-19) — multi-turn 오류 종결 시 `output.error.{code,
    // message, details}` 와 부분 `output.result.*` 가 병존한다. caller (엔진
    // `handleAiTurnError`) 가 sanitized errorPayload 를 전달하면 함께 set.
    // 정상 종결 (user_ended / max_turns / condition) 에서는 errorPayload 가
    // undefined 이라 `output.error` 키 자체가 생기지 않는다 (회귀 가드).
    const output: Record<string, unknown> = {
      result: {
        response: lastResponse,
        messages,
        turnCount,
        endReason,
        // spec §7.10 echo — execution history page (NodeExecution.outputData)
        // 가 thread snapshot 을 별도로 fetch 하지 않으므로 여기 echo 한다.
        ...(metadata.allPresentations && metadata.allPresentations.length > 0
          ? { presentations: metadata.allPresentations }
          : {}),
      },
    };
    if (errorPayload) {
      output.error = errorPayload;
    }
    // spec §7.9 / execution-engine §1.3 — retryable error 종결 시에만 top-level
    // `_retryState` 를 운반한다. `_resumeState` 의 부분집합 + `expiresAt` (TTL).
    // credential (llmConfigId 가 가리키는 provider secret) 은 포함하지 않으며
    // `maskSensitiveFields` boundary 와 동일 정책. retryable !== true 면 미동봉.
    const retryDetails = (errorPayload?.details ?? undefined) as
      | { retryable?: unknown }
      | undefined;
    const isRetryable = retryDetails?.retryable === true;
    const retryState =
      isRetryable && retryStateSource
        ? AiAgentHandler.buildRetryState(
            retryStateSource,
            messages,
            turnCount,
            {
              totalInputTokens: metadata.totalInputTokens,
              totalOutputTokens: metadata.totalOutputTokens,
              toolCalls: metadata.toolCalls,
              model: metadata.model,
            },
            failedUserMessage,
            failedUserMessageSource,
          )
        : undefined;
    return {
      config: this.buildMultiTurnConfigEcho(rawConfig, metadata.model),
      output,
      ...(retryState ? { _retryState: retryState } : {}),
      meta: {
        durationMs: turnDebug?.totalDurationMs ?? 0,
        model: metadata.model,
        interactionType: 'ai_conversation',
        inputTokens: metadata.totalInputTokens,
        outputTokens: metadata.totalOutputTokens,
        totalTokens: metadata.totalInputTokens + metadata.totalOutputTokens,
        thinkingTokens: metadata.totalThinkingTokens ?? 0,
        toolCalls: metadata.toolCalls,
        ragSources: metadata.ragSources,
        ragDiagnostics: metadata.ragDiagnostics,
        ...(AiAgentHandler.buildMcpDiagnosticsMeta(
          metadata.mcpServerSummaries,
        ) ?? {}),
        turnDebug: turnDebugHistory ?? [],
      },
      port,
      status: 'ended',
    };
  }

  /**
   * Map a multi-turn `endReason` to the corresponding output port id per
   * spec §3.2. Centralised so {@link buildMultiTurnFinalOutput} and any
   * future error-routing helper share a single source of truth.
   *
   * `condition` should never reach this function — `buildConditionOutput`
   * routes to the dynamic `{condition.id}` port instead. We map it to
   * `error` defensively so a programming mistake surfaces as an error
   * rather than a silent mis-route.
   */
  /**
   * spec/4-nodes/3-ai/1-ai-agent.md §7.9 + spec/conventions/node-output.md
   * §4.2.1 — build the top-level `_retryState` for a retryable multi-turn
   * error termination. Shape = subset of `_resumeState` (the fields needed to
   * re-run the failed last turn) + `expiresAt` (ISO 8601 TTL).
   *
   * Credentials (the `llmConfigId` that points at a provider secret) are NOT
   * included — same masking policy as `_resumeState` (`maskSensitiveFields`
   * boundary strip). We deliberately allow-list the carried keys rather than
   * spread the whole state so no secret / oversized bookkeeping leaks in.
   */
  private static buildRetryState(
    source: Record<string, unknown>,
    messages: ChatMessage[],
    turnCount: number,
    accounting: {
      totalInputTokens: number;
      totalOutputTokens: number;
      toolCalls: number;
      model: string;
    },
    failedUserMessage?: string,
    failedUserMessageSource?: ResumableMessageSource,
  ): Record<string, unknown> {
    const ttlMinutes = resolveRetryStateTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
    const pendingFormToolCall = source.pendingFormToolCall as
      | Record<string, unknown>
      | undefined;
    return {
      messages,
      turnCount,
      totalInputTokens: accounting.totalInputTokens,
      totalOutputTokens: accounting.totalOutputTokens,
      totalThinkingTokens:
        (source.totalThinkingTokens as number | undefined) ?? 0,
      toolCalls: accounting.toolCalls,
      model: (source.model as string | undefined) ?? accounting.model,
      temperature: source.temperature,
      maxTokens: source.maxTokens,
      knowledgeBases: (source.knowledgeBases as unknown[] | undefined) ?? [],
      ragTopK: source.ragTopK,
      ragThreshold: source.ragThreshold,
      ragSources: (source.ragSources as unknown[] | undefined) ?? [],
      mcpServers: (source.mcpServers as unknown[] | undefined) ?? [],
      // NOTE — credential / context-binding 필드 (`llmConfigId`, `workspaceId`,
      // `executionId`, `presentationTools`, `conditions`, `maxTurns` 등) 는
      // **의도적으로 미동봉**. `_retryState` 는 DB 영속이므로 credential 참조를
      // 담지 않는다 (spec §7.9 — `_resumeState` 와 동일 masking 정책; 회귀 테스트
      // "_retryState … NO credentials" 가 강제). retry 재진입(`applyRetryLastTurn`)
      // 이 이 필드들을 node.config / context 에서 재유도한다.
      ...(pendingFormToolCall ? { pendingFormToolCall } : {}),
      // spec §7.9 — 실패한 turn 의 사용자 메시지. retry 재진입(`applyRetryLastTurn`)
      // 이 이 메시지를 `ai_message` action 으로 replay 해 마지막 LLM 호출을
      // 재실행한다. messages snapshot 에는 포함되지 않는다 (pre-turn history).
      // S2: 길이 제한 적용 — 사용자 입력 원문을 길이 제한 없이 DB 영속하면 PII
      // 노출·스토리지 증가 위험. truncateForErrorDetails(500자 기본) 로 cap.
      ...(typeof failedUserMessage === 'string'
        ? {
            lastUserMessage:
              truncateForErrorDetails(failedUserMessage) ?? failedUserMessage,
            lastUserMessageSource: failedUserMessageSource ?? 'ai_message',
          }
        : {}),
      expiresAt,
    };
  }

  private static multiTurnPortForEndReason(
    endReason: 'user_ended' | 'max_turns' | 'condition' | 'error',
  ): string {
    switch (endReason) {
      case 'user_ended':
        return 'user_ended';
      case 'max_turns':
        return 'max_turns';
      case 'error':
        return 'error';
      case 'condition':
      default:
        return 'error';
    }
  }

  /**
   * Build condition-triggered output with port routing.
   */
  private buildConditionOutput(
    condition: ConditionDef,
    reason: string,
    messages: ChatMessage[],
    turnCount: number,
    metadata: {
      model: string;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalThinkingTokens?: number;
      toolCalls: number;
      ragSources: unknown[];
      ragDiagnostics?: RagDiagnostics;
      mcpServerSummaries?: McpServerSummary[];
      /** spec §7.10 — render_* metric trace. */
      presentationCalls?: PresentationCallTrace[];
      /** spec §4.1 silent-drop trace. */
      presentationSchemaViolations?: PresentationSchemaViolation[];
      /** spec §7.10 echo — accumulated render_* payloads for execution-history view. */
      allPresentations?: PresentationPayload[];
    },
    turnDebug?: {
      llmCalls?: unknown[];
      totalDurationMs?: number;
    },
    turnDebugHistory?: unknown[],
    rawConfig?: Record<string, unknown>,
  ): NodeHandlerOutput {
    const lastMsg = messages[messages.length - 1];
    const lastResponse = lastMsg?.content ?? '';

    return {
      config: this.buildMultiTurnConfigEcho(rawConfig, metadata.model),
      output: {
        result: {
          response: lastResponse,
          messages,
          turnCount,
          endReason: 'condition' as const,
          condition: {
            id: condition.id,
            label: condition.label,
            reason,
          },
          ...(metadata.allPresentations && metadata.allPresentations.length > 0
            ? { presentations: metadata.allPresentations }
            : {}),
        },
      },
      meta: {
        durationMs: turnDebug?.totalDurationMs ?? 0,
        model: metadata.model,
        interactionType: 'ai_conversation',
        inputTokens: metadata.totalInputTokens,
        outputTokens: metadata.totalOutputTokens,
        totalTokens: metadata.totalInputTokens + metadata.totalOutputTokens,
        thinkingTokens: metadata.totalThinkingTokens ?? 0,
        toolCalls: metadata.toolCalls,
        ragSources: metadata.ragSources,
        ragDiagnostics: metadata.ragDiagnostics,
        ...(AiAgentHandler.buildMcpDiagnosticsMeta(
          metadata.mcpServerSummaries,
        ) ?? {}),
        ...(metadata.presentationCalls
          ? { presentationCalls: metadata.presentationCalls }
          : {}),
        ...(metadata.presentationSchemaViolations
          ? {
              presentationSchemaViolations:
                metadata.presentationSchemaViolations,
            }
          : {}),
        turnDebug: turnDebugHistory ?? [],
      },
      port: condition.id,
      status: 'ended',
    };
  }

  // CONVENTIONS Principle 7 — multi-turn ended/condition echo. Surfaces the
  // frozen rawConfig (engine merges it into both `context.rawConfig` and
  // `state.rawConfig`) symmetric with the inline echoes at the initial /
  // resumed waiting ticks. Empty arrays are excluded uniformly across
  // `knowledgeBases` and `conditions` to match the waiting-tick echo
  // (line ~870 / ~1213) — surfacing `[]` would mislead downstream nodes
  // into treating "no entries configured" as "configured but empty".
  private buildMultiTurnConfigEcho(
    rawConfig: Record<string, unknown> | undefined,
    fallbackModel: string,
  ): Record<string, unknown> {
    const raw = (rawConfig ?? {}) as RawAiAgentMultiTurnConfig;
    const echo: Record<string, unknown> = {
      mode: raw.mode ?? 'multi_turn',
      model: raw.model ?? fallbackModel,
    };
    if (raw.systemPrompt !== undefined) echo.systemPrompt = raw.systemPrompt;
    if (raw.userPrompt !== undefined) echo.userPrompt = raw.userPrompt;
    if (raw.maxTurns !== undefined) echo.maxTurns = raw.maxTurns;
    if (raw.maxToolCalls !== undefined) echo.maxToolCalls = raw.maxToolCalls;
    if (raw.responseFormat !== undefined)
      echo.responseFormat = raw.responseFormat;
    if (Array.isArray(raw.knowledgeBases) && raw.knowledgeBases.length > 0) {
      echo.knowledgeBases = raw.knowledgeBases;
    }
    if (Array.isArray(raw.conditions) && raw.conditions.length > 0) {
      echo.conditions = raw.conditions;
    }
    // spec §11.7 — default 일치 시 생략, 명시 변경 시 echo.
    Object.assign(echo, pickNonDefaultSystemContext(rawConfig));
    return echo;
  }

  /**
   * Classify tool calls into provider (KB 등 핸들러 내부 실행), condition,
   * normal (외부 노드 stub) 그룹으로 분리. condition 다중 호출 시 conditions
   * 배열에서 가장 앞쪽 정의된 항목을 winner 로 채택.
   */
  private classifyToolCalls(
    toolCalls: ToolCall[],
    conditions: ConditionDef[],
  ): ConditionClassification {
    const condNameToCondition = new Map<string, ConditionDef>();
    for (const c of conditions) {
      condNameToCondition.set(condToolName(c.id), c);
    }

    const providerToolCalls: Array<{
      provider: AgentToolProvider;
      call: ToolCall;
    }> = [];
    const conditionToolCalls: ToolCall[] = [];
    const normalToolCalls: ToolCall[] = [];

    for (const tc of toolCalls) {
      const matchedProvider = this.toolProviders.find((p) =>
        p.matches(tc.name),
      );
      if (matchedProvider) {
        providerToolCalls.push({ provider: matchedProvider, call: tc });
      } else if (condNameToCondition.has(tc.name)) {
        conditionToolCalls.push(tc);
      } else {
        normalToolCalls.push(tc);
      }
    }

    let matchedCondition: ConditionDef | null = null;
    if (conditionToolCalls.length > 0) {
      let lowestIndex = Infinity;
      for (const ctc of conditionToolCalls) {
        const cond = condNameToCondition.get(ctc.name);
        if (cond) {
          const idx = conditions.indexOf(cond);
          if (idx !== -1 && idx < lowestIndex) {
            lowestIndex = idx;
            matchedCondition = cond;
          }
        }
      }
    }

    return {
      providerToolCalls,
      conditionToolCalls,
      normalToolCalls,
      matchedCondition,
    };
  }

  /**
   * Extract the reason argument from a condition tool call.
   */
  private extractConditionReason(
    toolCalls: ToolCall[],
    conditionId: string,
  ): string {
    const name = condToolName(conditionId);
    const tc = toolCalls.find((t) => t.name === name);
    if (!tc) return '';
    try {
      const args = JSON.parse(tc.arguments) as Record<string, unknown>;
      const reason = typeof args.reason === 'string' ? args.reason : '';
      return reason.slice(0, 500);
    } catch {
      return '';
    }
  }

  /**
   * Build system prompt suffix that instructs the LLM about available conditions.
   */
  private buildConditionSystemPromptSuffix(conditions: ConditionDef[]): string {
    const condList = conditions
      .map((c) => `- ${condToolName(c.id)}: ${c.prompt}`)
      .join('\n');
    return `\n\n[조건 안내] 대화 중 아래 조건에 해당하는 상황이 감지되면, 해당 조건 도구를 호출하세요:\n${condList}\n조건에 해당하지 않으면 대화를 계속하세요.`;
  }

  /**
   * spec/5-system/11-mcp-client.md §6.2 — buildTools 가 수집한 serverSummaries
   * 를 meta 로 emit 할 때 쓰는 helper. 비어있으면 omit (정상 케이스에 noise
   * 추가 안 함). 2026-05-18 시점에는 `mcpDiagnostics` 의 `serverSummaries`
   * slice 만 채워지며 (`attempted`/`serverCount`/`toolCalls`/`resourceReads`/
   * `promptGets`/`errors`) 는 후속 작업에서 추가 예정.
   */
  private static buildMcpDiagnosticsMeta(
    summaries: McpServerSummary[] | undefined,
  ): { mcpDiagnostics: { serverSummaries: McpServerSummary[] } } | undefined {
    if (!summaries || summaries.length === 0) return undefined;
    return { mcpDiagnostics: { serverSummaries: summaries } };
  }

  private async buildTools(
    config: Record<string, unknown>,
    workspaceId: string,
    executionId?: string,
    mcpDiagnostics?: McpServerSummary[],
  ): Promise<ToolDef[]> {
    // 일반 도구(`tool_*`) 입력 경로는 스키마에서 제거됨 — 재작성 시 새 디자인으로 복원.
    // 스키마 .passthrough() 로 DB 의 legacy toolNodeIds/toolOverrides 는 silently
    // 통과하지만 여기서 읽지 않으므로 LLM 에 등록되지 않는다.
    const normalTools: ToolDef[] = [];
    const conditions = (config.conditions as ConditionDef[]) || [];

    // Provider tools (KB / MCP 등) — 핸들러 내부 실행. 우선순위 가장 높음.
    const providerTools: ToolDef[] = [];
    for (const provider of this.toolProviders) {
      try {
        const built = await provider.buildTools({
          config,
          workspaceId,
          executionId,
          mcpDiagnostics,
        });
        providerTools.push(...built);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        AiAgentHandler.logger.warn(
          `Provider "${provider.key}" buildTools failed: ${msg}`,
        );
      }
    }

    const conditionTools: ToolDef[] = conditions.map((c) => ({
      name: condToolName(c.id),
      description: c.prompt,
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: '이 조건을 선택한 이유',
          },
        },
      },
    }));

    return [...providerTools, ...normalTools, ...conditionTools];
  }

  private static readonly logger = new Logger('AiAgentHandler');
}
