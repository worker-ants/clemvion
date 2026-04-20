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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedWrappedResponse,
  ApiOkWrappedArrayResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { FoldersService } from './folders.service';
import { WorkspaceId } from '../../common/decorators';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { FolderDto } from './dto/responses/folder-response.dto';
import { Folder } from './entities/folder.entity';

@ApiTags('Folders')
@ApiBearerAuth('access-token')
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  @ApiOperation({
    summary: '폴더 목록 조회',
    description:
      '현재 워크스페이스의 모든 폴더를 sortOrder→name 순으로 반환합니다. 계층 구조는 parentId로 구성됩니다.',
  })
  @ApiOkWrappedArrayResponse(FolderDto, { description: '폴더 목록' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(@WorkspaceId() workspaceId: string) {
    return this.foldersService.findAll(workspaceId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '폴더 단건 조회',
    description: '현재 워크스페이스에 속한 폴더의 상세 정보를 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '폴더 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(FolderDto, { description: '폴더 상세' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 폴더를 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.foldersService.findById(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '폴더 생성',
    description:
      '새 폴더를 생성합니다. parentId를 지정하면 해당 폴더의 하위로 생성되며, 최대 중첩 깊이는 5입니다.',
  })
  @ApiCreatedWrappedResponse(FolderDto, { description: '생성된 폴더' })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 중첩 깊이 초과',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiConflictResponse({ description: '동일 부모 아래 이름 중복' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.foldersService.create(workspaceId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '폴더 수정',
    description: '폴더의 이름·부모·정렬 순서를 부분 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '폴더 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(FolderDto, { description: '수정된 폴더' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 폴더를 찾을 수 없음' })
  @ApiConflictResponse({ description: '동일 부모 아래 이름 중복' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.update(id, workspaceId, dto as Partial<Folder>);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '폴더 삭제',
    description:
      '폴더를 삭제합니다. 하위 폴더는 DB cascade로 함께 제거됩니다. 폴더에 포함된 워크플로우는 루트로 이동됩니다.',
  })
  @ApiParam({ name: 'id', description: '폴더 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 폴더를 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.foldersService.remove(id, workspaceId);
  }
}
