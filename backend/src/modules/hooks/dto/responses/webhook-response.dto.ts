import { ApiProperty } from '@nestjs/swagger';

/** 웹훅 접수 결과. `{ data: <이 객체> }` 로 래핑되어 반환됩니다. */
export class WebhookAcceptedDto {
  /** 시작된 실행의 ID */
  @ApiProperty({ format: 'uuid' })
  executionId: string;

  @ApiProperty({ example: 'Webhook received, workflow execution started' })
  message: string;
}
