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
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthOAuthState } from './entities/auth-oauth-state.entity';
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
    TypeOrmModule.forFeature([RefreshToken, AuthOAuthState]),
    UsersModule,
    WorkspacesModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthOauthService, JwtStrategy, TotpService],
  exports: [AuthService, TotpService],
})
export class AuthModule {}
