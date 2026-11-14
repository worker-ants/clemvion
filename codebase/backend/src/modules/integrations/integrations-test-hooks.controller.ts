import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiTags,
} from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { Roles } from '../../common/guards/roles.guard';
import { WorkspaceId } from '../../common/decorators';
import { forbiddenForRole } from '../../common/swagger';
import { MCP_ERROR_CODES } from '../mcp/mcp-error-codes';
import { Integration } from './entities/integration.entity';
import { IntegrationsService } from './integrations.service';

// 이 훅을 들인 작업: CLE-T-184JJD (MCP 인증 실패 조치 필요 알림).
/**
 * e2e 전용 훅을 열지 정하는 게이트. `NODE_ENV==='test'` 와 `E2E_TEST_HOOKS==='1'` 이 둘 다일 때만 참이다.
 *
 * `IntegrationsModule` 은 모듈을 불러올 때 이 값으로 컨트롤러 등록 여부를 한 번 정한다. 그래서 e2e 서버는 기동 전에 두 변수를
 * 받아야 한다(`docker-compose.e2e.yml` 의 backend 환경). 핸들러는 요청마다 같은 함수로 다시 확인한다.
 */
export function isE2eTestHooksEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === 'test' && env.E2E_TEST_HOOKS === '1';
}

/**
 * 통합 모듈의 **e2e 전용 test-hook 이다. 프로덕션 표면이 아니다.**
 *
 * MCP 도구 호출의 인증 실패(`MCP_AUTH_FAILED`)는 AI 에이전트가 LLM 응답에 따라 외부 MCP 서버를 부를 때만 생긴다. e2e
 * 환경에는 LLM 과 MCP 모의 서버가 없어서 HTTP 로 그 경로를 재현할 수 없다. 이 훅은 실행 엔진의 MCP 도구 프로바이더가 넘기는
 * 것과 같은 값으로 `IntegrationsService.logUsage` 를 불러 조건부 상태 전이와 조치 필요 알림을 실제 PostgreSQL · DI 배선으로
 * 확인하게 한다.
 *
 * 게이트는 실행 컨트롤러의 `_test/*` 훅과 같다. (1) `NODE_ENV==='test'` 와 (2) `E2E_TEST_HOOKS==='1'` 이 둘 다일 때만
 * 동작하고, 아니면 라우트가 없는 것처럼 404 를 준다. 프로덕션 이미지는 `NODE_ENV=production` 이고 플래그도 없다. (3)
 * `@Roles('owner')` 라 게이트가 뚫려도 워크스페이스 소유자만 부를 수 있다. 통합은 요청 워크스페이스 안에서만 찾는다.
 * 모듈은 같은 게이트(`isE2eTestHooksEnabled`)로 이 컨트롤러를 등록할지 정한다.
 */
@ApiTags('Integrations')
@ApiBearerAuth('access-token')
@Controller('integrations')
export class IntegrationsTestHooksController {
  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * 통합 하나에 MCP 인증 실패 사용 기록을 남긴다. `nodeExecutionId` · `workflowId` 는 사용 기록 행의 외래 키라 실제 행이어야
   * 한다. 값 검증은 직접 한다. DTO 클래스를 두면 e2e 전용 입력이 공개 계약 가드 대상에 섞인다.
   */
  @Post(':id/_test/mcp-auth-failure')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('owner')
  @ApiExcludeEndpoint()
  @ApiForbiddenResponse({ description: forbiddenForRole('owner') })
  async recordMcpAuthFailureForTest(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() body: Record<string, unknown> | undefined,
  ): Promise<{ success: true }> {
    if (!isE2eTestHooksEnabled()) throw new NotFoundException();
    const nodeExecutionId = body?.nodeExecutionId;
    const workflowId = body?.workflowId;
    if (
      typeof nodeExecutionId !== 'string' ||
      !isUUID(nodeExecutionId) ||
      typeof workflowId !== 'string' ||
      !isUUID(workflowId)
    ) {
      throw new BadRequestException(
        'nodeExecutionId and workflowId must be UUIDs',
      );
    }
    const integration = await this.integrationRepository.findOne({
      where: { id, workspaceId },
    });
    if (!integration) throw new NotFoundException();
    await this.integrationsService.logUsage(integration, {
      nodeExecutionId,
      workflowId,
      status: 'failed',
      durationMs: 0,
      error: {
        code: MCP_ERROR_CODES.AUTH_FAILED,
        message: 'e2e test hook: MCP server returned 401',
      },
    });
    return { success: true };
  }
}
