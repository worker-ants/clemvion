import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LlmConfigService } from '../llm-config/llm-config.service';
import { LlmConfig } from '../llm-config/entities/llm-config.entity';
import { type LlmProvider } from '../llm-config/dto/create-llm-config.dto';
import { LLMClientFactory } from './llm-client.factory';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ChatStreamEvent,
  ModelInfo,
} from './interfaces/llm-client.interface';
import { LlmUsageLogService } from './llm-usage-log.service';

const LIST_MODELS_TIMEOUT_MS = 30_000;

// SSRF 완화 — non-local 프로바이더가 loopback/link-local/RFC1918/IPv6 사설 대역을
// 가리키는 것을 차단한다.
//
// 의도적 한계:
// - DNS 이름은 해석하지 않는다 (비용·공격 빈도 대비). 공격자가 RFC1918 로 해석
//   되는 도메인을 넣으면 우회 가능. rate limit(`@Throttle` 10/60s) + editor
//   권한으로 완화하며, 실차단이 필요하면 egress 방화벽으로 보완.
// - `local` 프로바이더는 self-hosted Ollama/vLLM 런타임이 localhost/사설망에
//   있는 게 정상 사용 사례이므로 previewModels 에서 본 함수를 건너뛴다 (spec §5.5).
function isPrivateHost(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  // Defense-in-depth — `@IsUrl` at the DTO layer already whitelists http/https,
  // but if this helper is reused elsewhere we must not treat file:// or other
  // non-HTTP schemes as "not private" (they have an empty hostname).
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  let hostname = parsed.hostname.toLowerCase();
  if (!hostname) return false;
  // URL.hostname 은 IPv6 리터럴을 대괄호 없이 반환하는 경우가 있으나, 일부 입력
  // 형태에서 `[...]` 가 남아있을 수 있어 방어적으로 제거한다.
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  if (hostname === 'localhost') return true;

  // IPv6 처리 먼저. `::1` loopback, `fc00::/7` ULA, `fe80::/10` link-local,
  // IPv4-mapped (`::ffff:<ipv4>`).
  if (hostname.includes(':')) {
    if (hostname === '::1' || hostname === '0:0:0:0:0:0:0:1') return true;
    const prefix = hostname.split('%')[0]; // strip zone id (e.g. fe80::1%eth0)
    if (/^fc[0-9a-f]{2}:/i.test(prefix)) return true; // fc00::/7 (fc..-fd..)
    if (/^fd[0-9a-f]{2}:/i.test(prefix)) return true;
    if (/^fe[89ab][0-9a-f]:/i.test(prefix)) return true; // fe80::/10
    // IPv4-mapped IPv6 — Node URL 은 `::ffff:10.0.0.1` 을 `::ffff:a00:1` 로
    // 정규화하므로 hex 세그먼트 두 개를 IPv4 로 재구성해 다시 검사한다.
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(prefix);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isPrivateHost(`http://${ipv4}`);
    }
    // 일부 입력 경로(예: URL 아닌 raw string)에서 도트 형태가 유지된 경우 대비.
    const mappedDotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(
      prefix,
    );
    if (mappedDotted) return isPrivateHost(`http://${mappedDotted[1]}`);
    return false;
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 0) return true; // 0.0.0.0/8 (unspecified — SSRF to localhost on some stacks)
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  return false;
}

/**
 * LLM 호출 시점의 실행 컨텍스트(선택).
 * `workspaceId`는 `LlmConfig.workspaceId`로 자동 채워지므로 호출부에서 지정 불필요.
 * 워크플로우/실행/노드 단위 귀속이 필요하면 호출부에서 명시한다.
 */
export interface LlmCallContext {
  workflowId?: string | null;
  executionId?: string | null;
  nodeExecutionId?: string | null;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly clientCache = new Map<string, LLMClient>();

  constructor(
    private readonly llmConfigService: LlmConfigService,
    private readonly clientFactory: LLMClientFactory,
    private readonly usageLogService: LlmUsageLogService,
  ) {}

  createClient(config: LlmConfig): LLMClient {
    const cached = this.clientCache.get(config.id);
    if (cached) {
      return cached;
    }

    const apiKey = this.llmConfigService.getDecryptedApiKey(config);
    const client = this.clientFactory.create({
      provider: config.provider,
      apiKey,
      defaultModel: config.defaultModel,
      baseUrl: config.baseUrl,
    });

    this.clientCache.set(config.id, client);
    return client;
  }

  clearClientCache(configId: string): void {
    this.clientCache.delete(configId);
  }

  async chat(
    config: LlmConfig,
    params: ChatParams,
    context?: LlmCallContext,
  ): Promise<ChatResult> {
    const client = this.createClient(config);
    const result = await this.withRetry(() => client.chat(params));
    // 사용량 기록은 fire-and-forget — 실패해도 호출 결과에 영향 없음.
    // workspaceId는 LlmConfig에서 자동 채워지므로 컨텍스트 누락에 무관하게 집계됨.
    void this.usageLogService.record({
      workspaceId: config.workspaceId,
      workflowId: context?.workflowId,
      executionId: context?.executionId,
      nodeExecutionId: context?.nodeExecutionId,
      llmConfigId: config.id,
      provider: config.provider,
      model: result.model,
      usage: result.usage,
    });
    return result;
  }

  async *chatStream(
    config: LlmConfig,
    params: ChatParams,
    context?: LlmCallContext,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    const client = this.createClient(config);
    if (!client.stream) {
      throw new BadRequestException({
        code: 'LLM_STREAMING_UNSUPPORTED',
        message: `Provider '${config.provider}' does not support streaming in this release.`,
      });
    }
    let lastUsage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      thinkingTokens?: number;
    } | null = null;
    let lastModel: string = config.defaultModel;
    try {
      for await (const event of client.stream(params, signal)) {
        if (event.type === 'done') {
          lastUsage = event.usage;
          lastModel = event.model;
        }
        yield event;
      }
    } finally {
      // done 이벤트에 usage가 실려왔을 때만 기록. abort/error 시에는 제공자 응답이
      // 불완전할 수 있어 0건으로 기록되는 것을 피한다. fire-and-forget이지만
      // 실패를 silent drop하지 않고 경고 로그를 남긴다.
      if (lastUsage && lastUsage.totalTokens > 0) {
        this.usageLogService
          .record({
            workspaceId: config.workspaceId,
            workflowId: context?.workflowId,
            executionId: context?.executionId,
            nodeExecutionId: context?.nodeExecutionId,
            llmConfigId: config.id,
            provider: config.provider,
            model: lastModel,
            usage: lastUsage,
          })
          ?.catch?.((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Usage log record failed: ${msg}`);
          });
      }
    }
  }

  async embed(
    config: LlmConfig,
    texts: string[],
    model?: string,
  ): Promise<number[][]> {
    const client = this.createClient(config);
    // Batch embed in chunks of 20
    const batchSize = 20;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await this.withRetry(() => client.embed(batch, model));
      allEmbeddings.push(...embeddings);
    }
    return allEmbeddings;
  }

  async testConnection(
    configId: string,
    workspaceId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await this.llmConfigService.findEntity(
        configId,
        workspaceId,
      );
      const client = this.createClient(config);
      await client.testConnection();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`LLM connection test failed: ${message}`);
      return { success: false, error: this.sanitizeErrorMessage(message) };
    }
  }

  async listModels(
    configId: string,
    workspaceId: string,
  ): Promise<ModelInfo[]> {
    const config = await this.llmConfigService.findEntity(
      configId,
      workspaceId,
    );
    const client = this.createClient(config);
    try {
      return await this.withTimeout(
        (signal) => client.listModels(signal),
        LIST_MODELS_TIMEOUT_MS,
      );
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const sanitized = this.sanitizeErrorMessage(raw);
      this.logger.warn(`LLM list models failed: ${sanitized}`);
      throw new BadRequestException({
        code: 'LLM_MODEL_LIST_FAILED',
        message: sanitized,
      });
    }
  }

  // apiKey는 이 스코프 밖으로 기록·저장되지 않는다 (spec §5.4).
  async previewModels(params: {
    provider: LlmProvider;
    apiKey: string;
    baseUrl?: string;
  }): Promise<ModelInfo[]> {
    if (params.provider !== 'local' && !params.apiKey) {
      throw new BadRequestException({
        code: 'LLM_CREDENTIALS_REQUIRED',
        message: 'API key is required for this provider.',
      });
    }
    if (
      params.baseUrl &&
      params.provider !== 'local' &&
      isPrivateHost(params.baseUrl)
    ) {
      throw new BadRequestException({
        code: 'LLM_CONFIG_INVALID',
        message:
          'Private/loopback addresses are only allowed for the local provider.',
      });
    }
    let client: LLMClient;
    try {
      client = this.clientFactory.create({
        provider: params.provider,
        apiKey: params.apiKey,
        defaultModel: '',
        baseUrl: params.baseUrl,
      });
    } catch (error) {
      // Factory errors are defined in llm-client.factory.ts and contain no
      // user-supplied apiKey, so they can surface as-is to help the user
      // (e.g. "Azure OpenAI requires a base URL").
      const raw = error instanceof Error ? error.message : String(error);
      this.logger.warn(`LLM preview client init failed: ${raw}`);
      throw new BadRequestException({
        code: 'LLM_CONFIG_INVALID',
        message: raw,
      });
    }
    try {
      return await this.withTimeout(
        (signal) => client.listModels(signal),
        LIST_MODELS_TIMEOUT_MS,
      );
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const sanitized = this.sanitizeErrorMessage(raw);
      this.logger.warn(`LLM preview models failed: ${sanitized}`);
      throw new BadRequestException({
        code: 'LLM_MODEL_LIST_FAILED',
        message: sanitized,
      });
    }
  }

  // 타임아웃 시 AbortController 로 내부 HTTP 요청을 취소해 소켓이 백그라운드에
  // 남지 않도록 하고, 동시에 Promise.race 로 즉시 타임아웃 에러를 던진다. SDK 가
  // abort 에 반응하지 않는 경우에도 race 가 시간 보장을 담당한다.
  private async withTimeout<T>(
    run: (signal: AbortSignal) => Promise<T>,
    ms: number,
  ): Promise<T> {
    const controller = new AbortController();
    const inner = run(controller.signal);
    // Promise.race 에서 진 쪽 promise 의 rejection 이 unhandled 로 뜨지 않도록
    // no-op catch 를 붙인다. abort 전파로 SDK 가 reject 하면 여기서 삼켜진다.
    inner.catch(() => undefined);
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        inner,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timed out after ${ms}ms`));
          }, ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async resolveConfig(
    llmConfigId: string | undefined,
    workspaceId: string,
  ): Promise<LlmConfig> {
    if (llmConfigId && llmConfigId.trim()) {
      return this.llmConfigService.findEntity(llmConfigId, workspaceId);
    }
    const defaultConfig = await this.llmConfigService.findDefault(workspaceId);
    if (!defaultConfig) {
      throw new BadRequestException({
        code: 'LLM_CONFIG_NOT_FOUND',
        message: 'No LLM config specified and no default provider configured',
      });
    }
    return defaultConfig;
  }

  private sanitizeErrorMessage(message: string): string {
    if (
      message.includes('401') ||
      message.toLowerCase().includes('unauthorized') ||
      message.toLowerCase().includes('authentication')
    ) {
      return 'Authentication failed. Please check your API key.';
    }
    if (
      message.includes('403') ||
      message.toLowerCase().includes('forbidden')
    ) {
      return 'Access denied. Please check your API key permissions.';
    }
    if (
      message.includes('404') ||
      message.toLowerCase().includes('not found')
    ) {
      return 'Model or endpoint not found. Please check your configuration.';
    }
    if (
      message.includes('429') ||
      message.toLowerCase().includes('rate limit')
    ) {
      return 'Rate limit exceeded. Please try again later.';
    }
    if (
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('timed out')
    ) {
      return 'Connection timed out. Please check your network or endpoint URL.';
    }
    if (
      message.toLowerCase().includes('econnrefused') ||
      message.toLowerCase().includes('connection refused')
    ) {
      return 'Connection refused. Please check your endpoint URL.';
    }
    if (
      message.toLowerCase().includes('enotfound') ||
      message.toLowerCase().includes('getaddrinfo')
    ) {
      return 'Could not resolve hostname. Please check your endpoint URL.';
    }
    return 'Connection test failed. Please check your configuration.';
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRateLimit =
          lastError.message.includes('429') ||
          lastError.message.toLowerCase().includes('rate limit');
        if (!isRateLimit || attempt === maxRetries) {
          throw lastError;
        }
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(
          `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError || new Error('Max retries exceeded');
  }
}
