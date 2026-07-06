import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// WebsocketModule 을 여기서 import 하지 않는다 — NotificationsModule 은
// nodes 배럴 초기화 경로(integrations→notifications→…) 안에 있어, WebsocketModule
// (→workflows→import-workflow.dto 의 top-level `[...ALL_NODE_TYPES]` spread) 를 file-level
// 로 import 하면 require 순환이 생겨 ALL_NODE_TYPES 가 미초기화된다. NotificationsService
// 는 WebsocketService 를 ModuleRef(strict:false) 로 지연 해석해 순환을 회피한다.
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
