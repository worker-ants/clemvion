import { describe, it, expect } from '@jest/globals';

import { contractForDto } from '../../shared/testing/response-contract';
import { AlertRuleDto } from '../../modules/alerts/dto/responses/alert-rule-response.dto';
import { AuditLogDto } from '../../modules/audit-logs/dto/responses/audit-log-response.dto';
import {
  AuthConfigDto,
  AuthConfigUsageDto,
} from '../../modules/auth-configs/dto/responses/auth-config-response.dto';
import {
  DashboardSummaryDto,
  RecentExecutionDto,
} from '../../modules/dashboard/dto/responses/dashboard-response.dto';
import { EdgeDto } from '../../modules/edges/dto/responses/edge-response.dto';
import { NodeDto } from '../../modules/nodes/dto/responses/node-response.dto';
import { NotificationDto } from '../../modules/notifications/dto/responses/notification-response.dto';
import { ScheduleDto } from '../../modules/schedules/dto/responses/schedule-response.dto';
import {
  LlmUsageByModelDto,
  LlmUsageSummaryDto,
  LlmUsageTimeseriesItemDto,
  StatisticsSummaryDto,
} from '../../modules/statistics/dto/responses/statistics-response.dto';
import {
  TriggerDto,
  TriggerHistoryItemDto,
} from '../../modules/triggers/dto/responses/trigger-response.dto';
import {
  CurrentUserProfileDto,
  UserProfileDto,
} from '../../modules/users/dto/responses/user-response.dto';
import {
  ExportWorkflowDto,
  WorkflowDto,
} from '../../modules/workflows/dto/responses/workflow-response.dto';
import { WorkspaceInvitationDto } from '../../modules/workspaces/dto/responses/workspace-response.dto';

/**
 * §5.4 래칫(`swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`)에서 뺀 응답 필드의 선언 모양을 고정한다
 * (API 규약 §5.5 「부재 표현」, NERV Task `CLE-T-H6DT8G`).
 *
 * ## 왜 래칫과 e2e 만으로는 부족한가
 *
 * 래칫은 `required: false` + `nullable: true` 조합만 본다. 이 필드들을 `@ApiProperty({ nullable: true })` 로 두되
 * `type` 을 빼면 래칫을 통과한다. 그런데 `string | null` 의 설계 타입은 `Object` 라서 스키마가 `type: 'object'` 가 된다.
 * e2e 계약 대조는 그 자리에 문자열이 와도 막지 않을 수 있다. 그래서 필수 · nullable · 원시 타입 세 가지를 여기서 함께 묻는다.
 */
type Shape = {
  dto: abstract new (...args: never[]) => unknown;
  key: string;
  type: 'string' | 'number' | 'object' | 'array';
};

const REQUIRED_NULLABLE: readonly Shape[] = [
  { dto: AlertRuleDto, key: 'workflowId', type: 'string' },
  { dto: AuditLogDto, key: 'ipAddress', type: 'string' },
  { dto: AuthConfigDto, key: 'ipWhitelist', type: 'array' },
  { dto: AuthConfigDto, key: 'lastUsedAt', type: 'string' },
  { dto: AuthConfigUsageDto, key: 'lastUsedAt', type: 'string' },
  { dto: DashboardSummaryDto, key: 'runs7dChangePercent', type: 'number' },
  { dto: RecentExecutionDto, key: 'durationMs', type: 'number' },
  { dto: EdgeDto, key: 'condition', type: 'object' },
  { dto: NodeDto, key: 'containerId', type: 'string' },
  { dto: NodeDto, key: 'description', type: 'string' },
  { dto: NodeDto, key: 'toolOwnerId', type: 'string' },
  { dto: NotificationDto, key: 'dismissedAt', type: 'string' },
  { dto: NotificationDto, key: 'emailSentAt', type: 'string' },
  { dto: NotificationDto, key: 'resourceId', type: 'string' },
  { dto: NotificationDto, key: 'resourceType', type: 'string' },
  { dto: ScheduleDto, key: 'lastRunAt', type: 'string' },
  { dto: ScheduleDto, key: 'nextRunAt', type: 'string' },
  { dto: LlmUsageByModelDto, key: 'costUsd', type: 'number' },
  { dto: LlmUsageSummaryDto, key: 'topProvider', type: 'string' },
  { dto: LlmUsageSummaryDto, key: 'totalCostUsd', type: 'number' },
  { dto: LlmUsageTimeseriesItemDto, key: 'costUsd', type: 'number' },
  {
    dto: StatisticsSummaryDto,
    key: 'totalExecutionsChangeRate',
    type: 'number',
  },
  { dto: TriggerDto, key: 'authConfigId', type: 'string' },
  { dto: TriggerDto, key: 'endpointPath', type: 'string' },
  { dto: TriggerDto, key: 'lastTriggeredAt', type: 'string' },
  { dto: TriggerHistoryItemDto, key: 'durationMs', type: 'number' },
  { dto: UserProfileDto, key: 'avatarUrl', type: 'string' },
  { dto: CurrentUserProfileDto, key: 'avatarUrl', type: 'string' },
  { dto: CurrentUserProfileDto, key: 'pendingEmail', type: 'string' },
  { dto: ExportWorkflowDto, key: 'description', type: 'string' },
  { dto: WorkflowDto, key: 'description', type: 'string' },
  { dto: WorkflowDto, key: 'folderId', type: 'string' },
  { dto: WorkspaceInvitationDto, key: 'invitedBy', type: 'string' },
];

type PropertySchema = { type?: string; nullable?: boolean; $ref?: string };

async function propertyOf(
  dto: Shape['dto'],
  key: string,
): Promise<{ prop: PropertySchema | undefined; required: string[] }> {
  const contract = await contractForDto(dto as never);
  return {
    prop: contract.schema.properties?.[key] as PropertySchema | undefined,
    required: contract.schema.required ?? [],
  };
}

describe('래칫에서 뺀 응답 필드의 선언 모양', () => {
  it.each(REQUIRED_NULLABLE)(
    '$dto.name.$key 는 required + nullable 이고 $type 스키마다',
    async ({ dto, key, type }) => {
      const { prop, required } = await propertyOf(dto, key);
      expect(required).toContain(key);
      expect(prop?.nullable).toBe(true);
      expect(prop?.type).toBe(type);
    },
  );

  it('AlertRuleDto.window 는 NOT NULL 컬럼이라 required 문자열이고 nullable 이 아니다', async () => {
    const { prop, required } = await propertyOf(AlertRuleDto, 'window');
    expect(required).toContain('window');
    expect(prop?.type).toBe('string');
    expect(prop?.nullable).toBeUndefined();
  });

  it('AuditLogDto.user 는 NOT NULL 외래 키라 required 참조이고 nullable 이 아니다', async () => {
    const { prop, required } = await propertyOf(AuditLogDto, 'user');
    expect(required).toContain('user');
    expect(prop?.$ref).toBe('#/components/schemas/AuditLogUserDto');
    expect(prop?.nullable).toBeUndefined();
  });

  it('TriggerDto.nextRunAt 은 키 생략형이다 — required 가 아니고 nullable 도 아니다', async () => {
    const { prop, required } = await propertyOf(TriggerDto, 'nextRunAt');
    expect(required).not.toContain('nextRunAt');
    expect(prop?.type).toBe('string');
    expect(prop?.nullable).toBeUndefined();
  });

  it('UserProfileDto(수정 · 업로드 응답)는 pendingEmail 을 선언하지 않는다', async () => {
    const { prop } = await propertyOf(UserProfileDto, 'pendingEmail');
    expect(prop).toBeUndefined();
  });
});
