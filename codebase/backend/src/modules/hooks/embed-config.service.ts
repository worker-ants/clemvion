import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';

/** 임베드 allowlist 해석 결과. allowlist 비어 있으면 제한 없음(allow-all). */
export interface EmbedAllowlist {
  allowlist: string[];
  enforce: boolean;
}

/**
 * 공개 위젯 임베드 soft 검증 설정 해석 — webhook endpointPath → 워크스페이스 `interactionAllowedOrigins`.
 *
 * spec [7-channel-web-chat/4-security.md §3-①]. allowlist 는 CORS(§2)와 **동일 키**
 * (`Workspace.settings.interactionAllowedOrigins`, 단일 진실)를 재사용한다. 미설정(빈 배열)이면
 * 제한 없음(allow-all) — 임베드 제어는 opt-in 이다.
 */
/** `Workspace.settings` 내 임베드 허용 origin 목록 키 (I18 타입 오타 방지). */
const INTERACTION_ALLOWED_ORIGINS_KEY = 'interactionAllowedOrigins' as const;

@Injectable()
export class EmbedConfigService {
  private readonly logger = new Logger(EmbedConfigService.name);

  constructor(
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  /**
   * endpointPath 로 **공개(authConfigId IS NULL)** webhook trigger → 워크스페이스 allowlist 를 해석.
   * 인증 webhook(authConfigId NOT NULL)은 공개 위젯 embed 대상이 아니므로 allow-all(빈 allowlist)을 반환 —
   * 인증 webhook의 워크스페이스 설정이 공개 엔드포인트로 노출되지 않도록 필터링한다(W4).
   * trigger 미존재 시 빈 allowlist(allow-all) — 존재 여부 노출 회피 + 위젯 fail-open.
   * 조회 오류도 동일하게 allow-all(렌더 차단으로 위젯을 깨지 않음).
   */
  async resolve(endpointPath: string): Promise<EmbedAllowlist> {
    try {
      const trigger = await this.triggerRepository.findOne({
        where: { endpointPath, type: 'webhook', authConfigId: IsNull() },
        select: { workspaceId: true },
      });
      if (!trigger) return { allowlist: [], enforce: false };

      const workspace = await this.workspaceRepository.findOne({
        where: { id: trigger.workspaceId },
        select: { settings: true },
      });
      const origins = workspace?.settings?.[INTERACTION_ALLOWED_ORIGINS_KEY];
      const allowlist = Array.isArray(origins)
        ? origins.filter((o): o is string => typeof o === 'string')
        : [];
      return { allowlist, enforce: allowlist.length > 0 };
    } catch (err) {
      this.logger.warn(
        `EmbedConfigService.resolve 실패 — allow-all 로 degrade: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { allowlist: [], enforce: false };
    }
  }
}
