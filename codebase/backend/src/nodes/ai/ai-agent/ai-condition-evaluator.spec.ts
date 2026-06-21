import {
  AiConditionEvaluator,
  condToolName,
  CONDITION_REASON_MAX_CHARS,
  type ConditionDef,
} from './ai-condition-evaluator';
import { ToolCall } from '../../../modules/llm/interfaces/llm-client.interface';
import { AgentToolProvider } from './tool-providers/agent-tool-provider.interface';

/**
 * AiConditionEvaluator unit — refactor 02-architecture §M-1 1단계로 핸들러에서
 * 분리한 조건 평가 로직(이전엔 ai-agent.handler 의 private 메서드로 간접 테스트만
 * 존재)을 입출력 단위로 직접 고정한다. behavior-preserving 추출의 회귀 격리용.
 */
describe('AiConditionEvaluator', () => {
  const evaluator = new AiConditionEvaluator();

  const cond = (id: string, prompt = `prompt for ${id}`): ConditionDef => ({
    id,
    label: `label ${id}`,
    prompt,
  });

  const toolCall = (name: string, args = '{}'): ToolCall => ({
    id: `tc_${name}`,
    name,
    arguments: args,
  });

  /** matches(name) 가 주어진 prefix 로 시작하는 호출을 잡는 가짜 provider. */
  const providerMatching = (prefix: string): AgentToolProvider =>
    ({
      key: prefix,
      matches: (toolName: string) => toolName.startsWith(prefix),
      buildTools: jest.fn(),
      execute: jest.fn(),
    }) as unknown as AgentToolProvider;

  describe('condToolName', () => {
    it('cond_ 접두사를 붙이고 비영숫자/언더스코어를 _ 로 치환한다', () => {
      expect(condToolName('refund')).toBe('cond_refund');
      expect(condToolName('user-wants.refund 99')).toBe(
        'cond_user_wants_refund_99',
      );
    });
  });

  describe('buildConditionTools', () => {
    it('각 condition 을 cond_* 도구로 변환하고 reason 파라미터를 노출한다', () => {
      const tools = evaluator.buildConditionTools([cond('a'), cond('b')]);
      expect(tools).toEqual([
        {
          name: 'cond_a',
          description: 'prompt for a',
          parameters: {
            type: 'object',
            properties: {
              reason: { type: 'string', description: '이 조건을 선택한 이유' },
            },
            required: [],
          },
        },
        {
          name: 'cond_b',
          description: 'prompt for b',
          parameters: {
            type: 'object',
            properties: {
              reason: { type: 'string', description: '이 조건을 선택한 이유' },
            },
            required: [],
          },
        },
      ]);
    });

    it('condition 이 없으면 빈 배열', () => {
      expect(evaluator.buildConditionTools([])).toEqual([]);
    });
  });

  describe('buildConditionSystemPromptSuffix', () => {
    it('각 조건의 도구명과 프롬프트를 안내문에 포함한다', () => {
      const suffix = evaluator.buildConditionSystemPromptSuffix([
        cond('refund', '환불 요청'),
        cond('cancel', '주문 취소'),
      ]);
      expect(suffix).toContain('[조건 안내]');
      expect(suffix).toContain('- cond_refund: 환불 요청');
      expect(suffix).toContain('- cond_cancel: 주문 취소');
      expect(suffix).toContain('조건에 해당하지 않으면 대화를 계속하세요.');
    });

    it('빈 배열이면 항목 없는 안내문을 반환한다 (호출부 가드와 무관하게 안전)', () => {
      const suffix = evaluator.buildConditionSystemPromptSuffix([]);
      expect(suffix).toContain('[조건 안내]');
      expect(suffix).toContain('조건에 해당하지 않으면 대화를 계속하세요.');
    });
  });

  describe('classifyToolCalls', () => {
    it('provider / condition / normal 로 분리한다', () => {
      const providers = [providerMatching('kb_')];
      const conditions = [cond('refund')];
      const calls = [
        toolCall('kb_search'),
        toolCall('cond_refund', '{"reason":"x"}'),
        toolCall('some_external_tool'),
      ];

      const result = evaluator.classifyToolCalls(calls, conditions, providers);

      expect(result.providerToolCalls).toHaveLength(1);
      expect(result.providerToolCalls[0].call.name).toBe('kb_search');
      expect(result.providerToolCalls[0].provider).toBe(providers[0]);
      expect(result.conditionToolCalls.map((c) => c.name)).toEqual([
        'cond_refund',
      ]);
      expect(result.normalToolCalls.map((c) => c.name)).toEqual([
        'some_external_tool',
      ]);
      expect(result.matchedCondition?.id).toBe('refund');
    });

    it('condition 다중 호출 시 conditions 배열에서 가장 앞쪽 정의된 항목을 winner 로 채택한다', () => {
      const conditions = [cond('first'), cond('second')];
      // LLM 이 정의 순서와 반대로 호출해도 winner 는 정의 순서 우선.
      const calls = [toolCall('cond_second'), toolCall('cond_first')];

      const result = evaluator.classifyToolCalls(calls, conditions, []);

      expect(result.matchedCondition?.id).toBe('first');
      expect(result.conditionToolCalls).toHaveLength(2);
    });

    it('provider 매칭이 condition 매칭보다 우선한다', () => {
      // provider 가 cond_* 까지 잡으면 provider 로 분류 (현행 우선순위 보존).
      const providers = [providerMatching('cond_')];
      const conditions = [cond('refund')];
      const result = evaluator.classifyToolCalls(
        [toolCall('cond_refund')],
        conditions,
        providers,
      );
      expect(result.providerToolCalls).toHaveLength(1);
      expect(result.conditionToolCalls).toHaveLength(0);
      expect(result.matchedCondition).toBeNull();
    });

    it('condition 호출이 없으면 matchedCondition 은 null', () => {
      const result = evaluator.classifyToolCalls(
        [toolCall('some_external_tool')],
        [cond('refund')],
        [],
      );
      expect(result.matchedCondition).toBeNull();
      expect(result.normalToolCalls).toHaveLength(1);
    });

    it('빈 toolCalls 면 3개 배열 모두 비고 matchedCondition 은 null', () => {
      const result = evaluator.classifyToolCalls([], [cond('refund')], []);
      expect(result.providerToolCalls).toHaveLength(0);
      expect(result.conditionToolCalls).toHaveLength(0);
      expect(result.normalToolCalls).toHaveLength(0);
      expect(result.matchedCondition).toBeNull();
    });
  });

  describe('extractConditionReason', () => {
    it('condition tool_call 의 reason 인자를 파싱한다', () => {
      const calls = [toolCall('cond_refund', '{"reason":"고객 환불 요청"}')];
      expect(evaluator.extractConditionReason(calls, 'refund')).toBe(
        '고객 환불 요청',
      );
    });

    it('reason 은 CONDITION_REASON_MAX_CHARS(500)자로 절단한다', () => {
      const long = 'x'.repeat(CONDITION_REASON_MAX_CHARS + 100);
      const calls = [toolCall('cond_refund', JSON.stringify({ reason: long }))];
      expect(evaluator.extractConditionReason(calls, 'refund')).toHaveLength(
        CONDITION_REASON_MAX_CHARS,
      );
    });

    it('멀티바이트 문자도 char(코드유닛) 단위로 절단한다', () => {
      const long = '한'.repeat(CONDITION_REASON_MAX_CHARS + 100);
      const calls = [toolCall('cond_refund', JSON.stringify({ reason: long }))];
      expect(evaluator.extractConditionReason(calls, 'refund')).toHaveLength(
        CONDITION_REASON_MAX_CHARS,
      );
    });

    it('해당 condition 호출이 없으면 빈 문자열', () => {
      expect(
        evaluator.extractConditionReason([toolCall('cond_other')], 'refund'),
      ).toBe('');
    });

    it('빈 toolCalls 면 빈 문자열', () => {
      expect(evaluator.extractConditionReason([], 'refund')).toBe('');
    });

    it('arguments 가 잘못된 JSON 이면 빈 문자열', () => {
      const calls = [toolCall('cond_refund', '{not json')];
      expect(evaluator.extractConditionReason(calls, 'refund')).toBe('');
    });

    it('reason 필드가 문자열이 아니면 빈 문자열', () => {
      const calls = [toolCall('cond_refund', '{"reason":123}')];
      expect(evaluator.extractConditionReason(calls, 'refund')).toBe('');
    });
  });
});
