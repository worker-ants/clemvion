import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

/**
 * e2e 전용 훅 `POST /api/notifications/_test/send-daily-digest` 의 본문.
 * 프로덕션 표면이 아니라 swagger 에 싣지 않는다.
 */
export class SendDailyDigestTestDto {
  /** 주어지면 이 사용자만 받는 사람 후보로 삼는다. 생략하면 전체다. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  userIds?: string[];
}
