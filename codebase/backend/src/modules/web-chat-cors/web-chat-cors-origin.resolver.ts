import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Execution } from '../executions/entities/execution.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';

/**
 * execution id → 워크스페이스 `interactionAllowedOrigins` 해석 (CORS delegate 용).
 * execution → workflow → workspace.settings.interactionAllowedOrigins. 짧은 TTL 캐시.
 * SoT: spec/7-channel-web-chat/4-security §2, spec/5-system/14 §8.5.
 */
@Injectable()
export class WebChatCorsOriginResolver {
  private readonly cache = new Map<
    string,
    { allowlist: string[]; exp: number }
  >();
  private readonly ttlMs = 60_000;
  private readonly maxEntries = 10_000;

  constructor(
    @InjectRepository(Execution)
    private readonly executions: Repository<Execution>,
    private readonly workspaces: WorkspacesService,
  ) {}

  async resolveAllowlist(executionId: string): Promise<string[]> {
    const now = Date.now();
    const cached = this.cache.get(executionId);
    if (cached && cached.exp > now) return cached.allowlist;

    const allowlist = await this.load(executionId);
    if (this.cache.size >= this.maxEntries) this.cache.clear();
    this.cache.set(executionId, { allowlist, exp: now + this.ttlMs });
    return allowlist;
  }

  private async load(executionId: string): Promise<string[]> {
    const execution = await this.executions.findOne({
      where: { id: executionId },
      relations: { workflow: true },
    });
    const workspaceId = execution?.workflow?.workspaceId;
    if (!workspaceId) return [];

    const workspace = await this.workspaces.findById(workspaceId);
    const origins = workspace?.settings?.interactionAllowedOrigins;
    return Array.isArray(origins)
      ? origins.filter((o): o is string => typeof o === 'string')
      : [];
  }
}
