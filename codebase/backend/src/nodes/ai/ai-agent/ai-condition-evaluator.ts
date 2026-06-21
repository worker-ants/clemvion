import {
  ToolCall,
  ToolDef,
} from '../../../modules/llm/interfaces/llm-client.interface';
import { AgentToolProvider } from './tool-providers/agent-tool-provider.interface';

/**
 * 사용자가 AI Agent 노드에 정의한 단일 조건(condition). LLM 이 대화 중 이
 * 조건에 해당한다고 판단하면 대응하는 `cond_*` 도구를 호출하고, 그 결과로
 * 노드 출력이 동적 `{condition.id}` 포트로 라우팅된다 (spec/4-nodes/3-ai).
 */
export interface ConditionDef {
  id: string;
  label: string;
  prompt: string;
}

/**
 * LLM 응답의 tool_call 목록을 provider(KB/MCP 등 핸들러 내부 실행) / condition /
 * normal(외부 노드 stub) 3그룹으로 분리한 결과. `matchedCondition` 은 condition
 * 도구가 1개 이상 호출됐을 때 conditions 배열에서 가장 앞쪽에 정의된 winner.
 */
export interface ConditionClassification {
  providerToolCalls: Array<{ provider: AgentToolProvider; call: ToolCall }>;
  conditionToolCalls: ToolCall[];
  normalToolCalls: ToolCall[];
  matchedCondition: ConditionDef | null;
}

/**
 * condition tool_call 의 `reason` 인자를 노드 출력(`condition.reason`)에 싣기
 * 전 절단하는 상한. 같은 노드 레이어의 `TOOL_RESULT_PREVIEW_CHARS` 와 동류의
 * 노출 cap — 무제한 LLM 생성 문자열이 outputData 로 흘러드는 것을 막는다.
 */
export const CONDITION_REASON_MAX_CHARS = 500;

/** Replace non-alphanumeric/underscore chars for LLM-safe tool names. */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/** Build LLM tool name for a condition. */
export function condToolName(conditionId: string): string {
  return `cond_${sanitizeId(conditionId)}`;
}

/**
 * AI Agent 노드의 조건(condition) 평가 로직 — 핸들러 상태에 의존하지 않는 순수
 * 입출력 단위로 분리 (refactor 02-architecture §M-1 1단계, behavior-preserving).
 *
 * 책임: ⓐ LLM 에 노출할 조건 도구 정의(`buildConditionTools`)·시스템 프롬프트
 * 안내문(`buildConditionSystemPromptSuffix`) 생성, ⓑ LLM 응답의 tool_call 을
 * provider/condition/normal 로 분류(`classifyToolCalls`), ⓒ 선택된 조건의 사유
 * 추출(`extractConditionReason`). provider 매칭만 외부 의존(`toolProviders`)이라
 * 인자로 전달받아 클래스 자체는 무상태로 유지한다.
 */
export class AiConditionEvaluator {
  /**
   * 각 condition 을 LLM 도구(`cond_*`)로 변환. 도구가 호출되면 그 조건이
   * 충족됐다는 신호이며, `reason` 파라미터로 선택 사유를 받는다.
   */
  buildConditionTools(conditions: ConditionDef[]): ToolDef[] {
    return conditions.map((c) => ({
      name: condToolName(c.id),
      description: c.prompt,
      // `required: []` 는 spec/4-nodes/3-ai/1-ai-agent.md §5.1 의 도구 스키마
      // 명시값 — reason 은 선택 인자라 필수 목록은 빈 배열. (JSON Schema 상
      // 생략 ≡ `required: []` 이지만 spec 문언과 일치시킨다.)
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: '이 조건을 선택한 이유',
          },
        },
        required: [],
      },
    }));
  }

  /**
   * Build system prompt suffix that instructs the LLM about available conditions.
   */
  buildConditionSystemPromptSuffix(conditions: ConditionDef[]): string {
    const condList = conditions
      .map((c) => `- ${condToolName(c.id)}: ${c.prompt}`)
      .join('\n');
    return `\n\n[조건 안내] 대화 중 아래 조건에 해당하는 상황이 감지되면, 해당 조건 도구를 호출하세요:\n${condList}\n조건에 해당하지 않으면 대화를 계속하세요.`;
  }

  /**
   * Classify tool calls into provider (KB 등 핸들러 내부 실행), condition,
   * normal (외부 노드 stub) 그룹으로 분리. condition 다중 호출 시 conditions
   * 배열에서 가장 앞쪽 정의된 항목을 winner 로 채택. provider 매칭은 핸들러가
   * 보유한 `toolProviders` 를 인자로 받아 수행한다 (무상태 유지).
   */
  classifyToolCalls(
    toolCalls: ToolCall[],
    conditions: ConditionDef[],
    toolProviders: AgentToolProvider[],
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
      const matchedProvider = toolProviders.find((p) => p.matches(tc.name));
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
  extractConditionReason(toolCalls: ToolCall[], conditionId: string): string {
    const name = condToolName(conditionId);
    const tc = toolCalls.find((t) => t.name === name);
    if (!tc) return '';
    try {
      const args = JSON.parse(tc.arguments) as Record<string, unknown>;
      const reason = typeof args.reason === 'string' ? args.reason : '';
      return reason.slice(0, CONDITION_REASON_MAX_CHARS);
    } catch {
      return '';
    }
  }
}
