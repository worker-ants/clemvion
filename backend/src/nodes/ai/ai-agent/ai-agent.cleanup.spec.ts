/**
 * Verifies that the handler invokes `provider.cleanup({ executionId })` on
 * every execute() return path — happy success, exception, and the multi-turn
 * `waiting_for_input` transition. Catches review WARNING #14.
 */

import { AiAgentHandler } from './ai-agent.handler';
import type {
  AgentToolProvider,
  ProviderCleanupCtx,
} from './tool-providers/agent-tool-provider.interface';
import type { ExecutionContext } from '../../core/node-handler.interface';

function makeMockLlmService() {
  return {
    resolveConfig: jest.fn().mockResolvedValue({
      id: 'config-1',
      provider: 'openai',
      defaultModel: 'gpt-4o',
    }),
    chat: jest.fn().mockResolvedValue({
      content: 'ok',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      model: 'gpt-4o',
      finishReason: 'stop',
    }),
    embed: jest.fn(),
  };
}

function makeProvider(): AgentToolProvider & {
  cleanup: jest.Mock<Promise<void>, [ProviderCleanupCtx]>;
} {
  const cleanup = jest.fn<Promise<void>, [ProviderCleanupCtx]>(async () => {});
  return {
    key: 'mock',
    matches: () => false,
    buildTools: jest.fn().mockResolvedValue([]),
    execute: jest.fn(),
    cleanup,
  };
}

const baseContext: ExecutionContext = {
  executionId: 'exec-cleanup',
  workflowId: 'wf-1',
  variables: { __workspaceId: 'ws-1' },
  nodeOutputCache: {},
  structuredOutputCache: {},
  engineResolvedConfigCache: {},
  recursionDepth: 0,
};

describe('AiAgentHandler cleanup hook', () => {
  it('calls provider.cleanup({ executionId }) after a single-turn success', async () => {
    const llm = makeMockLlmService();
    const provider = makeProvider();
    const handler = new AiAgentHandler(llm as never, [provider]);

    await handler.execute(
      {},
      { userPrompt: 'hi', mode: 'single_turn' },
      baseContext,
    );

    expect(provider.cleanup).toHaveBeenCalledTimes(1);
    expect(provider.cleanup).toHaveBeenCalledWith({
      executionId: 'exec-cleanup',
    });
  });

  it('calls provider.cleanup even when LLM throws', async () => {
    const llm = makeMockLlmService();
    llm.chat.mockRejectedValueOnce(new Error('LLM down'));
    const provider = makeProvider();
    const handler = new AiAgentHandler(llm as never, [provider]);

    await expect(
      handler.execute(
        {},
        { userPrompt: 'hi', mode: 'single_turn' },
        baseContext,
      ),
    ).rejects.toThrow('LLM down');

    expect(provider.cleanup).toHaveBeenCalledTimes(1);
  });

  it('calls provider.cleanup when multi-turn enters waiting_for_input', async () => {
    const llm = makeMockLlmService();
    const provider = makeProvider();
    const handler = new AiAgentHandler(llm as never, [provider]);

    await handler.execute(
      {},
      {
        mode: 'multi_turn',
        systemPrompt: 'You are a helper',
        maxTurns: 5,
      },
      baseContext,
    );

    // Multi-turn first turn returns waiting_for_input — cleanup MUST run so
    // any open MCP sessions are released until the user responds.
    expect(provider.cleanup).toHaveBeenCalledTimes(1);
  });

  it('processMultiTurnMessage cleans up after returning', async () => {
    const llm = makeMockLlmService();
    const provider = makeProvider();
    const handler = new AiAgentHandler(llm as never, [provider]);

    // Minimal state simulating a resumed multi-turn conversation.
    const state = {
      executionId: 'exec-cleanup',
      workspaceId: 'ws-1',
      messages: [{ role: 'system', content: 'sys' }],
      turnCount: 0,
      maxTurns: 5,
      maxToolCalls: 10,
      knowledgeBases: [],
      toolNodeIds: [],
      toolOverrides: [],
      mcpServers: [],
      conditions: [],
      llmConfigId: 'config-1',
      model: 'gpt-4o',
      temperature: undefined,
      maxTokens: undefined,
      ragTopK: 5,
      ragThreshold: 0.7,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalThinkingTokens: 0,
      toolCalls: 0,
      ragSources: [],
    };

    await handler.processMultiTurnMessage('Hi there', state);
    expect(provider.cleanup).toHaveBeenCalledWith({
      executionId: 'exec-cleanup',
    });
  });

  it('a provider without cleanup hook does not break the handler', async () => {
    const llm = makeMockLlmService();
    const noopProvider: AgentToolProvider = {
      key: 'noop',
      matches: () => false,
      buildTools: jest.fn().mockResolvedValue([]),
      execute: jest.fn(),
    };
    const handler = new AiAgentHandler(llm as never, [noopProvider]);

    await expect(
      handler.execute(
        {},
        { userPrompt: 'hi', mode: 'single_turn' },
        baseContext,
      ),
    ).resolves.toBeDefined();
  });
});
