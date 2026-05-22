import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecretStore } from './entities/secret-store.entity';
import { isSecretRef } from './secret-ref';
import { decryptSecret, encryptSecret, parseMasterKey } from './secret-crypto';

/**
 * Secret store 의 단일 진입점.
 *
 * SoT: `spec/conventions/secret-store.md §2 SecretResolver 인터페이스`.
 *
 * 모든 도메인 모듈 (triggers / chat-channel / external-interaction / 향후 cafe24·OAuth) 은 본 service
 * 를 경유해 자격증명을 읽고 쓴다 — config JSONB / 로그 / metric 에 plaintext 노출 금지.
 *
 * 마스터키 (`ENCRYPTION_KEY`) 는 onModuleInit 단계에서 1회 parse — fail-fast.
 */
@Injectable()
export class SecretResolverService implements OnModuleInit {
  private readonly logger = new Logger(SecretResolverService.name);
  private masterKey: Buffer | null = null;

  constructor(
    @InjectRepository(SecretStore)
    private readonly repository: Repository<SecretStore>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const raw =
      this.config.get<string>('llm.encryptionKey') ??
      process.env.ENCRYPTION_KEY ??
      '';
    this.masterKey = parseMasterKey(raw);
    this.logger.log(
      'SecretResolverService initialized — ENCRYPTION_KEY validated (32 byte).',
    );
  }

  /** 부팅 후 호출 — masterKey 가 null 이면 모듈 init 이 fail-fast 했어야 함. */
  private getKey(): Buffer {
    if (!this.masterKey) {
      throw new Error(
        'SecretResolverService: masterKey 미초기화 — onModuleInit 가 실행되지 않았거나 fail 했습니다.',
      );
    }
    return this.masterKey;
  }

  private assertRefFormat(ref: string): void {
    if (!isSecretRef(ref)) {
      // SS-SE-05: plaintext 를 에러 메시지·로그에 포함 금지.
      // ref 길이와 앞 8자(prefix) 만 포함 — 실제 값 미노출.
      throw new Error(
        `SecretResolverService: invalid ref format — spec/conventions/secret-store.md §1 형식 위반 (input length=${ref.length}, starts_with=${JSON.stringify(ref.slice(0, 8))}).`,
      );
    }
  }

  /** ref → plaintext. 미존재 시 NotFoundException. */
  async resolve(ref: string): Promise<string> {
    this.assertRefFormat(ref);
    const row = await this.repository.findOne({ where: { ref } });
    if (!row) {
      throw new NotFoundException(`Secret not found: ${ref}`);
    }
    try {
      return decryptSecret(this.getKey(), ref, row.encrypted);
    } catch (err) {
      // SS-SE-05: plaintext 미기록, ref + workspaceId 만.
      this.logger.error(
        `SecretResolver.resolve 복호화 실패 (ref=${ref}, workspace=${row.workspaceId}): ${err instanceof Error ? err.message : String(err)}`,
      );
      // 원본 crypto 에러 상세(예: "Unsupported state or unable to authenticate data")를
      // 호출 스택에 노출하지 않도록 추상화된 에러로 교체.
      throw new Error('Secret decryption failed');
    }
  }

  /** plaintext 를 새 row 로 저장. 이미 존재하는 ref 면 throw. */
  async store(
    ref: string,
    workspaceId: string,
    plaintext: string,
  ): Promise<void> {
    this.assertRefFormat(ref);
    const existing = await this.repository.findOne({ where: { ref } });
    if (existing) {
      throw new Error(
        `SecretResolverService.store: ref 이미 존재 (${ref}) — rotate() 를 사용하세요.`,
      );
    }
    const encrypted = encryptSecret(this.getKey(), ref, plaintext);
    await this.repository.insert({ ref, workspaceId, encrypted });
  }

  /** plaintext 를 newPlaintext 로 교체 (UPSERT). */
  async rotate(
    ref: string,
    workspaceId: string,
    newPlaintext: string,
  ): Promise<void> {
    this.assertRefFormat(ref);
    const encrypted = encryptSecret(this.getKey(), ref, newPlaintext);
    const existing = await this.repository.findOne({ where: { ref } });
    if (existing) {
      await this.repository.update(
        { ref },
        { encrypted, workspaceId, updatedAt: new Date() },
      );
    } else {
      await this.repository.insert({ ref, workspaceId, encrypted });
    }
  }

  /** 미존재 ref 는 noop. */
  async delete(ref: string): Promise<void> {
    this.assertRefFormat(ref);
    await this.repository.delete({ ref });
  }

  /** validation 용. */
  async exists(ref: string): Promise<boolean> {
    if (!isSecretRef(ref)) return false;
    const count = await this.repository.count({ where: { ref } });
    return count > 0;
  }

  /**
   * Workspace 단위 cleanup — workspace 삭제 / trigger 일괄 삭제 시 호출.
   * `scope` + `resourceId` prefix 로 한정해 부분 삭제 가능.
   *
   * 예: `deleteByPrefix('secret://triggers/{id}/')` — 해당 trigger 의 모든 secret.
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    if (!prefix.startsWith('secret://')) {
      throw new Error(
        `deleteByPrefix: prefix 는 'secret://' 로 시작해야 합니다 (받음: "${prefix}").`,
      );
    }
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('ref LIKE :prefix', { prefix: `${prefix}%` })
      .execute();
    return result.affected ?? 0;
  }
}
