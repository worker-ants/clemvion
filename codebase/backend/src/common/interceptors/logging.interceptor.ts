import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Health probe 경로 (spec/data-flow/9-observability.md §1.1).
 * readiness(`/api/health`)·liveness(`/api/health/live`)는 k8s probe 가 고빈도로
 * 호출하므로 성공 로그를 기본 억제한다 (아래 게이팅 규칙).
 */
const HEALTH_PROBE_PATHS = new Set(['/api/health', '/api/health/live']);

/**
 * HTTP 요청·응답을 로깅하는 인터셉터 (spec/data-flow/9-observability.md §1.1).
 *
 * health probe 경로(`/api/health`, `/api/health/live`)는 k8s 가 고빈도로 호출하므로
 * 성공 로그를 기본 억제한다 (게이팅 규칙):
 *   - 실패(status >= 400): `HEALTH_CHECK_LOG` 설정에 무관하게 항상 WARN 레벨 로그.
 *   - 성공(status < 400): `HEALTH_CHECK_LOG=true` 일 때만 INFO 레벨 로그.
 *
 * 그 외 경로는 결과와 무관하게 항상 INFO 레벨로 로그한다.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  /** HEALTH_CHECK_LOG=true 일 때만 health probe 성공 로그를 남긴다 (기본 false). */
  private readonly healthCheckLog: boolean;

  constructor(config: ConfigService) {
    this.healthCheckLog = config.get<string>('HEALTH_CHECK_LOG') === 'true';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ method: string; url: string }>();
    const { method, url } = request;
    const path = url.split('?')[0];
    const isHealthProbe = HEALTH_PROBE_PATHS.has(path);
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        const { statusCode } = response;
        const message = `${method} ${url} ${statusCode} ${Date.now() - now}ms`;

        // Health probe 경로: 실패(>=400)는 항상 WARN, 성공은 HEALTH_CHECK_LOG 일 때만 INFO.
        if (isHealthProbe) {
          if (statusCode >= 400) {
            this.logger.warn(message);
          } else if (this.healthCheckLog) {
            this.logger.log(message);
          }
          return;
        }

        this.logger.log(message);
      }),
    );
  }
}
