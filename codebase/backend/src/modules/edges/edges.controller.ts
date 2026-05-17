import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedWrappedResponse,
  ApiOkWrappedArrayResponse,
} from '../../common/swagger';
import { EdgesService } from './edges.service';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { EdgeDto } from './dto/responses/edge-response.dto';

@ApiTags('Edges')
@ApiBearerAuth('access-token')
@Controller()
export class EdgesController {
  constructor(private readonly edgesService: EdgesService) {}

  @Get('workflows/:workflowId/edges')
  @ApiOperation({
    summary: '워크플로우 엣지 목록 조회',
    description: '지정한 워크플로우에 포함된 모든 엣지(연결선)를 반환합니다.',
  })
  @ApiParam({
    name: 'workflowId',
    description: '워크플로우 UUID',
    format: 'uuid',
  })
  @ApiOkWrappedArrayResponse(EdgeDto, { description: '엣지 목록' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findByWorkflow(@Param('workflowId', ParseUUIDPipe) workflowId: string) {
    return this.edgesService.findByWorkflow(workflowId);
  }

  @Post('workflows/:workflowId/edges')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '엣지 생성',
    description:
      '두 노드를 연결하는 엣지를 생성합니다. source와 target이 동일한 self-loop는 허용되지 않습니다.',
  })
  @ApiParam({
    name: 'workflowId',
    description: '워크플로우 UUID',
    format: 'uuid',
  })
  @ApiCreatedWrappedResponse(EdgeDto, { description: '생성된 엣지' })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 self-loop 시도',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async create(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Body() dto: CreateEdgeDto,
  ) {
    return this.edgesService.create(workflowId, dto);
  }

  @Delete('edges/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '엣지 삭제',
    description: '지정한 엣지를 삭제합니다.',
  })
  @ApiParam({ name: 'id', description: '엣지 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 엣지를 찾을 수 없음' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.edgesService.remove(id);
  }
}
