import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { InteractionGuard } from './interaction.guard';
import type { RequestWithInteraction } from './interaction.guard';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { InteractionService } from './interaction.service';
import { InteractDto } from './dto/interact.dto';
import { CancelDto } from './dto/cancel.dto';
import {
  ExecutionStatusDto,
  InteractAckDto,
  RefreshTokenResponseDto,
} from './dto/responses.dto';

/**
 * [Spec EIA §5] — External Interaction API 의 inbound REST endpoint.
 *
 * 경로: `/api/external/executions/:executionId/*` (global prefix `api` + controller `external/executions`).
 * 기존 `/api/executions/*` 컨트롤러와 routing prefix·인증 family 둘 다 분리 ([Spec EIA §R11]).
 *
 * 인증: `interaction-token` Bearer scheme (`iext_*` JWT 또는 `itk_*` opaque). 기존 워크스페이스
 * JWT (`access-token`) 와 별개 family. `@Public()` 로 글로벌 JWT guard 우회 + `InteractionGuard` 가
 * 본 family 의 토큰을 검증.
 */
@ApiTags('External Interaction')
@ApiBearerAuth('interaction-token')
@Controller('external/executions')
@Public()
@UseGuards(InteractionGuard)
export class InteractionController {
  constructor(private readonly interactionService: InteractionService) {}

  @Post(':executionId/interact')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: '인터랙션 명령 제출',
    description:
      '실행 중인 워크플로우의 waiting_for_input 노드에 사용자 응답을 전달합니다. command 종류: submit_form / click_button / submit_message / end_conversation / cancel. Idempotency-Key 헤더로 24h 안전 재시도. 본 endpoint 는 비동기 — 응답은 즉시 202 Accepted 이며 실제 진행 상태는 SSE 스트림으로 받습니다.',
  })
  @ApiParam({ name: 'executionId', format: 'uuid' })
  @ApiAcceptedResponse({ type: InteractAckDto })
  @ApiBadRequestResponse({
    description:
      'VALIDATION_FAILED (form field) / INVALID_COMMAND (필수 필드 누락).',
  })
  @ApiUnauthorizedResponse({
    description: 'TOKEN_* (만료 / 위조 / scope mismatch).',
  })
  @ApiConflictResponse({
    description:
      'STATE_MISMATCH (waiting_for_input 아님) 또는 IDEMPOTENCY_KEY_CONFLICT.',
  })
  @ApiGoneResponse({
    description: 'EXECUTION_TERMINATED (이미 종료된 execution).',
  })
  @ApiNotFoundResponse({ description: 'EXECUTION_NOT_FOUND' })
  async interact(
    @Param('executionId', new ParseUUIDPipe()) executionId: string,
    @Body() dto: InteractDto,
    @Req() req: RequestWithInteraction,
  ): Promise<InteractAckDto> {
    // Guard 가 req.interaction 을 세팅. typescript 타입 안전을 위해 명시 추출.
    const ctx = req.interaction;
    if (!ctx) {
      throw new Error('interaction context missing — Guard 미적용?');
    }
    // dto 의 nodeId 와 URL 의 executionId 는 다른 차원이므로 별도 검증 X.
    void executionId; // 사용은 Guard 가 req.params 로 이미 수행.
    return this.interactionService.interact(ctx, dto);
  }

  @Post(':executionId/cancel')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: '실행 취소',
    description:
      'interact 의 command=cancel 과 동치인 편의 alias. 응답은 비동기 (202 Accepted) — 실제 취소 확정은 SSE 의 execution.cancelled 로.',
  })
  @ApiParam({ name: 'executionId', format: 'uuid' })
  @ApiAcceptedResponse({ type: InteractAckDto })
  @ApiUnauthorizedResponse({ description: 'TOKEN_*' })
  @ApiGoneResponse({ description: 'EXECUTION_TERMINATED' })
  @ApiNotFoundResponse({ description: 'EXECUTION_NOT_FOUND' })
  async cancel(
    @Param('executionId', new ParseUUIDPipe()) _executionId: string,
    @Body() _dto: CancelDto,
    @Req() req: RequestWithInteraction,
  ): Promise<InteractAckDto> {
    const ctx = req.interaction;
    if (!ctx) throw new Error('interaction context missing');
    return this.interactionService.cancel(ctx);
  }

  @Post(':executionId/refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '인터랙션 토큰 갱신',
    description:
      'iext_* (per_execution) 토큰을 만료 30분 이내 시점에만 신규로 갱신합니다. 본 endpoint 자체는 기존 토큰의 Authorization 헤더로 인증됩니다. per_trigger 토큰 (itk_*) 은 영구이므로 본 endpoint 의 대상이 아닙니다.',
  })
  @ApiParam({ name: 'executionId', format: 'uuid' })
  @ApiOkResponse({ type: RefreshTokenResponseDto })
  @ApiBadRequestResponse({ description: 'TOKEN_REFRESH_NOT_IN_WINDOW' })
  @ApiUnauthorizedResponse({ description: 'TOKEN_*' })
  @ApiGoneResponse({ description: 'EXECUTION_TERMINATED' })
  async refreshToken(
    @Param('executionId', new ParseUUIDPipe()) _executionId: string,
    @Req() req: RequestWithInteraction,
  ): Promise<RefreshTokenResponseDto> {
    const ctx = req.interaction;
    if (!ctx) throw new Error('interaction context missing');
    // 원본 토큰 추출 — Authorization 헤더 또는 ?token=.
    const auth = req.headers.authorization;
    const bearer =
      typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')
        ? auth.slice('bearer '.length).trim()
        : ((req.query as { token?: string } | undefined)?.token ?? '');
    return this.interactionService.refreshToken(ctx, bearer);
  }

  @Get(':executionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '실행 상태 단발 조회',
    description:
      'SSE 재연결 시 누락분 보정 또는 polling 클라이언트를 위한 경량 상태 조회. waiting_for_input 시점의 form/conversation config 같은 상세 context 는 SSE 가 권위 — 본 응답은 핵심 status / result / error 만.',
  })
  @ApiParam({ name: 'executionId', format: 'uuid' })
  @ApiOkResponse({ type: ExecutionStatusDto })
  @ApiUnauthorizedResponse({ description: 'TOKEN_*' })
  @ApiNotFoundResponse({ description: 'EXECUTION_NOT_FOUND' })
  async getStatus(
    @Param('executionId', new ParseUUIDPipe()) _executionId: string,
    @Req() req: RequestWithInteraction,
  ): Promise<ExecutionStatusDto> {
    const ctx = req.interaction;
    if (!ctx) throw new Error('interaction context missing');
    return this.interactionService.getStatus(ctx);
  }
}
