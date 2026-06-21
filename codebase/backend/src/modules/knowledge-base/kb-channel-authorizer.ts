import { Injectable } from '@nestjs/common';
import { isValidUuid } from '../../common/utils/uuid';
import {
  ChannelAuthorizer,
  ChannelAuthorizerContext,
} from '../websocket/channel-authorizer';
import { KnowledgeBaseService } from './knowledge-base.service';

/**
 * refactor 02 M-7 — `kb:<documentId>` 구독 인가 (옛 gateway 인라인 authorizer 이전).
 * `verifyDocumentOwnership` 가 미소유/부재 시 throw → boolean 평탄화.
 *
 * `documentId` 는 UUID(`Document.id` = `@PrimaryGeneratedColumn('uuid')`)다. 비-UUID 는
 * `verifyDocumentOwnership` 의 raw SQL(`d.id = $1`)에서 Postgres uuid 캐스팅 오류로 어차피
 * 거부되지만, 다른 authorizer(execution/workflow/background:run)와 동일하게 DB 조회 전
 * `isValidUuid` 로 선차단해 비-UUID 선차단 정책을 일관 적용한다(동작 보존 — 비-UUID 는 양쪽 다 거부).
 */
@Injectable()
export class KbChannelAuthorizer implements ChannelAuthorizer {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  matches(channel: string): boolean {
    return channel.startsWith('kb:');
  }

  async authorize(
    channel: string,
    { workspaceId }: ChannelAuthorizerContext,
  ): Promise<{ error: string } | null> {
    const documentId = channel.slice('kb:'.length);
    if (!isValidUuid(documentId)) {
      return { error: 'Not authorized for this document' };
    }
    const allowed = await this.knowledgeBaseService
      .verifyDocumentOwnership(documentId, workspaceId)
      .catch(() => false);
    return allowed ? null : { error: 'Not authorized for this document' };
  }
}
