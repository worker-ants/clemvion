import { Injectable, Logger } from '@nestjs/common';

export type ErrorPolicy =
  | 'stop_workflow'
  | 'skip_node'
  | 'use_default_output'
  | 'retry'
  | 'route_to_error_port';

export interface RetryConfig {
  maxRetries: number;
  retryInterval: number; // milliseconds
  backoffMultiplier: number;
}

export interface ErrorPolicyConfig {
  policy: ErrorPolicy;
  defaultOutput?: unknown;
  retryConfig?: RetryConfig;
}

export interface ErrorHandlingResult {
  action: 'stop' | 'skip' | 'use_default' | 'retry' | 'route_error';
  output?: unknown;
  shouldRetry?: boolean;
  retryDelay?: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryInterval: 1000,
  backoffMultiplier: 2,
};

@Injectable()
export class ErrorPolicyHandler {
  private readonly logger = new Logger(ErrorPolicyHandler.name);

  /**
   * Determine the action to take based on the configured error policy.
   */
  handleError(
    error: Error,
    config: ErrorPolicyConfig,
    currentRetryCount: number,
  ): ErrorHandlingResult {
    switch (config.policy) {
      case 'stop_workflow':
        return { action: 'stop' };

      case 'skip_node':
        this.logger.warn(`Skipping node due to error: ${error.message}`);
        return { action: 'skip' };

      case 'use_default_output':
        this.logger.warn(
          `Using default output due to error: ${error.message}`,
        );
        return { action: 'use_default', output: config.defaultOutput ?? null };

      case 'retry': {
        const retryConfig = config.retryConfig ?? DEFAULT_RETRY_CONFIG;
        if (currentRetryCount < retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(
            currentRetryCount,
            retryConfig,
          );
          this.logger.warn(
            `Retrying node (attempt ${currentRetryCount + 1}/${retryConfig.maxRetries}) after ${delay}ms`,
          );
          return { action: 'retry', shouldRetry: true, retryDelay: delay };
        }
        this.logger.error(
          `Max retries (${retryConfig.maxRetries}) exceeded: ${error.message}`,
        );
        return { action: 'stop' };
      }

      case 'route_to_error_port':
        return {
          action: 'route_error',
          output: {
            error: {
              code: error.name,
              message: error.message,
            },
          },
        };

      default:
        return { action: 'stop' };
    }
  }

  /**
   * Calculate retry delay with exponential backoff.
   */
  private calculateRetryDelay(
    currentRetryCount: number,
    config: RetryConfig,
  ): number {
    return (
      config.retryInterval *
      Math.pow(config.backoffMultiplier, currentRetryCount)
    );
  }
}
