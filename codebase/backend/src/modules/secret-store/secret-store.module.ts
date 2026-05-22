import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecretStore } from './entities/secret-store.entity';
import { SecretResolverService } from './secret-resolver.service';

/**
 * Secret store 모듈 — `spec/conventions/secret-store.md` 의 SecretResolver 단일 구현.
 *
 * 다른 모듈은 본 모듈을 import 하고 `SecretResolverService` 를 inject 한다.
 */
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([SecretStore])],
  providers: [SecretResolverService],
  exports: [SecretResolverService],
})
export class SecretStoreModule {}
