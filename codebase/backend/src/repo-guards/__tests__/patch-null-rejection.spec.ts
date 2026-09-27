import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { UpdateWorkflowTestDatasetDto } from '../../modules/workflow-test-datasets/dto/update-workflow-test-dataset.dto';
import { UpdateNodeDto } from '../../modules/nodes/dto/update-node.dto';
import { UpdateTriggerDto } from '../../modules/triggers/dto/update-trigger.dto';
import { UpdateWorkflowDto } from '../../modules/workflows/dto/update-workflow.dto';
import { UpdateScheduleDto } from '../../modules/schedules/dto/update-schedule.dto';
import { UpdateAlertRuleDto } from '../../modules/alerts/dto/alert-rule.dto';
import { UpdateIntegrationDto } from '../../modules/integrations/dto/integration.dto';
import { UpdateAssistantSessionDto } from '../../modules/workflow-assistant/dto/update-assistant-session.dto';
import { UpdateModelConfigDto } from '../../modules/model-config/dto/update-model-config.dto';
import { UpdateKnowledgeBaseDto } from '../../modules/knowledge-base/dto/update-knowledge-base.dto';
import { UpdateAuthConfigDto } from '../../modules/auth-configs/dto/update-auth-config.dto';
import { UpdateMeDto } from '../../modules/users/dto/update-me.dto';
import { UpdateFolderDto } from '../../modules/folders/dto/update-folder.dto';
import { UpdateWorkspaceSettingsDto } from '../../modules/workspaces/dto/update-workspace-settings.dto';

/**
 * PATCH 요청 DTO 에서 **NOT NULL 컬럼**(또는 null 이면 서비스가 깨지는 값)에 대응하는 필드는 `null` 을 400 으로 거부한다.
 *
 * `@IsOptional()` 은 `undefined` **또는 `null`** 이면 다른 검증기를 전부 건너뛴다. 그래서 null 이 엔티티에 병합돼 저장 때 NOT NULL
 * 위반(23502)이 나거나 서비스가 null 에서 메서드를 불러, 클라이언트 입력이 500 이 됐다(`test/patch-null-rejection.e2e-spec.ts` 가
 * 고치기 전 코드로 잰 결과: 31건 500 · 노드 `label` 엉뚱한 409 · 트리거 `endpointPath` 200 으로 경로 삭제). 이 표의 필드는
 * `IsOptionalNonNull()` 로 키 생략(= 값 불변)만 허용한다.
 *
 * 이 표는 `plan/complete/patch-null-validation.md` §전수(PATCH 21라우트)의 결과 그대로다. **새 필드는 자동으로 들어오지 않는다** —
 * NOT NULL 컬럼에 대응하는 PATCH 필드를 더하면 `@IsOptional()` 대신 `@IsOptionalNonNull()` 을 쓰고 여기에 한 줄 더한다. nullable
 * 컬럼(null = 값을 지움)은 반대로 `@IsOptional()` + `nullable: true` 다(API 규약 §5.4 PATCH tri-state).
 */

type DtoClass = new () => object;

const TABLE: Array<[DtoClass, string[]]> = [
  [UpdateWorkflowTestDatasetDto, ['name', 'input', 'visibility']],
  [UpdateNodeDto, ['label', 'positionX', 'positionY', 'config', 'isDisabled']],
  [UpdateTriggerDto, ['name', 'isActive', 'endpointPath']],
  [UpdateWorkflowDto, ['name', 'isActive', 'tags']],
  [UpdateScheduleDto, ['isActive', 'parameterValues']],
  [UpdateAlertRuleDto, ['threshold', 'window', 'channel', 'enabled']],
  [UpdateIntegrationDto, ['name']],
  [UpdateAssistantSessionDto, ['status']],
  [UpdateModelConfigDto, ['provider', 'name', 'defaultModel', 'defaultParams']],
  [
    UpdateKnowledgeBaseDto,
    [
      'name',
      'chunkSize',
      'chunkOverlap',
      'maxHops',
      'vectorSeedTopK',
      'expandedChunkLimit',
      'rerankMode',
      'rerankCandidateK',
    ],
  ],
  [UpdateAuthConfigDto, ['name', 'isActive']],
  [UpdateMeDto, ['name', 'locale', 'theme']],
  [UpdateFolderDto, ['name', 'sortOrder']],
  [UpdateWorkspaceSettingsDto, ['interactionAllowedOrigins', 'timezone']],
];

const CASES = TABLE.flatMap(([Dto, fields]) =>
  fields.map((field) => ({ dto: Dto.name, Dto, field })),
);

const VALIDATE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

async function constraintsFor(
  Dto: DtoClass,
  body: Record<string, unknown>,
  field: string,
): Promise<string[]> {
  const errors = await validate(plainToInstance(Dto, body), VALIDATE_OPTIONS);
  return Object.keys(
    errors.find((e) => e.property === field)?.constraints ?? {},
  );
}

describe('PATCH 의 NOT NULL 필드는 null 을 거부한다', () => {
  it('[전제] 표가 전수 결과(43필드)와 같다', () => {
    expect(CASES).toHaveLength(43);
  });

  it.each(CASES)(
    '$dto 의 $field — null 이면 isDefined 위반',
    async ({ Dto, field }) => {
      expect(await constraintsFor(Dto, { [field]: null }, field)).toContain(
        'isDefined',
      );
    },
  );

  it.each(CASES)(
    '$dto 의 $field — 키 생략은 통과한다',
    async ({ Dto, field }) => {
      expect(await constraintsFor(Dto, {}, field)).toStrictEqual([]);
    },
  );
});
