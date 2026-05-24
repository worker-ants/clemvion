import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { isValidBcryptHash } from '../../../shared/utils/bcrypt-format';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: 'password_hash', nullable: true, length: 255 })
  passwordHash: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'avatar_url', nullable: true, length: 500 })
  avatarUrl: string;

  @Column({ length: 10, default: 'ko' })
  locale: string;

  @Column({ length: 10, default: 'light' })
  theme: string;

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled: boolean;

  @Column({ name: 'two_factor_secret', nullable: true, length: 255 })
  twoFactorSecret: string;

  /**
   * TOTP 복구 코드(SHA-256 해시 배열). 사용 시 해당 항목 제거.
   * `two_factor_enabled = true` 인 사용자에게 활성화 시점에 10개를 일회성으로 발급한다.
   */
  @Column({
    name: 'totp_recovery_codes',
    type: 'text',
    array: true,
    nullable: true,
  })
  totpRecoveryCodes: string[] | null;

  /**
   * WebAuthn 복구 코드(SHA-256 해시 배열). 사용 시 해당 항목 제거.
   * 첫 WebAuthn credential 등록 시점에 10개 발급. 모든 credential 삭제 시
   * `WebAuthnService.deleteCredential` 이 NULL 화 (DB 트리거 아님 — spec/5-system/1-auth.md Rationale 1.4.B).
   */
  @Column({
    name: 'webauthn_recovery_codes',
    type: 'text',
    array: true,
    nullable: true,
  })
  webauthnRecoveryCodes: string[] | null;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'email_verify_token', nullable: true, length: 255 })
  emailVerifyToken: string;

  @Column({
    name: 'email_verify_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerifyExpiresAt: Date;

  @Column({ name: 'password_reset_token', nullable: true, length: 255 })
  passwordResetToken: string;

  @Column({
    name: 'password_reset_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  passwordResetExpiresAt: Date;

  @Column({ name: 'login_attempts', default: 0 })
  loginAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date;

  @Column({ name: 'oauth_provider', nullable: true, length: 50 })
  oauthProvider: string;

  @Column({ name: 'oauth_provider_id', nullable: true, length: 255 })
  oauthProviderId: string;

  @Column({ name: 'notification_preferences', type: 'jsonb', default: {} })
  notificationPreferences: {
    integrationExpiryEmail?: boolean;
  };

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /**
   * `password_hash` 포맷 invariant 강제. spec/5-system/1-auth.md §"비밀번호 저장"
   * 의 "bcrypt only, nullable for OAuth-only" 규약을 entity-level 에서 enforce.
   *
   * null / undefined 는 통과 (OAuth-only 사용자). string 이지만 bcrypt 포맷이
   * 아닌 모든 값은 throw — DB 저장 차단.
   *
   * 본 가드의 목적: application 코드가 항상 `bcrypt.hash(...)` 를 거치는
   * 현재 구조의 invariant 를 미래 회귀 (raw string set, 평문 'x' 같은 e2e
   * fixture 의 production 유출 등) 로부터 보호. ai-review PR #301 security W1
   * 후속.
   *
   * 로그 안전성: 에러 메시지에 실제 hash 값을 포함하지 않는다 (type 과
   * length 만 노출).
   */
  @BeforeInsert()
  @BeforeUpdate()
  validatePasswordHashFormat(): void {
    if (this.passwordHash === null || this.passwordHash === undefined) return;
    if (isValidBcryptHash(this.passwordHash)) return;
    const observedType = typeof this.passwordHash;
    const observedLength =
      typeof this.passwordHash === 'string' ? this.passwordHash.length : 'N/A';
    throw new Error(
      `Invalid password_hash format: must be bcrypt hash (60 chars, $2[aby]$ prefix). ` +
        `Got type=${observedType}, length=${observedLength}. ` +
        `SoT: spec/5-system/1-auth.md §"비밀번호 저장".`,
    );
  }
}
