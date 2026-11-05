import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { GlobalExceptionFilter } from '../../common/filters/http-exception.filter';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthController } from './auth.controller';
import { AuthOauthService } from './auth-oauth.service';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';

/**
 * `POST /api/auth/login` 이 Passkey 기능이 꺼진 동안 Passkey 만 등록한 계정에 내는 503 의
 * 응답 모양을 컨트롤러와 예외 필터까지 태워 고정한다(NERV CLE-ACCT-SIGNIN REQ-SIGNIN-067).
 * 서비스 분기는 `auth.service.spec.ts` 가 본다. 프런트 `login-form` 은 이 모양
 * (`error.code === 'WEBAUTHN_DISABLED'`)을 읽는다.
 *
 * e2e 는 Passkey 기능이 켜진 환경(`docker-compose.e2e.yml`)이라 꺼진 상태를 만들 수 없어
 * 서비스만 대체한 HTTP 테스트로 둔다.
 */
describe('POST /auth/login — WEBAUTHN_DISABLED (HTTP)', () => {
  let app: INestApplication;
  const login = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { login } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: AuthOauthService, useValue: {} },
        { provide: TotpService, useValue: {} },
        { provide: AuditLogsService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('503 과 error.code WEBAUTHN_DISABLED 봉투를 내고 토큰 · 쿠키는 싣지 않는다', async () => {
    login.mockRejectedValue(
      new ServiceUnavailableException({
        code: 'WEBAUTHN_DISABLED',
        message: 'Passkey 로그인이 이 서버에서 꺼져 있어요.',
      }),
    );

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@example.com', password: 'Passw0rd!x' });

    expect(res.status).toBe(503);
    expect(res.body?.error?.code).toBe('WEBAUTHN_DISABLED');
    expect(res.body).not.toHaveProperty('data');
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
