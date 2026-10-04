import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WorkflowAssistantSession } from './entities/workflow-assistant-session.entity';
import { WorkflowAssistantMessage } from './entities/workflow-assistant-message.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { CreateAssistantSessionDto } from './dto/create-assistant-session.dto';
import { UpdateAssistantSessionDto } from './dto/update-assistant-session.dto';
import { LlmService } from '../llm/llm.service';

/**
 * Workflow AI Assistant 세션/메시지 영속화 담당.
 *
 * - 세션은 `workflow_id` × `user_id` 단위로 생성됨. 동일 사용자의 동일 워크플로우에
 *   여러 세션이 있을 수 있으며, 기본 UI는 가장 최근 `active` 세션 1개를 자동 선택.
 * - 메시지 삽입은 세션의 `message_count`·`last_interaction_at`·`updated_at`을 갱신.
 */
@Injectable()
export class WorkflowAssistantSessionService {
  constructor(
    @InjectRepository(WorkflowAssistantSession)
    private readonly sessionRepo: Repository<WorkflowAssistantSession>,
    @InjectRepository(WorkflowAssistantMessage)
    private readonly messageRepo: Repository<WorkflowAssistantMessage>,
    @InjectRepository(Workflow)
    private readonly workflowRepo: Repository<Workflow>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly llmService: LlmService,
  ) {}

  async listForWorkflow(
    workspaceId: string,
    userId: string,
    workflowId: string,
  ): Promise<WorkflowAssistantSession[]> {
    await this.ensureWorkflowBelongsToWorkspace(workflowId, workspaceId);
    return this.sessionRepo.find({
      where: { workspaceId, userId, workflowId },
      order: { lastInteractionAt: 'DESC' },
      take: 50,
    });
  }

  async findLatestActive(
    workspaceId: string,
    userId: string,
    workflowId: string,
  ): Promise<WorkflowAssistantSession | null> {
    return this.sessionRepo.findOne({
      where: {
        workspaceId,
        userId,
        workflowId,
        status: 'active',
      },
      order: { lastInteractionAt: 'DESC' },
    });
  }

  async findDetail(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<{
    session: WorkflowAssistantSession;
    messages: WorkflowAssistantMessage[];
  }> {
    const session = await this.findOneForUser(id, workspaceId, userId);
    const messages = await this.messageRepo.find({
      where: { sessionId: id },
      order: { createdAt: 'ASC' },
    });
    return { session, messages };
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateAssistantSessionDto,
  ): Promise<WorkflowAssistantSession> {
    await this.ensureWorkflowBelongsToWorkspace(dto.workflowId, workspaceId);
    await this.assertLlmConfigInWorkspace(dto.llmConfigId, workspaceId);
    const now = new Date();
    const session = this.sessionRepo.create({
      workspaceId,
      userId,
      workflowId: dto.workflowId,
      title: dto.title ?? null,
      llmConfigId: dto.llmConfigId ?? null,
      status: 'active',
      messageCount: 0,
      lastInteractionAt: now,
    });
    return this.sessionRepo.save(session);
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    dto: UpdateAssistantSessionDto,
  ): Promise<WorkflowAssistantSession> {
    const session = await this.findOneForUser(id, workspaceId, userId);
    await this.assertLlmConfigInWorkspace(dto.llmConfigId, workspaceId);
    if (dto.title !== undefined) session.title = dto.title;
    if (dto.llmConfigId !== undefined) session.llmConfigId = dto.llmConfigId;
    if (dto.status !== undefined) session.status = dto.status;
    return this.sessionRepo.save(session);
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const session = await this.findOneForUser(id, workspaceId, userId);
    await this.sessionRepo.remove(session);
  }

  async findOneForUser(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<WorkflowAssistantSession> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) {
      throw new NotFoundException({
        code: 'ASSISTANT_SESSION_NOT_FOUND',
        message: 'Assistant session not found.',
      });
    }
    if (session.workspaceId !== workspaceId) {
      throw new NotFoundException({
        code: 'ASSISTANT_SESSION_NOT_FOUND',
        message: 'Assistant session not found.',
      });
    }
    if (session.userId !== userId) {
      throw new ForbiddenException({
        code: 'ASSISTANT_SESSION_NOT_YOURS',
        message: "You cannot access another user's Assistant session.",
      });
    }
    return session;
  }

  /**
   * 메시지 생성 + 세션 비정규화 필드(message_count, last_interaction_at)를 **단일
   * 트랜잭션**으로 갱신한다. 세션 UPDATE는 `message_count = message_count + 1`
   * 단일 쿼리로 통합되어 라운드트립 1회로 수행된다.
   */
  async appendMessage(
    sessionId: string,
    data: Partial<WorkflowAssistantMessage>,
  ): Promise<WorkflowAssistantMessage> {
    return this.dataSource.transaction(async (manager) => {
      const msg = manager.create(WorkflowAssistantMessage, {
        sessionId,
        role: data.role ?? 'assistant',
        content: data.content ?? null,
        toolCalls: data.toolCalls ?? null,
        toolCallId: data.toolCallId ?? null,
        plan: data.plan ?? null,
        usage: data.usage ?? null,
        finishReason: data.finishReason ?? null,
      });
      const saved = await manager.save(WorkflowAssistantMessage, msg);
      await manager
        .createQueryBuilder()
        .update(WorkflowAssistantSession)
        .set({
          messageCount: () => 'message_count + 1',
          lastInteractionAt: () => 'NOW()',
          updatedAt: () => 'NOW()',
        })
        .where('id = :id', { id: sessionId })
        .execute();
      return saved;
    });
  }

  async loadMessages(sessionId: string): Promise<WorkflowAssistantMessage[]> {
    return this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  async setTitleIfEmpty(sessionId: string, title: string): Promise<void> {
    await this.sessionRepo
      .createQueryBuilder()
      .update(WorkflowAssistantSession)
      .set({ title })
      .where('id = :id AND title IS NULL', { id: sessionId })
      .execute();
  }

  /**
   * 세션에 고정하는 모델 설정은 같은 워크스페이스의 chat 설정만(spec 1-data-model §1.1). 쓰는 시점(`resolveConfig`)은 이미 워크스페이스로
   * 거르므로 남의 설정을 쓰지는 못했지만 끊긴 참조가 저장됐다 — 같은 검증기를 저장 전에 돌린다(404 `MODEL_CONFIG_NOT_FOUND`).
   * `null`(고정 해제)은 통과.
   */
  private async assertLlmConfigInWorkspace(
    llmConfigId: string | null | undefined,
    workspaceId: string,
  ): Promise<void> {
    if (!llmConfigId) return;
    await this.llmService.resolveConfig(llmConfigId, workspaceId);
  }

  private async ensureWorkflowBelongsToWorkspace(
    workflowId: string,
    workspaceId: string,
  ): Promise<void> {
    const exists = await this.workflowRepo.exists({
      where: { id: workflowId, workspaceId },
    });
    if (!exists) {
      throw new NotFoundException({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow not found in this workspace.',
      });
    }
  }
}
