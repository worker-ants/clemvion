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
    // parentId 변경(재부모화) 시 계층 무결성을 재검증한다 — create() 는 이미 깊이를
    // 검사하나 update() 는 종전 무검증이라 깊이 초과·cycle·타 workspace parent 가
    // 통과했다 (V-04, cycle 은 getDepth 무한루프 유발).
    if (data.parentId !== undefined && data.parentId !== folder.parentId) {
      await this.validateParentChange(id, workspaceId, data.parentId ?? null);
    }
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
    // 방문 집합 + 상한 가드 — 손상된 데이터(parent 체인 cycle)에서도 무한루프를
    // 방지한다 (V-04). 정상 트리는 상한에 닿지 않는다.
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId) || depth > MAX_NESTING_DEPTH + 1) break;
      visited.add(currentId);
      depth++;
      const folder = await this.folderRepository.findOne({
        where: { id: currentId, workspaceId },
      });
      currentId = folder?.parentId ?? null;
    }

    return depth;
  }

  /**
   * parentId 변경(재부모화)의 계층 무결성을 검증한다 (V-04). 위반은 모두
   * `VALIDATION_ERROR` — create() 깊이 검사와 일관하며, 신규 cycle 코드를 도입하지
   * 않아 `CONTAINER_CYCLE`(노드)·`CYCLE_DETECTED`(그래프)와의 혼동을 피한다.
   */
  private async validateParentChange(
    id: string,
    workspaceId: string,
    newParentId: string | null,
  ): Promise<void> {
    if (newParentId === null) return; // 루트로 이동 — 깊이 감소, 항상 안전
    if (newParentId === id) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A folder cannot be its own parent',
      });
    }
    const parent = await this.folderRepository.findOne({
      where: { id: newParentId, workspaceId },
    });
    if (!parent) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Parent folder not found in this workspace',
      });
    }
    // 서브트리 수집: 새 부모가 자기 자손이면 cycle. 동시에 서브트리 높이 확보.
    const { ids: descendants, height } = await this.collectSubtree(
      id,
      workspaceId,
    );
    if (descendants.has(newParentId)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A folder cannot be moved under its own descendant',
      });
    }
    const parentDepth = await this.getDepth(newParentId, workspaceId);
    if (parentDepth + height > MAX_NESTING_DEPTH) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Maximum folder nesting depth is ${MAX_NESTING_DEPTH}`,
      });
    }
  }

  /**
   * `rootId` 서브트리의 자손 id 집합과 높이(rootId 레벨 = 1)를 BFS 로 수집한다.
   * 방문 가드 + 높이 상한으로 손상 데이터(cycle)에서도 종료를 보장한다.
   */
  private async collectSubtree(
    rootId: string,
    workspaceId: string,
  ): Promise<{ ids: Set<string>; height: number }> {
    const ids = new Set<string>();
    let frontier: string[] = [rootId];
    let height = 0;

    while (frontier.length > 0 && height <= MAX_NESTING_DEPTH) {
      height++;
      const children = await this.folderRepository.find({
        where: frontier.map((pid) => ({ parentId: pid, workspaceId })),
      });
      const next: string[] = [];
      for (const child of children) {
        if (child.id !== rootId && !ids.has(child.id)) {
          ids.add(child.id);
          next.push(child.id);
        }
      }
      frontier = next;
    }

    return { ids, height };
  }
}
