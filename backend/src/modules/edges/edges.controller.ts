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
import { EdgesService } from './edges.service';
import { CreateEdgeDto } from './dto/create-edge.dto';

@Controller()
export class EdgesController {
  constructor(private readonly edgesService: EdgesService) {}

  @Get('workflows/:workflowId/edges')
  async findByWorkflow(@Param('workflowId', ParseUUIDPipe) workflowId: string) {
    return this.edgesService.findByWorkflow(workflowId);
  }

  @Post('workflows/:workflowId/edges')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Body() dto: CreateEdgeDto,
  ) {
    return this.edgesService.create(workflowId, dto);
  }

  @Delete('edges/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.edgesService.remove(id);
  }
}
