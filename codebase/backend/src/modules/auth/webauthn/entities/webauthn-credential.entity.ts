import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * WebAuthn (Passkey · 보안 키 등) 인증기.
 * spec/1-data-model.md §2.21 WebAuthnCredential / spec/5-system/1-auth.md §1.4.
 *
 * counter 역행 감지 시 row 즉시 삭제 (suspend 컬럼 도입 금지 — Rationale 1.4.E).
 */
@Entity('webauthn_credential')
export class WebAuthnCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_webauthn_credential_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** WebAuthn 표준 credential ID (base64url 인코딩). UNIQUE. */
  @Column({ name: 'credential_id', type: 'text', unique: true })
  credentialId: string;

  /** CBOR-COSE 직렬화 공개 키. */
  @Column({ name: 'public_key', type: 'bytea' })
  publicKey: Buffer;

  /** replay 방어용 sign counter — 매 인증 후 갱신. */
  @Column({ name: 'counter', type: 'bigint', default: 0 })
  counter: string; // bigint comes through pg driver as string by default

  /** WebAuthn transport hints (usb / nfc / ble / internal / hybrid). */
  @Column({
    name: 'transports',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  transports: string[];

  /** 인증기 모델 식별자 (선택). */
  @Column({ name: 'aaguid', type: 'uuid', nullable: true })
  aaguid: string | null;

  /** 사용자가 부여한 표시 이름 (최대 100자). */
  @Column({ name: 'device_name', type: 'varchar', length: 100, nullable: true })
  deviceName: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
