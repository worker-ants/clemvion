import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthConfig } from './entities/auth-config.entity';
import { AuthConfigsController } from './auth-configs.controller';
import { AuthConfigsService } from './auth-configs.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuthConfig])],
  controllers: [AuthConfigsController],
  providers: [AuthConfigsService],
  exports: [AuthConfigsService],
})
export class AuthConfigsModule {}
