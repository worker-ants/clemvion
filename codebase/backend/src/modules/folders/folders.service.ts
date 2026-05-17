import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Folder } from './entities/folder.entity';

const MAX_NESTING_DEPTH = 5;

@Injectable()
export class FoldersService {
  constructor(
    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
  ) {}

  async findAll(workspaceId: string): Promise<Folder[]> {
    return this.folderRepository.find({
      where: { workspaceId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findById(id: string, workspaceId: string): Promise<Folder> {
    const folder = await this.folderRepository.findOne({
      where: { id, workspaceId },
    });
    if (!folder) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Folder not found',
      });
    }
    return folder;
  }

  async create(
    workspaceId: string,
    data: { name: string; parentId?: string; sortOrder?: number },
  ): Promise<Folder> {
    if (data.parentId) {
      const depth = await this.getDepth(data.parentId, workspaceId);
      if (depth >= MAX_NESTING_DEPTH) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Maximum folder nesting depth is ${MAX_NESTING_DEPTH}`,
        });
      }
    }

    const folder = this.folderRepository.create({
      ...data,
      workspaceId,
    });
    return this.folderRepository.save(folder);
  }

  async update(
    id: string,
    workspaceId: string,
    data: Partial<Folder>,
  ): Promise<Folder> {
    const folder = await this.findById(id, workspaceId);
    Object.assign(folder, data);
    return this.folderRepository.save(folder);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const folder = await this.findById(id, workspaceId);
    await this.folderRepository.remove(folder);
  }

  private async getDepth(
    folderId: string,
    workspaceId: string,
  ): Promise<number> {
    let depth = 0;
    let currentId: string | null = folderId;

    while (currentId) {
      depth++;
      const folder = await this.folderRepository.findOne({
        where: { id: currentId, workspaceId },
      });
      currentId = folder?.parentId ?? null;
    }

    return depth;
  }
}
