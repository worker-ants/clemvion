import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Secret store row — `[IV(12B) ‖ AES-256-GCM ciphertext ‖ authTag(16B)]` 형식의 ciphertext 만 보관.
 * Plaintext / 마스터키는 application 메모리 안에서만 존재 (`SecretResolverService` 가 암복호화).
 *
 * SoT: `spec/conventions/secret-store.md` §3, `spec/1-data-model.md §2.21.1`.
 */
@Entity('secret_store')
export class SecretStore {
  /** `secret://<scope>/<resourceId>/<name>` URI (`spec/conventions/secret-store.md §1`). */
  @PrimaryColumn({ type: 'text' })
  ref: string;

  /** Workspace 단위 격리. application-level cascade (FK 없음 — Rationale R4). */
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /** `[IV(12B) ‖ ciphertext ‖ authTag(16B)]` raw concat. AAD = `ref`. */
  @Column({ type: 'bytea' })
  encrypted: Buffer;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
