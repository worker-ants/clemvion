import { Module, forwardRef } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthOauthService } from './auth-oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TotpService } from './totp.service';
import { WebAuthnModule } from './webauthn/webauthn.module';
import { WebAuthnController } from './webauthn/webauthn.controller';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthOAuthState } from './entities/auth-oauth-state.entity';
import { LoginHistory } from './entities/login-history.entity';
import { LoginHistoryService } from './login-history.service';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import {
  LoginHistoryPrunerService,
  LOGIN_HISTORY_PRUNER_QUEUE,
} from './jobs/login-history-pruner.service';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MailModule } from '../mail/mail.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        // `jwt.secret`(jwt.config.ts)는 `JWT_SECRET || 'dev-jwt-secret'` 라 항상 값이 있고,
        // production 은 main.ts 의 assertProductionConfig 가 미설정/sentinel 부팅을 거부한다
        // (refactor 04 C-1) — 따라서 옛 `?? 'fallback'` 죽은 분기를 제거한다.
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: 900, // 15 minutes in seconds
        },
      }),
    }),
    TypeOrmModule.forFeature([RefreshToken, AuthOAuthState, LoginHistory]),
    BullModule.registerQueue({ name: LOGIN_HISTORY_PRUNER_QUEUE }),
    // forwardRef: UsersController(UsersModule)가 비밀번호 변경 시 세션 회전을 위해
    // AuthService 를 주입한다(refactor 04 A-1) — AuthModule↔UsersModule 순환을 forwardRef 로 해소.
    forwardRef(() => UsersModule),
    WorkspacesModule,
    MailModule,
    // user.* 인증 감사 이벤트(2fa enable/disable·WebAuthn 등록/삭제)를
    // AuthController·WebAuthnController 가 기록 — 둘 다 AuthModule host (§Rationale 4.1.B).
    AuditLogsModule,
    // WebAuthn 도메인은 별도 서브모듈 — AuthService 가 login 분기 등에서
    // WebAuthnService.countCredentials() 등으로 호출 (단방향). spec §1.4.H.
    WebAuthnModule,
  ],
  controllers: [AuthController, SessionsController, WebAuthnController],
  providers: [
    AuthService,
    AuthOauthService,
    JwtStrategy,
    TotpService,
    LoginHistoryService,
    SessionsService,
    LoginHistoryPrunerService,
  ],
  exports: [AuthService, TotpService, LoginHistoryService, WebAuthnModule],
})
export class AuthModule {}
