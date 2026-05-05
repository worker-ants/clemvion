// OpenTelemetry는 다른 모듈을 import하기 전에 부트스트랩되어야 자동 계측이 정확하다.
import './instrumentation';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

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

async function bootstrap() {
  // Fail-closed: OAUTH_STUB_MODE bypasses real provider verification, so
  // running it in production would let anyone forge an account.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.OAUTH_STUB_MODE === 'true'
  ) {
    throw new Error(
      'OAUTH_STUB_MODE=true is not allowed when NODE_ENV=production',
    );
  }

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Remove x-powered-by header (security)
  (
    app.getHttpAdapter().getInstance() as {
      disable: (header: string) => void;
    }
  ).disable('x-powered-by');

  // Cookie parser
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger
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
    .addTag('Auth', '회원가입, 로그인, 토큰 갱신 등 인증 관련 API')
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

  // CORS
  app.enableCors({
    origin: configService.get<string>('app.frontendUrl'),
    credentials: true,
  });

  const port = configService.get<number>('app.port') || 3001;
  await app.listen(port);
  console.log(`Application running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}
void bootstrap();
