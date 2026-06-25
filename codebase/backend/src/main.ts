// OpenTelemetry는 다른 모듈을 import하기 전에 부트스트랩되어야 자동 계측이 정확하다.
import './instrumentation';
// undici dispatcher 의 autoSelectFamily 설정 — Node 22 + undici 의 IPv6 broken route
// ETIMEDOUT 회귀 fix. 모든 outbound fetch (TelegramClient / SlackClient / DiscordClient
// / LLM / HTTP node / cafe24 등) 가 자동 영향. instrumentation 직후 + AppModule import
// 전에 적용해야 NestJS module 의 fetch-using DI 가 새 dispatcher 사용.
import './bootstrap/undici-dispatcher';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, type INestApplication } from '@nestjs/common';

// DeprecationWarning 의 발생 위치를 추적하려면 stack 이 필요한데, 기본
// process warning emitter 는 stack 을 한 줄로만 출력한다. 노드 옵션
// `--trace-deprecation` 없이도 항상 전체 stack 을 남기도록 핸들러를 설치.
process.on('warning', (warning: Error) => {
  if (warning.name === 'DeprecationWarning') {
    process.stderr.write(
      `[DeprecationWarning] ${warning.message}\n${warning.stack ?? ''}\n`,
    );
  }
});
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser') as () => (
  req: unknown,
  res: unknown,
  next: (err?: unknown) => void,
) => void;
import { AppModule } from './app.module';
import {
  assertCorsOriginsConfigured,
  corsOriginCallback,
} from './common/utils/cors-origins';
import {
  createWebChatCorsDelegate,
  parseWidgetOrigins,
  type CorsRequestLike,
} from './common/cors/web-chat-cors';
import { WebChatCorsOriginResolver } from './modules/web-chat-cors/web-chat-cors-origin.resolver';
import {
  assertProductionConfig,
  isFlagOn,
  isSwaggerEnabled,
} from './common/config/production-guards';

/**
 * Swagger UI(`/docs`) 문서를 앱에 마운트한다 (04 M-1). 호출 자체가 게이팅 대상 —
 * production 에서는 `isSwaggerEnabled` 가 false 이면 호출되지 않는다.
 */
function setupSwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Clemvion API')
    .setDescription(
      [
        '워크플로우 자동화 플랫폼 Clemvion의 REST API 문서입니다.',
        '',
        '### 인증',
        '- 대부분의 엔드포인트는 JWT Bearer 토큰 인증이 필요합니다.',
        '- `/auth/login`, `/auth/register` 등 `@Public`으로 표시된 엔드포인트는 인증 없이 접근 가능합니다.',
        '- Refresh Token은 httpOnly 쿠키로 발급·관리됩니다.',
        '',
        '### 응답 포맷',
        '- 모든 성공 응답은 `{ data: ... }` 래퍼 형태로 전달됩니다.',
        '- 에러 응답은 `{ error: { code, message, requestId, details? } }` 형태를 따릅니다. `code`는 `VALIDATION_ERROR`, `AUTH_REQUIRED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `INVALID_STATE`, `RATE_LIMITED`, `INTERNAL_ERROR` 등의 문자열 상수이며, `requestId`는 요청 추적용 UUID입니다.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token (로그인 시 발급)',
      },
      'access-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description:
          'External Interaction API 전용 토큰 — `iext_<JWT>` (per_execution) 또는 `itk_<opaque>` (per_trigger). [Spec EIA §3.3 / §8.3].',
      },
      'interaction-token',
    )
    .addTag('Auth', '회원가입, 로그인, 토큰 갱신 등 인증 관련 API')
    .addTag('Sessions', '활성 세션 조회·강제 종료, 로그인 이력 조회')
    .addTag('Users', '사용자 프로필')
    .addTag('Workspaces', '팀 워크스페이스, 멤버 및 초대 관리')
    .addTag('Workflows', '워크플로우 CRUD 및 실행/복제/내보내기/가져오기')
    .addTag('Nodes', '워크플로우 노드 관리')
    .addTag('Edges', '워크플로우 엣지(연결선) 관리')
    .addTag('Workflow Versions', '워크플로우 버전 이력')
    .addTag('Folders', '워크플로우 폴더 관리')
    .addTag('Executions', '워크플로우 실행 조회 및 제어')
    .addTag('Schedules', '워크플로우 스케줄(크론) 관리')
    .addTag('Triggers', '웹훅/외부 트리거 관리')
    .addTag('Notifications', '알림 조회 및 읽음 처리')
    .addTag('Alerts', '실행 실패율·지속시간·LLM 비용 기반 알림 규칙')
    .addTag('Audit Logs', '감사 로그')
    .addTag('Integrations', '외부 서비스 통합(OAuth/API Key) 관리')
    .addTag('Auth Configs', '하위 API용 커스텀 인증 설정')
    .addTag('LLM Config', 'LLM Provider 설정 관리')
    .addTag('Knowledge Base', '지식 베이스 및 문서 임베딩 관리')
    .addTag('Dashboard', '대시보드 요약/요약 리스트')
    .addTag('Statistics', '통계 및 리포트')
    .addTag('Hooks', '웹훅 수신 엔드포인트')
    .addTag('Health', '서비스 헬스 체크')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
  });
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // 04 M-1 — 게이팅 판정을 부팅당 1회만 평가해 마운트·로그 두 곳이 동일 결정을 공유한다.
  const swaggerEnabled = isSwaggerEnabled(process.env);
  // Fail-closed (refactor 04 C-1·M-4·M-7 + 기존 OAUTH/LLM stub): NODE_ENV=production
  // 에서 비보안 stub·미설정/예시 secret·위험 플래그가 켜진 채 기동하면 즉시 throw 한다.
  // 전 분기는 production-guards.ts 단위 테스트로 검증. (비-production 은 no-op.)
  assertProductionConfig(process.env);

  // 04 M-7 — ALLOW_PRIVATE_HOST_TARGETS 는 정당한 self-host 용도(VPC 내부 DB/SMTP 등,
  // spec http-request §4)가 있어 throw 가 아닌 warn 으로 분리한다 — 운영자가 의도적으로
  // 켰을 수 있으나 SSRF 표면을 넓히므로 가시화한다.
  if (
    process.env.NODE_ENV === 'production' &&
    isFlagOn(process.env.ALLOW_PRIVATE_HOST_TARGETS)
  ) {
    logger.warn(
      '[SECURITY] ALLOW_PRIVATE_HOST_TARGETS 활성 (production) — 사설/loopback 호스트 ' +
        '대상 outbound 가 허용됩니다. self-host 의도가 아니면 SSRF 위험이니 비활성화하고, ' +
        '의도적이라면 egress 방화벽/IP allowlist 를 반드시 병행하세요.',
    );
  }

  // rawBody: true 는 HMAC 웹훅(`AuthConfigsService.verifyWebhookRequest`) 의 서명 검증에 필수다.
  // 미설정 시 `req.rawBody` 가 undefined 가 되어 HMAC 분기가 항상 401 을 반환한다.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  // Cloudflare(또는 단일 reverse proxy) 한 단계 뒤에서 동작하므로 hop 1 만
  // 신뢰한다. `true` 로 두면 임의의 X-Forwarded-For 헤더가 그대로 받아들여져
  // ThrottlerGuard 등 req.ip 기반 로직이 우회된다. CF-Connecting-IP 는 별도
  // 헬퍼(auth/utils/client-ip) 에서 1순위로 추출하며, origin 단에서
  // Cloudflare IP 대역 외 직접 접근을 차단하는 게 본 설정의 전제 조건이다.
  const expressInstance = app.getHttpAdapter().getInstance() as {
    disable: (header: string) => void;
    set: (key: string, value: unknown) => void;
  };
  expressInstance.set('trust proxy', 1);
  expressInstance.disable('x-powered-by');

  // Cookie parser
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger (04 M-1) — non-production 전용. production 에서는 무인증 API 표면
  // 정찰(엔드포인트·DTO 구조 노출)을 막기 위해 기본 미노출하며,
  // ENABLE_SWAGGER_IN_PROD=true opt-in 으로만 켠다. 게이팅 판정(isSwaggerEnabled)은
  // production-guards 단위 테스트로 검증한다.
  if (swaggerEnabled) {
    setupSwagger(app);
  }

  // CORS (W-1: 다중 도메인 allowlist + production fail-closed).
  // 우선순위: CORS_ORIGINS (콤마 구분) → FRONTEND_URL → wildcard (dev/test 만).
  // 경로-스코프 delegate (단일 레이어): /api/hooks/* 무제한, /api/external/* 워크스페이스 allowlist,
  // 그 외 기존 동작(frontend allowlist + credentials). SoT: spec/7-channel-web-chat/4-security §2.
  assertCorsOriginsConfigured();
  const webChatCorsResolver = app.get(WebChatCorsOriginResolver);
  const webChatCorsDelegate = createWebChatCorsDelegate({
    widgetOrigins: parseWidgetOrigins(process.env.WEB_CHAT_WIDGET_ORIGINS),
    resolveAllowlist: (executionId) =>
      webChatCorsResolver.resolveAllowlist(executionId),
    defaultOptions: () => ({ origin: corsOriginCallback, credentials: true }),
  });
  app.enableCors(
    (
      req: CorsRequestLike,
      cb: (err: Error | null, options?: unknown) => void,
    ) => webChatCorsDelegate(req, cb),
  );

  // workflow-resumable-execution Phase 1.2 — Graceful Shutdown.
  // Nest lifecycle 훅 (`onModuleDestroy` / `onApplicationShutdown`) 이
  // SIGTERM 시 호출되도록 활성. SoT: spec/5-system/4-execution-engine.md §11.
  // 본 호출이 없으면 `ShutdownStateService.onApplicationShutdown` 이 SIGTERM
  // 도착해도 트리거되지 않아 in-flight node execution 이 SERVER_INTERRUPTED
  // 로 마킹되지 못한다.
  app.enableShutdownHooks();

  const port = configService.get<number>('app.port') || 3011;
  await app.listen(port);
  logger.log(`Application running on port ${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs available at http://localhost:${port}/docs`);
  }
}
void bootstrap();
