/**
 * AI Agent 자동 메모리 전략 (`summary_buffer` / `persistent`) 의 working-memory
 * 토큰 추정 + 롤링 요약 압축 + 안정 프리픽스 빌더.
 *
 * SoT:
 *  - spec/4-nodes/3-ai/1-ai-agent.md §1·§6.1 (1.3 회수 / 1.5 자동분기 요약)
 *  - spec/4-nodes/3-ai/0-common.md §11.4 ordering ([5a] 회수 → [5b] 요약 → [6] 휘발성 꼬리)
 *  - spec/conventions/conversation-thread.md §1.3·§5.3 (runningSummary/summarizedUpToSeq, 자동=token-budget)
 *  - spec/5-system/17-agent-memory.md §4 (회수 top-k/threshold)
 *
 * `manual` 전략은 이 모듈을 거치지 않는다 — 기존 contextScope 경로 완전 무변경
 * (하위호환 0 리스크, 핵심 불변식).
 */

import { estimateTokens } from '../../../modules/knowledge-base/chunking/text-chunker';
import type { ConversationTurn } from '../../../shared/conversation-thread/conversation-thread.types';
import { renderThreadAsSystemText } from '../../../shared/conversation-thread/thread-renderer';
import { ChatMessage } from '../../../modules/llm/interfaces/llm-client.interface';
import type { LlmConfig } from '../../../modules/llm-config/entities/llm-config.entity';
import type { LlmService } from '../../../modules/llm/llm.service';
import type { RecalledMemory } from '../../../modules/agent-memory/agent-memory.service';

/**
 * 텍스트 → 토큰 추정. KB 청킹의 `estimateTokens` (char/3 휴리스틱) 를 단일
 * 소스로 재사용한다 — provider tokenizer-exact 방식은 v3 로드맵 (spec §12.10).
 */
export function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return estimateTokens(text);
}

/**
 * 한 turn 의 LLM-facing 토큰 추정. system_text/messages 어느 모드든 turn 의
 * `text` 가 LLM 컨텍스트로 흐르므로 text 길이를 기준으로 추정한다.
 */
export function estimateTurnTokens(turn: ConversationTurn): number {
  return estimateTextTokens(turn.text);
}

/** turn 배열 + 추가 텍스트 (systemPrompt 등) 의 working-memory 토큰 합 추정. */
export function estimateWorkingMemoryTokens(
  turns: readonly ConversationTurn[],
  ...extraTexts: string[]
): number {
  let sum = 0;
  for (const t of turns) sum += estimateTurnTokens(t);
  for (const e of extraTexts) sum += estimateTextTokens(e);
  return sum;
}

/**
 * 요약 LLM 콜의 출력 토큰 상한. 요약은 압축이 목적이므로 작게 cap.
 */
const SUMMARY_MAX_TOKENS = 1024;

/**
 * 롤링 요약 시 한 번에 압축 대상에 포함하지 않고 원문으로 남길 최근 turn 수의
 * 하한. 예산 초과 시 오래된 turn 부터 압축하되, 최소 이만큼은 휘발성 꼬리로
 * 남겨 직전 맥락을 보존한다 (전부 요약되면 직전 발화 맥락이 손실됨).
 */
const MIN_RECENT_RAW_TURNS = 2;

/** 안정 프리픽스 [5a] 회수 블록 헤더/푸터. */
const RECALL_BLOCK_HEADER =
  '[Recalled Memory — relevant facts from past sessions]';
const RECALL_BLOCK_FOOTER = '[End of Recalled Memory]';

/** 안정 프리픽스 [5b] 롤링 요약 블록 헤더/푸터. */
const SUMMARY_BLOCK_HEADER =
  '[Conversation Summary — earlier turns, compressed]';
const SUMMARY_BLOCK_FOOTER = '[End of Conversation Summary]';

/**
 * 직전 turn 에 append 된 메모리 블록 ([5a] 회수 / [5b] 요약) 을 systemPrompt
 * 본문에서 제거한다. multi-turn 누적 경로에서 매 turn `appendStablePrefix` 를
 * 다시 호출하면 블록이 중첩 누적되므로, base systemPrompt 를 깨끗이 만들기 위해
 * 사용한다. 헤더~푸터 사이 전체 (앞 구분 개행 포함) 를 비탐욕 매칭으로 삭제.
 */
export function stripMemoryBlocks(systemPrompt: string): string {
  if (!systemPrompt) return systemPrompt;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const recallRe = new RegExp(
    `\\n*${esc(RECALL_BLOCK_HEADER)}[\\s\\S]*?${esc(RECALL_BLOCK_FOOTER)}`,
    'g',
  );
  const summaryRe = new RegExp(
    `\\n*${esc(SUMMARY_BLOCK_HEADER)}[\\s\\S]*?${esc(SUMMARY_BLOCK_FOOTER)}`,
    'g',
  );
  return systemPrompt.replace(recallRe, '').replace(summaryRe, '');
}

/**
 * persistent 회수 결과 → 안정 프리픽스 [5a] 블록 텍스트. 비어 있으면 빈 문자열.
 * 회수 content 는 prompt-injection 방어를 위해 별도 wrap 하지 않는다 — 회수
 * content 는 시스템이 추출/저장한 사실이지 사용자 raw 입력의 직접 echo 가 아니다
 * (추출 단계가 사이에 있음). 단순 bullet 리스트로 렌더.
 */
export function buildRecallBlock(recalled: readonly RecalledMemory[]): string {
  if (recalled.length === 0) return '';
  const lines = [RECALL_BLOCK_HEADER];
  for (const r of recalled) {
    lines.push(`- ${r.content}`);
  }
  lines.push(RECALL_BLOCK_FOOTER);
  return lines.join('\n');
}

/**
 * 롤링 요약 본문 → 안정 프리픽스 [5b] 블록 텍스트. 비어 있으면 빈 문자열.
 */
export function buildSummaryBlock(runningSummary: string | undefined): string {
  if (!runningSummary || !runningSummary.trim()) return '';
  return `${SUMMARY_BLOCK_HEADER}\n${runningSummary.trim()}\n${SUMMARY_BLOCK_FOOTER}`;
}

export interface SummaryBufferUpdate {
  /** 갱신된 요약 본문 (압축 발생 안 했으면 입력값 그대로). */
  runningSummary: string | undefined;
  /** 요약이 커버하는 마지막 turn seq (압축 발생 안 했으면 입력값 그대로). */
  summarizedUpToSeq: number | undefined;
  /** 이 호출에서 새 압축 (요약 LLM 콜) 이 실제 발생했는지. */
  summarized: boolean;
}

export interface BuildSummaryBufferArgs {
  /** 자기 노드를 제외한 thread turns (시간순). */
  turns: readonly ConversationTurn[];
  /** 기존 runningSummary (있으면 누적). */
  runningSummary: string | undefined;
  /** 기존 summarizedUpToSeq (이 seq 이하는 이미 요약 커버 — 재요약 금지). */
  summarizedUpToSeq: number | undefined;
  /** 토큰 예산. 초과 시에만 압축 트리거. */
  tokenBudget: number;
  /** working-memory 토큰 추정에 함께 포함할 systemPrompt (현재 안정 프리픽스 제외). */
  systemPromptText: string;
  /** 요약 LLM 콜에 쓸 config/model. */
  llmConfig: LlmConfig;
  model: string;
  llmService: LlmService;
}

/**
 * spec §6.1 단계 1.5 자동 분기 — working-memory 가 예산 초과 시 **오래된 turn
 * 부터 롤링 요약으로 압축**한다.
 *
 * **캐시 보호 불변식 (재요약 금지)**: `summarizedUpToSeq` 이하 turn 은 이미
 * 요약에 커버되었으므로 **재요약하지 않는다**. 이번 호출에서 새로 예산을 초과한
 * uncompressed turn 만 직전 `runningSummary` 위에 누적 압축한다. 예산 미만이면
 * 요약 LLM 콜을 전혀 호출하지 않는다 (prompt cache 안정 프리픽스 보호 —
 * spec §11.4·§12.11). 이로써 매 turn 무조건 재요약하는 회귀를 차단한다.
 */
export async function buildSummaryBufferUpdate(
  args: BuildSummaryBufferArgs,
): Promise<SummaryBufferUpdate> {
  const {
    turns,
    runningSummary,
    summarizedUpToSeq,
    tokenBudget,
    systemPromptText,
    llmConfig,
    model,
    llmService,
  } = args;

  const noChange: SummaryBufferUpdate = {
    runningSummary,
    summarizedUpToSeq,
    summarized: false,
  };

  // 아직 요약에 커버되지 않은 turn (휘발성 후보).
  const uncompressed = turns.filter((t) =>
    summarizedUpToSeq === undefined ? true : t.seq > summarizedUpToSeq,
  );

  // 현재 working-memory 토큰 추정 = systemPrompt + 기존 요약 + uncompressed turns.
  const summaryBlockText = buildSummaryBlock(runningSummary);
  const currentTokens = estimateWorkingMemoryTokens(
    uncompressed,
    systemPromptText,
    summaryBlockText,
  );

  if (currentTokens <= tokenBudget) {
    // 예산 미만 — 요약 LLM 콜 미호출 (캐시 보호 불변식의 핵심 경로).
    return noChange;
  }

  // 예산 초과 — 오래된 uncompressed turn 부터 압축 대상에 누적해, 남은 원문이
  // 예산 안에 들어올 때까지 (또는 MIN_RECENT_RAW_TURNS 만 남을 때까지) 모은다.
  const fixedOverhead =
    estimateTextTokens(systemPromptText) + estimateTextTokens(summaryBlockText);

  const toCompress: ConversationTurn[] = [];
  const remaining = [...uncompressed];
  let remainingTokens = currentTokens;

  while (
    remainingTokens > tokenBudget &&
    remaining.length > MIN_RECENT_RAW_TURNS
  ) {
    const oldest = remaining.shift();
    if (!oldest) break;
    toCompress.push(oldest);
    remainingTokens = fixedOverhead + estimateWorkingMemoryTokens(remaining);
  }

  if (toCompress.length === 0) {
    // 압축할 turn 이 없다 (모두 MIN_RECENT_RAW 보호 대상). 더 압축 불가 —
    // 요약 콜 안 함.
    return noChange;
  }

  // 압축 대상 turn 들을 텍스트로 렌더해 요약 LLM 콜.
  const compressText = renderThreadAsSystemText(toCompress);
  const priorSummary = runningSummary?.trim() ?? '';
  const summaryPrompt = priorSummary
    ? `다음은 지금까지의 대화 요약과, 그 이후 추가된 대화 turn 들이다. ` +
      `둘을 통합해 하나의 간결한 요약으로 갱신하라. 사실·선호·결정·미해결 항목을 보존하고, ` +
      `인사말·잡담은 생략하라. 요약만 출력하라.\n\n` +
      `[기존 요약]\n${priorSummary}\n\n[추가 대화]\n${compressText}`
    : `다음 대화 turn 들을 하나의 간결한 요약으로 압축하라. 사실·선호·결정·미해결 ` +
      `항목을 보존하고, 인사말·잡담은 생략하라. 요약만 출력하라.\n\n${compressText}`;

  const result = await llmService.chat(llmConfig, {
    model,
    messages: [{ role: 'user', content: summaryPrompt }],
    maxTokens: SUMMARY_MAX_TOKENS,
    responseFormat: 'text',
  });

  const newSummary = (result.content ?? '').trim();
  if (!newSummary) {
    // 요약 콜이 빈 응답 — 안전하게 압축 안 한 것으로 처리 (turn 들은 원문 유지).
    return noChange;
  }

  // 압축 대상 중 가장 최신 seq 가 새 summarizedUpToSeq.
  const newUpToSeq = toCompress.reduce(
    (max, t) => (t.seq > max ? t.seq : max),
    summarizedUpToSeq ?? -1,
  );

  return {
    runningSummary: newSummary,
    summarizedUpToSeq: newUpToSeq,
    summarized: true,
  };
}

/**
 * 안정 프리픽스 [5a]+[5b] 를 systemPrompt 에 append 한 최종 본문을 빌드한다
 * (spec §11.4 ordering). 회수/요약 블록이 모두 비면 입력 그대로 반환.
 */
export function appendStablePrefix(
  finalSystemPrompt: string,
  recallBlock: string,
  summaryBlock: string,
): string {
  const blocks = [recallBlock, summaryBlock].filter((b) => b.length > 0);
  if (blocks.length === 0) return finalSystemPrompt;
  const suffix = blocks.join('\n\n');
  return finalSystemPrompt ? `${finalSystemPrompt}\n\n${suffix}` : suffix;
}

/**
 * 자동 전략 (summary_buffer/persistent) 의 휘발성 꼬리 turn 선택 — 요약에
 * 커버되지 않은 (`seq > summarizedUpToSeq`) 최근 원문 turn 만 남긴다 (spec §11.4 [6]).
 */
export function selectVolatileTail(
  turns: readonly ConversationTurn[],
  summarizedUpToSeq: number | undefined,
): ConversationTurn[] {
  if (summarizedUpToSeq === undefined) return [...turns];
  return turns.filter((t) => t.seq > summarizedUpToSeq);
}

/**
 * 휘발성 꼬리 turn → messages 모드 ChatMessage 매핑. system 메시지 뒤에 prepend
 * 할 수 있도록 `source: 'injected'` 마커를 단다 (manual 경로의
 * `mapTurnsToChatMessages` 와 동일 컨벤션).
 */
export function mapTailToChatMessages(
  turns: readonly ConversationTurn[],
): ChatMessage[] {
  return turns
    .map((t): ChatMessage => {
      switch (t.source) {
        case 'presentation_user':
          return { role: 'user', content: `[from ${t.nodeLabel}] ${t.text}` };
        case 'ai_user':
          return { role: 'user', content: t.text };
        case 'ai_assistant':
          return {
            role: 'assistant',
            content: t.text,
            ...(t.toolCalls ? { toolCalls: t.toolCalls } : {}),
          };
        case 'ai_tool':
          return {
            role: 'tool',
            content: t.text,
            ...(t.toolCallId ? { toolCallId: t.toolCallId } : {}),
          };
        case 'system':
          return { role: 'system', content: t.text };
        default:
          return { role: 'user', content: t.text };
      }
    })
    .map((m) => ({ ...m, source: 'injected' as const }));
}
