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
      // `isSecretRef` 가 `value is string` 타입가드라 이 false branch 에서 `ref` 는
      // `never` 로 좁혀진다. `never` 는 bottom type 이라 `string` 에 그대로 대입되므로
      // 캐스트가 필요 없다 — 종전의 `as unknown as string` 은
      // no-unnecessary-type-assertion 이 지목한 대로 불필요했고, 제거해도
      // `nest build` 가 통과한다(2026-08-09 lint 정리에서 실측 확인).
      const refStr: string = ref;
      throw new Error(
        `SecretResolverService: invalid ref format — spec/conventions/secret-store.md §1 형식 위반 (input length=${refStr.length}, starts_with=${JSON.stringify(refStr.slice(0, 8))}).`,
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
      //
      // `preserve-caught-error`(eslint 10 recommended)를 여기서만 끈다 — `cause: err` 를 달면
      // 위 추상화가 무의미해진다. 이 경로의 에러 메시지는 서버 로그에만 남지 않는다:
      // `#814`(SSRF 메시지 일반화)에서 "서버 로그니까 안전" 이 오전제로 반증됐고, 노드 에러는
      // Activity API 로 사용자에게 노출된다. 원본 상세는 바로 위 `logger.error` 로만 남긴다
      // (SS-SE-05: ref + workspaceId, plaintext 미기록).
      // eslint-disable-next-line preserve-caught-error
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
   *
   * ## LIKE 메타문자를 거부하는 이유
   *
   * 아래 쿼리는 prefix 를 `LIKE` 패턴으로 쓴다. TypeORM 파라미터 바인딩이라 **SQL
   * 인젝션은 아니지만**, prefix 에 `%`(임의 문자열)나 `_`(임의 1글자)가 섞이면 의도보다
   * **넓게 지워진다** — 삭제는 되돌릴 수 없어서 방향이 나쁘다.
   *
   * 현재 프로덕션 호출부는 `triggers.service.ts` 한 곳뿐이고 `secret://triggers/{uuid}/`
   * 라 메타문자가 들어갈 수 없다(2026-08-09 전수 확인). 그래서 "지금은 안전하다" 를
   * 주석으로만 적어 둘 수도 있었지만, 그 안전은 **호출부 목록이 그대로일 때만** 참이다.
   * 사용자 입력이 섞인 prefix 를 넘기는 호출부가 하나 생기면 주석은 아무것도 막지 못한다.
   * 위의 `secret://` 접두사 검사와 같은 형태로 **입력 자체를 거부**해 그 조건을 없앤다.
   *
   * 이스케이프(`\\%` + `ESCAPE`)가 아니라 거부인 이유: 이 API 의 prefix 는 내부에서
   * 조립하는 식별자 경로라 메타문자가 **정당하게 필요한 경우가 없다.** 이스케이프는
   * 없는 유스케이스를 위해 표면을 넓히는 쪽이다.
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    if (!prefix.startsWith('secret://')) {
      throw new Error(
        `deleteByPrefix: prefix 는 'secret://' 로 시작해야 합니다 (받음: "${prefix}").`,
      );
    }
    if (/[%_\\]/.test(prefix)) {
      throw new Error(
        `deleteByPrefix: prefix 에 LIKE 메타문자(% _ \\)를 쓸 수 없습니다 — ` +
          `의도보다 넓은 범위가 삭제될 수 있습니다 (받음: "${prefix}").`,
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
