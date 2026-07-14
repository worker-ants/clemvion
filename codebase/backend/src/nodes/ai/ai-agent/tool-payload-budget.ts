/**
 * AI Agent 도구 정의(스키마) payload 예산 가드레일 — 런타임 fail-fast.
 *
 * `buildTools` 가 LLM 에 노출하려는 도구 **정의 전체의 직렬화 크기**를 예산으로
 * 관리한다. 이는 도구 **호출 횟수** 한도(`maxToolCalls`) · working-memory **토큰**
 * 예산(`memoryTokenBudget`) 과 **다른 축** — 도구 정의 자체의 bytes 다.
 *
 * 배경: Cafe24 MCP 383도구 전량이 매 LLM 요청에 실려 ~118k토큰 프롬프트가 provider
 * transport timeout 을 넘겨 "응답 없음 / 무한 SDK 재시도" 로 나타난 회귀. 개수 cap 만
 * 으로는 필드 단위 스키마 팽창을 잡지 못하므로 **직렬화 bytes** 가 1차 지표다.
 *
 * SoT: spec/4-nodes/3-ai/1-ai-agent.md §4.2 · §10(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`)
 *      · §12.15.
 *
 * estimator(`estimateAgentToolPayload`)는 런타임 판정 · 저장 시점 경고 · 관측 로깅이
 * 모두 공유하는 단일 진실이다.
 */

import type { ToolDef } from '../../../modules/llm/interfaces/llm-client.interface';
import { estimateTextTokens } from '../shared/agent-memory-injection';

/**
 * env 예산 파싱 — `Number(env) || fallback` (mcp-tool-provider.ts 의
 * `MAX_RESPONSE_BYTES` 선례 동형). 빈 문자열/비수치/0 은 fallback 으로 방어된다
 * (NaN-safe). **매 호출 process.env 를 읽으므로** 테스트가 모듈 리로드 없이 env
 * override 를 검증할 수 있다 (일관 방식: 세 예산 전부 함수형).
 */
function readByteBudget(envName: string, fallback: number): number {
  return Number(process.env[envName]) || fallback;
}

/** soft 예산 (bytes) — 초과 시 `logger.warn` 로깅만, 실행 계속. 기본 96 KB. */
export function toolPayloadSoftBytes(): number {
  return readByteBudget('AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES', 98304);
}

/** hard 예산 (bytes) — 초과 시 런타임 fail-fast (throw). 기본 256 KB. */
export function toolPayloadHardBytes(): number {
  return readByteBudget('AI_AGENT_TOOL_PAYLOAD_HARD_BYTES', 262144);
}

/** 도구 개수 상한 — 2차 sanity. 초과 시 hard 와 동일 취급 (throw). 기본 128. */
export function toolCountMax(): number {
  return readByteBudget('AI_AGENT_TOOL_COUNT_MAX', 128);
}

/**
 * tool name → provider 그룹 key ("범인 provider 지목" 용).
 *  - `mcp_<sid>__...` → `mcp:<sid>` (sid = `mcp_` 뒤 `__` 앞 세그먼트)
 *  - `kb_...`         → `kb`
 *  - `render_...`     → `render`
 *  - `cond_...`       → `cond`
 *  - 그 외            → `tool`
 */
export function toolProviderGroupKey(name: string): string {
  if (name.startsWith('mcp_')) {
    const rest = name.slice('mcp_'.length);
    // split(limit=1) 은 첫 `__` 앞 세그먼트만 반환 (`a__b__c` → `a`).
    const sid = rest.split('__', 1)[0];
    return `mcp:${sid}`;
  }
  if (name.startsWith('kb_')) return 'kb';
  if (name.startsWith('render_')) return 'render';
  if (name.startsWith('cond_')) return 'cond';
  return 'tool';
}

export interface ToolPayloadPerProvider {
  key: string;
  bytes: number;
  toolCount: number;
}

export interface ToolPayloadEstimate {
  bytes: number;
  approxTokens: number;
  toolCount: number;
  perProvider: ToolPayloadPerProvider[];
}

/**
 * 도구 정의 배열의 직렬화 payload 를 추정한다 (단일 진실).
 *  - `bytes`        = `Buffer.byteLength(JSON.stringify(tools))`
 *  - `approxTokens` = language-aware 휴리스틱(§6.1 1.5 와 동일 shared 재사용, 근사)
 *  - `toolCount`    = tools.length
 *  - `perProvider`  = provider 그룹 key 별 bytes·count ("범인 provider" 지목)
 */
export function estimateAgentToolPayload(
  tools: ToolDef[],
): ToolPayloadEstimate {
  const serialized = JSON.stringify(tools);
  const bytes = Buffer.byteLength(serialized);
  const approxTokens = estimateTextTokens(serialized);
  const toolCount = tools.length;

  const groups = new Map<string, ToolDef[]>();
  for (const tool of tools) {
    const key = toolProviderGroupKey(tool.name);
    const bucket = groups.get(key);
    if (bucket) bucket.push(tool);
    else groups.set(key, [tool]);
  }

  const perProvider: ToolPayloadPerProvider[] = [];
  for (const [key, groupTools] of groups) {
    perProvider.push({
      key,
      bytes: Buffer.byteLength(JSON.stringify(groupTools)),
      toolCount: groupTools.length,
    });
  }

  return { bytes, approxTokens, toolCount, perProvider };
}

/** perProvider 중 bytes 최대 그룹 key ("범인 provider"). 빈 배열이면 undefined. */
function pickCulpritProvider(
  perProvider: ToolPayloadPerProvider[],
): string | undefined {
  let culprit: ToolPayloadPerProvider | undefined;
  for (const group of perProvider) {
    if (!culprit || group.bytes > culprit.bytes) culprit = group;
  }
  return culprit?.key;
}

export interface ToolDefinitionPayloadExceededDetails {
  /** LLM 계열 노드 필수 (spec §7.3: `output.error.details.retryable`). 항상 false. */
  retryable: false;
  totalBytes: number;
  budgetBytes: number;
  toolCount: number;
  culpritProvider?: string;
}

/**
 * hard(bytes) 또는 개수 예산 초과 시 `buildTools` 직후 throw 되는 에러.
 * `code` 는 `output.error.code` 로, `details` 는 `output.error.details` 로 매핑된다
 * (spec §7.3 / §10). `retryable` 은 spec 형식대로 `details` **안**에 둔다.
 */
export class ToolDefinitionPayloadExceededError extends Error {
  readonly code = 'TOOL_DEFINITION_PAYLOAD_EXCEEDED';
  readonly details: ToolDefinitionPayloadExceededDetails;

  constructor(details: ToolDefinitionPayloadExceededDetails) {
    super(buildExceededMessage(details));
    this.name = 'ToolDefinitionPayloadExceededError';
    this.details = details;
  }
}

/** 사람이 읽을 수 있는 실패 메시지 — 총 bytes·예산·범인 provider·해결법 포함. */
function buildExceededMessage(d: ToolDefinitionPayloadExceededDetails): string {
  const culprit = d.culpritProvider
    ? ` Largest contributor: "${d.culpritProvider}".`
    : '';
  return (
    `AI Agent tool definitions serialize to ${d.totalBytes} bytes across ` +
    `${d.toolCount} tools, exceeding the budget of ${d.budgetBytes} bytes.` +
    culprit +
    ` Reduce exposed tools via mcpServers[].enabledTools allowlist or disable the server.`
  );
}

/**
 * `buildTools` 직후 예산을 강제한다 (single-turn·multi-turn 공통).
 *  - `toolCount > TOOL_COUNT_MAX` 또는 `bytes > TOOL_PAYLOAD_HARD_BYTES`
 *    → `ToolDefinitionPayloadExceededError` throw (LLM 호출 전 fail-fast).
 *  - else `bytes > TOOL_PAYLOAD_SOFT_BYTES` → `logger?.warn(...)` (실행 계속).
 * 반환값은 관측·로깅용 estimate.
 */
export function enforceToolPayloadBudget(
  tools: ToolDef[],
  logger?: { warn(message: string): void },
): ToolPayloadEstimate {
  const estimate = estimateAgentToolPayload(tools);
  const hardBytes = toolPayloadHardBytes();
  const softBytes = toolPayloadSoftBytes();
  const countMax = toolCountMax();
  const culpritProvider = pickCulpritProvider(estimate.perProvider);

  if (estimate.toolCount > countMax || estimate.bytes > hardBytes) {
    throw new ToolDefinitionPayloadExceededError({
      retryable: false,
      totalBytes: estimate.bytes,
      // budgetBytes 는 항상 hard 예산으로 통일 (count 초과도 동일 — spec §4.2).
      budgetBytes: hardBytes,
      toolCount: estimate.toolCount,
      ...(culpritProvider ? { culpritProvider } : {}),
    });
  }

  if (estimate.bytes > softBytes) {
    logger?.warn(
      `AI Agent tool definitions serialize to ${estimate.bytes} bytes across ` +
        `${estimate.toolCount} tools, exceeding the soft budget of ${softBytes} ` +
        `bytes` +
        (culpritProvider
          ? ` (largest contributor: "${culpritProvider}")`
          : '') +
        `. Consider trimming mcpServers[].enabledTools before it hits the hard cap.`,
    );
  }

  return estimate;
}
