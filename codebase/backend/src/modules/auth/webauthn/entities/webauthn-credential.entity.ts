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

  /**
   * WebAuthn transport hints (usb / nfc / ble / internal / hybrid).
   * 표준 값 외 문자열도 클라이언트가 보낸 그대로 저장한다(WebAuthn 명세상 RP 는 모르는 값도 허용).
   * 문자열 배열이 아니거나 NUL 문자가 든 항목이 있으면 등록 검증이 400 으로 거부한다(`parseTransports`).
   */
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

  /**
   * 사용자가 부여한 표시 이름. `varchar(100)` 은 길이를 코드 포인트로 세고 NUL 문자를 저장하지 못한다.
   * 그런 값은 요청 DTO 가 400 으로 거부한다(`webauthn.dto.ts`).
   */
  @Column({ name: 'device_name', type: 'varchar', length: 100, nullable: true })
  deviceName: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
