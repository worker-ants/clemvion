import { Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  ToolCall,
  ToolDef,
} from '../../../../modules/llm/interfaces/llm-client.interface';
import { tableNodeConfigSchema } from '../../../presentation/table/table.schema';
import { chartConfigSchema } from '../../../presentation/chart/chart.schema';
import { carouselNodeConfigSchema } from '../../../presentation/carousel/carousel.schema';
import { templateNodeConfigSchema } from '../../../presentation/template/template.schema';
import { formNodeConfigSchema } from '../../../presentation/form/form.schema';
import type {
  PresentationPayload,
  PresentationType,
} from '../../../../shared/conversation-thread/conversation-thread.types';
import {
  AgentToolProvider,
  AgentToolResult,
  ProviderBuildCtx,
  ProviderExecCtx,
} from './agent-tool-provider.interface';

/**
 * Presentation Tool Family (`render_*`) — AI Agent 가 LLM 응답 surface 를
 * 텍스트에서 5종 (table·chart·carousel·template·form) 가상 도구로 확장.
 *
 * SoT: spec/4-nodes/3-ai/1-ai-agent.md §4.1
 *      spec/4-nodes/6-presentation/0-common.md §10
 *
 * - Display-only 4종 (`render_table`/`chart`/`carousel`/`template`): payload 를
 *   해당 presentation node 의 zod schema 로 validate → defaults overlay →
 *   1MB cap → ConversationTurn top-level `presentations[]` 에 push → tool_result
 *   `{ok:true}` 스텁 회신. round-trip 불필요.
 *
 * - `render_form` (interactive): 위와 동일하게 schema validate + defaults overlay
 *   까지 수행한 뒤, blockingFormRender 신호를 handler 에 넘긴다. handler 가
 *   `status: 'waiting_for_input'` + `interactionType: 'ai_form_render'` 흐름으로
 *   진입.
 *
 * - Schema 위반·1MB cap 초과: tool_result 에 error 회신. handler 가 재시도 1회
 *   카운트 관리 (`presentationCall.status === 'schema_violation'`), 초과 시
 *   silent drop (`status: 'dropped'`).
 */

/** Per-tool zod schema map — single source of truth for tool parameter shape. */
const SCHEMA_BY_TYPE: Record<PresentationType, z.ZodTypeAny> = {
  table: tableNodeConfigSchema,
  chart: chartConfigSchema,
  carousel: carouselNodeConfigSchema,
  template: templateNodeConfigSchema,
  form: formNodeConfigSchema,
};

/** Default LLM-facing descriptions per spec §10.2 (override via `description` config). */
const DEFAULT_DESCRIPTIONS: Record<PresentationType, string> = {
  table:
    '표 형태로 정형 데이터를 표시. rows/columns 정의 필요. 비교·집계 결과 공유에 적합.',
  chart:
    '차트 (bar/line/area/pie/donut) 로 데이터를 시각화. 시계열·분포·비율 표현에 적합.',
  carousel:
    '카드·이미지·미니멀 레이아웃의 슬라이드 모음. 추천 항목 목록·상품 카드 등 시각 카탈로그에 적합.',
  template:
    '사용자 정의 HTML/Markdown/Text 템플릿 렌더링. 정형화된 안내문·요약 카드 작성에 적합.',
  form: '사용자에게 입력 폼을 표시하고 제출을 대기. 추가 정보 수집·승인 요청 등 사용자 응답이 필요한 경우.',
};

/** 1MB cap — mirrors PRESENTATION_MAX_BYTES used by presentation handlers. */
const PRESENTATION_MAX_BYTES = 1024 * 1024;

/**
 * Single source for the `render_` prefix string. Used by `renderToolName`,
 * `typeFromToolName`, and `matches` to keep the three call sites in sync.
 */
const RENDER_TOOL_PREFIX = 'render_';

interface PresentationToolDef {
  type: PresentationType;
  description?: string;
  defaults?: Record<string, unknown>;
}

/** `render_<type>` (e.g. `render_table`). type 단어 그대로 — sanitize 불필요. */
export function renderToolName(type: PresentationType): string {
  return `${RENDER_TOOL_PREFIX}${type}`;
}

/** Extract presentation type from a `render_<type>` tool name. */
function typeFromToolName(name: string): PresentationType | null {
  if (!name.startsWith(RENDER_TOOL_PREFIX)) return null;
  const suffix = name.slice(RENDER_TOOL_PREFIX.length) as PresentationType;
  return SCHEMA_BY_TYPE[suffix] ? suffix : null;
}

/** Cached per-type JSON Schema for ToolDef.parameters. */
const jsonSchemaCache: Partial<
  Record<PresentationType, Record<string, unknown>>
> = {};
function getJsonSchemaFor(type: PresentationType): Record<string, unknown> {
  const cached = jsonSchemaCache[type];
  if (cached) return cached;
  const built = z.toJSONSchema(SCHEMA_BY_TYPE[type]) as Record<string, unknown>;
  jsonSchemaCache[type] = built;
  return built;
}

/**
 * Deep-merge with **defaults precedence** (defaults override LLM payload):
 *  - Object → recursive merge, defaults value wins on key collision.
 *  - Array → defaults replaces LLM array entirely (no concat, no element merge).
 *  - Primitive → defaults wins if set.
 *
 * spec/4-nodes/6-presentation/0-common.md §10.3.
 */
export function overlayDefaults(
  llmPayload: unknown,
  defaults: unknown,
): unknown {
  if (defaults === undefined || defaults === null) return llmPayload;
  if (Array.isArray(defaults)) return defaults; // replace
  if (
    defaults !== null &&
    typeof defaults === 'object' &&
    llmPayload !== null &&
    typeof llmPayload === 'object' &&
    !Array.isArray(llmPayload)
  ) {
    const out: Record<string, unknown> = {
      ...(llmPayload as Record<string, unknown>),
    };
    for (const [key, value] of Object.entries(
      defaults as Record<string, unknown>,
    )) {
      out[key] = overlayDefaults(out[key], value);
    }
    return out;
  }
  // Primitive defaults always win when set.
  return defaults;
}

function safeJsonParse(
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!raw) return { ok: false, error: 'empty arguments' };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function approxByteSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? null));
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/**
 * 가장 큰 length k ≤ totalCount 중 `payloadWithLength(k)` 의 byte 가 cap
 * 이하가 되는 값을 이진 탐색으로 찾는다. tail-pop 의 O(n) JSON.stringify 호출을
 * O(log n) 로 줄인다 (ai-review SUMMARY #7 — performance).
 *
 * Invariant: `payloadWithLength(0)` 은 항상 cap 이하라고 가정 (배열만 비우면
 * 본문 metadata 만 남음). 그래서 lo=0 으로 시작해도 안전.
 */
function binarySearchFittingLength(
  totalCount: number,
  payloadWithLength: (k: number) => Record<string, unknown>,
  cap: number,
): number {
  let lo = 0;
  let hi = totalCount;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const bytes = approxByteSize(payloadWithLength(mid));
    if (bytes <= cap) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/**
 * Apply 1MB tail-truncate for `carousel.items` / `table.rows`. Returns updated
 * payload + truncation metadata (only set when truncation happened).
 *
 * 이진 탐색으로 fitting length 를 찾으므로, 2,000행짜리 payload 라도
 * `JSON.stringify` 호출은 O(log n) = ~11회로 끝난다 (ai-review SUMMARY #7).
 */
function applyOneMbCap(
  type: PresentationType,
  payload: Record<string, unknown>,
): {
  payload: Record<string, unknown>;
  truncation?: PresentationPayload['truncation'];
} {
  const bytes = approxByteSize(payload);
  if (bytes <= PRESENTATION_MAX_BYTES) return { payload };

  const arrayKey: 'items' | 'rows' | null =
    type === 'carousel' ? 'items' : type === 'table' ? 'rows' : null;

  if (!arrayKey) {
    // chart / template / form — no array element to truncate. Caller treats
    // this as a schema violation (oversized single payload).
    return { payload };
  }

  const rawArray = payload[arrayKey];
  if (!Array.isArray(rawArray)) return { payload };

  const totalCount = rawArray.length;
  const fittingLength = binarySearchFittingLength(
    totalCount,
    (k) => ({ ...payload, [arrayKey]: rawArray.slice(0, k) }),
    PRESENTATION_MAX_BYTES,
  );
  const truncated = rawArray.slice(0, fittingLength);
  const wasTruncated = truncated.length < totalCount;

  if (arrayKey === 'items') {
    return {
      payload: { ...payload, items: truncated },
      truncation: {
        itemsTruncated: wasTruncated,
        itemsTotalCount: totalCount,
      },
    };
  }
  return {
    payload: { ...payload, rows: truncated },
    truncation: {
      rowsTruncated: wasTruncated,
      rowsTotalCount: totalCount,
    },
  };
}

export class RenderToolProvider implements AgentToolProvider {
  readonly key = 'render';
  private static readonly logger = new Logger('RenderToolProvider');

  matches(toolName: string): boolean {
    return toolName.startsWith(RENDER_TOOL_PREFIX);
  }

  // AgentToolProvider interface forces an async return shape; this provider
  // is intentionally synchronous (no I/O), so disable the eslint require-await
  // rule rather than fabricate an await.
  // eslint-disable-next-line @typescript-eslint/require-await
  async buildTools(ctx: ProviderBuildCtx): Promise<ToolDef[]> {
    const tools = (ctx.config.presentationTools as PresentationToolDef[]) || [];
    if (tools.length === 0) return [];

    return tools.map((def) => {
      const description =
        def.description?.trim() || DEFAULT_DESCRIPTIONS[def.type];
      return {
        name: renderToolName(def.type),
        description,
        parameters: getJsonSchemaFor(def.type),
      };
    });
  }

  // Same rationale as buildTools — synchronous validation/overlay/cap path.
  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(
    call: ToolCall,
    ctx: ProviderExecCtx,
  ): Promise<AgentToolResult> {
    const type = typeFromToolName(call.name);
    if (!type) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'UNKNOWN_TOOL' }),
        status: 'error',
        error: `Unknown render_* tool: ${call.name}`,
      };
    }

    const tools = (ctx.config.presentationTools as PresentationToolDef[]) || [];
    const toolDef = tools.find((t) => t.type === type);
    if (!toolDef) {
      // LLM hallucinated a tool that wasn't registered — treat as schema violation
      // so handler escalates to silent drop after retry budget.
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: 'INVALID_PAYLOAD',
          issues: [
            `Tool '${call.name}' is not registered in presentationTools`,
          ],
        }),
        status: 'error',
        presentationCall: {
          toolName: call.name,
          toolCallId: call.id,
          status: 'schema_violation',
        },
        presentationSchemaViolation: {
          toolName: call.name,
          toolCallId: call.id,
          issues: [
            `Tool '${call.name}' is not registered in presentationTools`,
          ],
          attempts: 1,
        },
      };
    }

    // Single-turn mode rejects render_form per spec §6.1.d.ii (silent drop).
    const isSingleTurn =
      (ctx.config.mode as string | undefined) === 'single_turn';
    if (type === 'form' && isSingleTurn) {
      const issues = ['render_form is not allowed in single_turn mode'];
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'INVALID_PAYLOAD', issues }),
        status: 'error',
        presentationCall: {
          toolName: call.name,
          toolCallId: call.id,
          status: 'schema_violation',
        },
        presentationSchemaViolation: {
          toolName: call.name,
          toolCallId: call.id,
          issues,
          attempts: 1,
        },
      };
    }

    const parsed = safeJsonParse(call.arguments);
    if (!parsed.ok) {
      const issues = [`Invalid JSON arguments: ${parsed.error}`];
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'INVALID_PAYLOAD', issues }),
        status: 'error',
        presentationCall: {
          toolName: call.name,
          toolCallId: call.id,
          status: 'schema_violation',
        },
        presentationSchemaViolation: {
          toolName: call.name,
          toolCallId: call.id,
          issues,
          attempts: 1,
        },
      };
    }

    // Defaults overlay first — LLM payload ∪ defaults with defaults winning.
    // Validate the merged payload (defaults may complete required fields).
    const merged = overlayDefaults(parsed.value, toolDef.defaults) as Record<
      string,
      unknown
    >;

    const validateResult = SCHEMA_BY_TYPE[type].safeParse(merged);
    if (!validateResult.success) {
      const issues = validateResult.error.issues.map(
        (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
      );
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'INVALID_PAYLOAD', issues }),
        status: 'error',
        presentationCall: {
          toolName: call.name,
          toolCallId: call.id,
          status: 'schema_violation',
        },
        presentationSchemaViolation: {
          toolName: call.name,
          toolCallId: call.id,
          issues,
          attempts: 1,
        },
      };
    }

    const validatedPayload = validateResult.data as Record<string, unknown>;
    const capped = applyOneMbCap(type, validatedPayload);
    const cappedBytes = approxByteSize(capped.payload);

    // For chart/template/form, oversize is unrecoverable — return as schema violation.
    if (
      cappedBytes > PRESENTATION_MAX_BYTES &&
      (type === 'chart' || type === 'template' || type === 'form')
    ) {
      const issues = [
        `Payload exceeds 1MB cap (${cappedBytes} bytes) — no truncatable array`,
      ];
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'INVALID_PAYLOAD', issues }),
        status: 'error',
        presentationCall: {
          toolName: call.name,
          toolCallId: call.id,
          status: 'schema_violation',
        },
        presentationSchemaViolation: {
          toolName: call.name,
          toolCallId: call.id,
          issues,
          attempts: 1,
        },
      };
    }

    if (type === 'form') {
      // Interactive: signal handler to enter waiting_for_input.
      return {
        toolCallId: call.id,
        // Stub content — handler replaces this when user submits the form.
        content: JSON.stringify({ ok: true, pending: 'form_submission' }),
        status: 'success',
        blockingFormRender: {
          toolCallId: call.id,
          formConfig: capped.payload,
        },
        presentationCall: {
          toolName: call.name,
          toolCallId: call.id,
          status: 'form_pending',
          bytes: cappedBytes,
        },
      };
    }

    // Display-only — push to assistant turn's presentations[].
    const payload: PresentationPayload = {
      type,
      toolCallId: call.id,
      renderedAt: new Date().toISOString(),
      payload: capped.payload,
      ...(capped.truncation ? { truncation: capped.truncation } : {}),
    };

    return {
      toolCallId: call.id,
      content: JSON.stringify({ ok: true }),
      status: 'success',
      presentationPayload: payload,
      presentationCall: {
        toolName: call.name,
        toolCallId: call.id,
        status: 'rendered',
        bytes: cappedBytes,
      },
    };
  }
}
