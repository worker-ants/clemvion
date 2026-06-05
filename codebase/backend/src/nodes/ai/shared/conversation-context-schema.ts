/**
 * AI 노드 Conversation Context (`contextScope`) zod schema fragment 공통 헬퍼.
 *
 * Spec: spec/4-nodes/3-ai/0-common.md §10 · spec/conventions/conversation-thread.md §5.
 *
 * AI Agent / Text Classifier / Information Extractor 3 노드 schema 가 동일한
 * `contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns`
 * / `excludeFromConversationThread` 5 필드를 갖는다. 본 헬퍼가 라벨·hint·options·
 * default 의 단일 진실이다.
 *
 * `memoryStrategy` 필드를 갖는 노드(AI Agent, Information Extractor)는 일부 필드를
 * `memoryStrategy === 'manual'` 일 때만 노출하므로 (자동 메모리 전략이 contextScope
 * 계열을 대체, spec §1) 그 `visibleWhen` 가드를 opt-in 으로 받는다
 * (`gateOnManualMemoryStrategy: true`). information_extractor 는 memoryStrategy
 * (manual|persistent) 를 가지므로 `gateOnManualMemoryStrategy: true` 로 호출한다.
 * text_classifier 는 `memoryStrategy` 필드가 없으므로 가드 없이(default) 항상 노출한다.
 *
 * AI Agent 의 기존 필드 정의(라벨·order·visibleWhen)를 100% 보존하기 위해
 * AI Agent 는 `orderStart: 37, gateOnManualMemoryStrategy: true` 로 호출한다.
 */

import { z } from 'zod';

/** `contextScopeN` default — 3 노드 공통. */
export const DEFAULT_CONTEXT_SCOPE_N = 20;

const GROUP = 'Conversation Context';

export interface BuildConversationContextSchemaFieldsOptions {
  /**
   * `true` 면 `contextScope` / `contextInjectionMode` / `includeToolTurns` 에
   * `visibleWhen: { field: 'memoryStrategy', equals: 'manual' }` 를 단다 —
   * memoryStrategy 필드를 갖는 노드(AI Agent / Information Extractor) 전용 (자동
   * 메모리 전략이 이 필드들을 대체하므로 숨김). default `false`
   * (text_classifier 는 memoryStrategy 필드가 없어 가드 없이 항상 노출).
   */
  gateOnManualMemoryStrategy?: boolean;
}

/**
 * 3 AI 노드 schema 의 Conversation Context 5 필드 fragment 를 생성한다.
 *
 * @param orderStart `contextScope` 의 UI order. 후속 필드는 순서대로 `+1..+4`.
 * @param opts       AI Agent 의 memoryStrategy 가드 opt-in.
 */
export function buildConversationContextSchemaFields(
  orderStart: number,
  opts: BuildConversationContextSchemaFieldsOptions = {},
) {
  const gate = opts.gateOnManualMemoryStrategy === true;
  // `memoryStrategy != manual` 이면 자동 전략이 contextScope 계열 5필드를 대체
  // 하므로 숨긴다 (spec §1 비고 / §2 visibleWhen). 단일-필드 평가기라 equals 한
  // 조건만 — 그래도 strategy 가 manual 일 때만 노출돼 충분.
  const manualGate = gate
    ? { visibleWhen: { field: 'memoryStrategy', equals: 'manual' } as const }
    : {};

  return {
    contextScope: z
      .enum(['none', 'thread', 'lastN'])
      .default('none')
      .meta({
        ui: {
          label: 'Conversation Context',
          widget: 'select',
          order: orderStart,
          group: GROUP,
          ...manualGate,
          options: [
            { value: 'none', label: 'None — system + user prompt only' },
            { value: 'thread', label: 'Thread — inject full thread' },
            { value: 'lastN', label: 'Last N — inject most recent N turns' },
          ],
        },
      }),
    contextScopeN: z
      .number()
      .int()
      .positive()
      .default(DEFAULT_CONTEXT_SCOPE_N)
      .meta({
        ui: {
          label: 'Last N',
          widget: 'number',
          order: orderStart + 1,
          group: GROUP,
          visibleWhen: { field: 'contextScope', equals: 'lastN' },
        },
      }),
    contextInjectionMode: z
      .enum(['messages', 'system_text'])
      .default('messages')
      .meta({
        ui: {
          label: 'Injection Mode',
          widget: 'select',
          order: orderStart + 2,
          group: GROUP,
          // manual 전략에서만 의미 — 자동 전략은 안정 프리픽스로 강제 (spec §1).
          ...manualGate,
          options: [
            { value: 'messages', label: 'Messages — prepend to LLM messages' },
            {
              value: 'system_text',
              label: 'System Text — append to system prompt',
            },
          ],
        },
      }),
    includeToolTurns: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Include Tool Calls in Thread',
          widget: 'checkbox',
          order: orderStart + 3,
          group: GROUP,
          // 자동 주입 측면에서는 manual 전략에서만 의미 — 자동 전략은 안정
          // 프리픽스로 대체 (spec §1). thread push 자체는 strategy 와 독립이나
          // 본 토글의 자동-주입 영향은 manual 한정이므로 manual 일 때만 노출.
          ...manualGate,
          hint: 'Push KB / MCP / condition tool turns to the thread (default: only the final assistant response).',
        },
      }),
    excludeFromConversationThread: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Exclude This Node from Thread',
          widget: 'checkbox',
          order: orderStart + 4,
          group: GROUP,
          hint: 'Skip pushing this node’s user / assistant turns to the workflow thread (opt-out).',
        },
      }),
  };
}
