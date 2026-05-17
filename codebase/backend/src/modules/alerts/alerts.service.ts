import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule } from './entities/alert-rule.entity';
import { CreateAlertRuleDto, UpdateAlertRuleDto } from './dto/alert-rule.dto';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(AlertRule)
    private readonly repository: Repository<AlertRule>,
  ) {}

  list(workspaceId: string): Promise<AlertRule[]> {
    return this.repository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateAlertRuleDto,
  ): Promise<AlertRule> {
    const entity = this.repository.create({
      workspaceId,
      createdBy: userId,
      type: dto.type,
      threshold: String(dto.threshold),
      window: dto.window ?? 'PT1H',
      channel: dto.channel ?? 'in_app',
      workflowId: dto.workflowId ?? null,
      enabled: dto.enabled ?? true,
    });
    return this.repository.save(entity);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateAlertRuleDto,
  ): Promise<AlertRule> {
    const entity = await this.repository.findOne({
      where: { id, workspaceId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'ALERT_RULE_NOT_FOUND',
        message: '알림 규칙을 찾을 수 없습니다.',
      });
    }
    if (dto.threshold !== undefined) entity.threshold = String(dto.threshold);
    if (dto.window !== undefined) entity.window = dto.window;
    if (dto.channel !== undefined) entity.channel = dto.channel;
    if (dto.enabled !== undefined) entity.enabled = dto.enabled;
    return this.repository.save(entity);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const entity = await this.repository.findOne({
      where: { id, workspaceId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'ALERT_RULE_NOT_FOUND',
        message: '알림 규칙을 찾을 수 없습니다.',
      });
    }
    await this.repository.remove(entity);
  }
}
