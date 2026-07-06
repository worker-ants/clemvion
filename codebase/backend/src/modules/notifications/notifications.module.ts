import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MailModule } from '../mail/mail.module';

// WebsocketModule 을 여기서 import 하지 않는다 — NotificationsModule 은
// nodes 배럴 초기화 경로(integrations→notifications→…) 안에 있어, WebsocketModule
// (→workflows→import-workflow.dto 의 top-level `[...ALL_NODE_TYPES]` spread) 를 file-level
// 로 import 하면 require 순환이 생겨 ALL_NODE_TYPES 가 미초기화된다. NotificationsService
// 는 WebsocketService 를 ModuleRef(strict:false) 로 지연 해석해 순환을 회피한다.
// MailModule 은 MailerModule 만 의존(앱 모듈 순환 없음)이라 직접 import 안전.
// User 는 이메일 조회용 repository (forFeature — 엔티티 등록만, 순환 무관).
@Module({
  imports: [TypeOrmModule.forFeature([Notification, User]), MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
