import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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
}
