import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NodesService } from './nodes.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';

@Controller()
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get('workflows/:workflowId/nodes')
  async findByWorkflow(@Param('workflowId', ParseUUIDPipe) workflowId: string) {
    return this.nodesService.findByWorkflow(workflowId);
  }

  @Post('workflows/:workflowId/nodes')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Body() dto: CreateNodeDto,
  ) {
    return this.nodesService.create(workflowId, dto);
  }

  @Patch('nodes/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNodeDto,
  ) {
    return this.nodesService.update(id, dto);
  }

  @Delete('nodes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.nodesService.remove(id);
  }
}
