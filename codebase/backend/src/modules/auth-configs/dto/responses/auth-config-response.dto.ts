import { ApiProperty } from '@nestjs/swagger';

/** 커스텀 인증 설정 응답 DTO */
export class AuthConfigDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: ['api_key', 'bearer_token', 'basic_auth', 'hmac'],
    example: 'api_key',
  })
  type: string;

  /**
   * 타입별 세부 설정. secret 류 필드(key/token/secret/password)는 `***<last4>` 로
   * 마스킹된다 (spec/1-data-model.md §2.17.2). 평문은 create/regenerate/reveal 응답에서만.
   */
  @ApiProperty({ type: 'object', additionalProperties: true })
  config: Record<string, unknown>;

  @ApiProperty({ type: [String], example: [] })
  ipWhitelist: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ format: 'date-time', nullable: true })
  lastUsedAt?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** §A.3 기간별 호출 수 — 롤링 윈도(24h/7d/30d) 호출 건수 */
export class AuthConfigUsagePeriodCountsDto {
  @ApiProperty({ example: 5 })
  last24h: number;

  @ApiProperty({ example: 23 })
  last7d: number;

  @ApiProperty({ example: 78 })
  last30d: number;
}

/** 사용 통계 호출 아이템 */
export class AuthConfigUsageCallDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  triggerName: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ format: 'date-time' })
  startedAt: string;

  /**
   * webhook 호출의 소스 IP (§A.3). 캡처되지 않은 호출(비-HTTP 트리거·배포 이전 row)은 null.
   */
  @ApiProperty({ nullable: true, example: '203.0.113.7' })
  sourceIp: string | null;

  /**
   * 응답 코드 (§A.3, WH-MG-05). webhook 은 실제 HTTP 코드('202'). 비-HTTP 트리거는
   * 저장된 HTTP 코드가 없어 워크플로 status enum 으로 폴백 표시된다(예: 'completed').
   * 항상 non-null — HTTP 트리거는 실제 코드, 비-HTTP 트리거는 status enum 폴백.
   */
  @ApiProperty({
    example: '202',
    description:
      "webhook 실제 HTTP 응답 코드 (성공 경로 = '202'). 비-HTTP 트리거(schedule 등)는 HTTP 코드가 없어 워크플로 status enum 으로 폴백 표시 (예: 'completed', 'failed'). non-null.",
  })
  responseCode: string;
}

/** 사용 통계 응답 */
export class AuthConfigUsageDto {
  @ApiProperty({ example: 42 })
  totalCalls: number;

  @ApiProperty({ format: 'date-time', nullable: true })
  lastUsedAt?: string | null;

  @ApiProperty({ type: AuthConfigUsagePeriodCountsDto })
  periodCounts: AuthConfigUsagePeriodCountsDto;

  @ApiProperty({ type: [AuthConfigUsageCallDto] })
  recentCalls: AuthConfigUsageCallDto[];
}
