import {
  GoogleGenerativeAI,
  GenerativeModel,
  Content,
} from '@google/generative-ai';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ModelInfo,
  ToolCall,
} from '../interfaces/llm-client.interface';

const GOOGLE_MODELS: ModelInfo[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', type: 'chat' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', type: 'chat' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', type: 'chat' },
  {
    id: 'text-embedding-004',
    name: 'Text Embedding 004',
    type: 'embedding',
  },
];

export class GoogleClient implements LLMClient {
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    apiKey: string,
    private readonly defaultModel: string,
  ) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private getModel(modelId: string, params: ChatParams): GenerativeModel {
    const tools: any[] = [];
    if (params.tools?.length) {
      tools.push({
        functionDeclarations: params.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      });
    }

    return this.genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: params.maxTokens,
        topP: params.topP,
        ...(params.responseFormat === 'json'
          ? { responseMimeType: 'application/json' }
          : {}),
      },
      ...(tools.length ? { tools } : {}),
    });
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const modelId = params.model || this.defaultModel;
    const model = this.getModel(modelId, params);

    const systemInstruction = params.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const history: Content[] = [];
    const nonSystemMessages = params.messages.filter(
      (m) => m.role !== 'system',
    );

    // Build conversation history (all except last user message)
    for (let i = 0; i < nonSystemMessages.length - 1; i++) {
      const m = nonSystemMessages[i];
      const role = m.role === 'assistant' ? 'model' : 'user';
      history.push({ role, parts: [{ text: m.content }] });
    }

    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
    if (!lastMessage) {
      return {
        content: null,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: modelId,
        finishReason: 'stop',
      };
    }
    const chat = model.startChat({
      history,
      ...(systemInstruction
        ? {
            systemInstruction: {
              role: 'user',
              parts: [{ text: systemInstruction }],
            },
          }
        : {}),
    });

    const result = await chat.sendMessage(lastMessage.content);
    const response = result.response;

    const toolCalls: ToolCall[] = [];
    let textContent = '';

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts ?? []) {
        if ('text' in part && part.text) {
          textContent += part.text;
        }
        if ('functionCall' in part && part.functionCall) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args),
          });
        }
      }
    }

    const finishReason: ChatResult['finishReason'] =
      toolCalls.length > 0 ? 'tool_calls' : 'stop';

    return {
      content: textContent || null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
      },
      model: modelId,
      finishReason,
    };
  }

  async embed(texts: string[], model?: string): Promise<number[][]> {
    const embeddingModel = this.genAI.getGenerativeModel({
      model: model || 'text-embedding-004',
    });
    const results: number[][] = [];
    for (const text of texts) {
      const result = await embeddingModel.embedContent(text);
      results.push(result.embedding.values);
    }
    return results;
  }

  listModels(): Promise<ModelInfo[]> {
    return Promise.resolve(GOOGLE_MODELS);
  }

  async testConnection(): Promise<boolean> {
    const model = this.genAI.getGenerativeModel({
      model: this.defaultModel || 'gemini-2.0-flash',
    });
    await model.generateContent('test');
    return true;
  }
}
