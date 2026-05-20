import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { LoginHistoryPrunerService } from './jobs/login-history-pruner.service';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('jwt.secret') ?? 'fallback',
        signOptions: {
          expiresIn: 900, // 15 minutes in seconds
        },
      }),
    }),
    TypeOrmModule.forFeature([RefreshToken, AuthOAuthState, LoginHistory]),
    UsersModule,
    WorkspacesModule,
    MailModule,
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
