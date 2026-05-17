import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import Express from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/guards/roles.guard';
import { WorkspaceId } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { WorkflowAssistantSessionService } from './workflow-assistant-session.service';
import { WorkflowAssistantStreamService } from './workflow-assistant-stream.service';
import { CreateAssistantSessionDto } from './dto/create-assistant-session.dto';
import { UpdateAssistantSessionDto } from './dto/update-assistant-session.dto';
import { AssistantMessageRequestDto } from './dto/assistant-message-request.dto';

@ApiTags('Workflow AI Assistant')
@ApiBearerAuth('access-token')
@Controller('workflow-assistant')
export class WorkflowAssistantController {
  private readonly logger = new Logger(WorkflowAssistantController.name);

  constructor(
    private readonly sessionService: WorkflowAssistantSessionService,
    private readonly streamService: WorkflowAssistantStreamService,
  ) {}

  @Get('sessions')
  @ApiOperation({
    summary: '워크플로우별 Assistant 세션 목록',
    description:
      '지정한 워크플로우에 속한 내 세션을 최근 상호작용 순으로 최대 50건 반환한다.',
  })
  @ApiQuery({ name: 'workflowId', required: true, format: 'uuid' })
  async list(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
    @Query('workflowId', ParseUUIDPipe) workflowId: string,
  ) {
    return this.sessionService.listForWorkflow(workspaceId, userId, workflowId);
  }

  // NOTE: `sessions/latest` must be declared BEFORE `sessions/:id` — Nest
  // matches routes in declaration order and ParseUUIDPipe on `:id` would
  // otherwise reject the literal "latest" with a 400.
  @Get('sessions/latest')
  @ApiOperation({
    summary: '최근 활성 세션 조회',
    description:
      '워크플로우 편집기 진입 시 기본 선택할 세션을 조회한다. 없으면 null 반환.',
  })
  @ApiQuery({ name: 'workflowId', required: true, format: 'uuid' })
  async latest(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
    @Query('workflowId', ParseUUIDPipe) workflowId: string,
  ) {
    const session = await this.sessionService.findLatestActive(
      workspaceId,
      userId,
      workflowId,
    );
    return session;
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: '세션 상세(메시지 포함) 조회' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessionService.findDetail(id, workspaceId, userId);
  }

  @Post('sessions')
  @Roles('editor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '세션 생성' })
  async create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateAssistantSessionDto,
  ) {
    return this.sessionService.create(workspaceId, userId, dto);
  }

  @Patch('sessions/:id')
  @Roles('editor')
  @ApiOperation({ summary: '세션 제목/모델/상태 업데이트' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async update(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssistantSessionDto,
  ) {
    return this.sessionService.update(id, workspaceId, userId, dto);
  }

  @Delete('sessions/:id')
  @Roles('editor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '세션 삭제 (cascade로 메시지 삭제)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async remove(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.sessionService.remove(id, workspaceId, userId);
  }

  @Post('sessions/:id/messages')
  @Roles('editor')
  @ApiOperation({
    summary: '사용자 메시지 전송 + Assistant 응답 스트림 (SSE)',
    description:
      'text/event-stream 응답. 이벤트: text, tool_call, plan, usage, done, error.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: AssistantMessageRequestDto })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'SSE stream. Parse with an EventSource-style client.',
  })
  async sendMessage(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssistantMessageRequestDto,
    @Req() req: Express.Request,
    @Res() res: Response,
  ): Promise<void> {
    // 세션 소유권 검증을 SSE 헤더 송출 **이전**에 수행해, 인증/권한/404
    // 실패는 일반 HTTP 4xx로 돌려준다. 이렇게 해야 모니터링·로그 분석에서
    // 스트림 내부 오류와 설정 오류가 구분된다. 여기서 던지는 NestJS 예외는
    // 글로벌 필터가 그대로 4xx로 매핑한다.
    await this.sessionService.findOneForUser(id, workspaceId, user.sub);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx 버퍼링 방지
    res.flushHeaders();

    const abort = new AbortController();
    const onClose = () => abort.abort();
    req.once('close', onClose);

    // SSE keepalive ping — nginx/ELB idle timeout 예방
    const keepalive = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n');
    }, 15_000);

    try {
      for await (const ev of this.streamService.streamMessage(
        id,
        workspaceId,
        user.sub,
        dto,
        abort.signal,
      )) {
        const payload = JSON.stringify(ev.data);
        res.write(`event: ${ev.event}\n`);
        res.write(`data: ${payload}\n\n`);
      }
    } catch (error) {
      // 상세 에러는 서버 로그에만 남기고, 클라이언트에는 코드만 노출한다.
      // 원본 메시지가 SQL·LLM 응답·스택 조각 등을 포함할 수 있기 때문.
      this.logger.error(
        `Assistant stream failed for session ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      if (!res.writableEnded) {
        res.write(`event: error\n`);
        res.write(
          `data: ${JSON.stringify({
            code: 'ASSISTANT_STREAM_FAILED',
            message: 'Assistant failed to respond. Please retry.',
          })}\n\n`,
        );
      }
    } finally {
      clearInterval(keepalive);
      req.off('close', onClose);
      if (!res.writableEnded) res.end();
    }
  }
}
