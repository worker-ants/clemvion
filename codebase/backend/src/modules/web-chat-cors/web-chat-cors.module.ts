import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Execution } from '../executions/entities/execution.entity';
import { WebChatCorsOriginResolver } from './web-chat-cors-origin.resolver';

// 웹채팅 위젯 CORS — execution→workspace allowlist resolver 제공.
// WorkspacesService 는 @Global(WorkspacesModule) 이므로 별도 import 불필요.
@Module({
  imports: [TypeOrmModule.forFeature([Execution])],
  providers: [WebChatCorsOriginResolver],
  exports: [WebChatCorsOriginResolver],
})
export class WebChatCorsModule {}
