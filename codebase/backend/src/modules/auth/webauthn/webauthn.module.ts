import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WebAuthnService } from './webauthn.service';
import { WebAuthnCredential } from './entities/webauthn-credential.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { LoginHistory } from '../entities/login-history.entity';
import { LoginHistoryService } from '../login-history.service';
import { UsersModule } from '../../users/users.module';

/**
 * WebAuthn (Passkey · 보안 키) 서브모듈.
 *
 * spec/5-system/1-auth.md §1.4 / Rationale 1.4.H — WebAuthn 도메인 (entity·service·DTO·
 * controller) 을 AuthModule 본체에서 분리해 단방향 의존성으로 정리. AuthModule 은 본
 * 모듈을 import 해서 `WebAuthnService` 를 주입받고, login 분기에서
 * `countCredentials()` 등을 사용.
 *
 * `WebAuthnController` 는 `AuthService.consumeChallengeToken`·`issueTokensAfterMfa`
 * 를 사용해야 하므로 AuthModule 의 controllers 배열에 등록한다 — 순환 의존성을 피하기
 * 위해 controller host 는 AuthModule, service/entity/DTO 만 본 모듈에 둔다.
 *
 * LoginHistoryService 는 AuthModule 과 WebAuthnModule 양쪽에 provider 로 둔다 —
 * 두 모듈이 각각 자기 인스턴스를 갖지만 INSERT-only audit log 이므로 동작 동등.
 * LoginHistoryModule 로 추가 분리하는 안은 별도 follow-up.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WebAuthnCredential, RefreshToken, LoginHistory]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') ?? 'fallback',
        signOptions: { expiresIn: 900 },
      }),
    }),
    UsersModule,
  ],
  providers: [WebAuthnService, LoginHistoryService],
  exports: [WebAuthnService],
})
export class WebAuthnModule {}
