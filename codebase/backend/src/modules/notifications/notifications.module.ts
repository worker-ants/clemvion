import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  // WebsocketModule 은 forwardRef — WebsocketModule → forwardRef(ExecutionEngineModule)
  // → NotificationsModule(background_failed createMany) → WebsocketModule 로 이어지는
  // 모듈 순환을 끊는다. WebsocketService 는 NotificationsService 에 의존하지 않으므로
  // provider 레벨 forwardRef 는 불필요 (모듈 import 레벨만).
  imports: [
    TypeOrmModule.forFeature([Notification]),
    forwardRef(() => WebsocketModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
