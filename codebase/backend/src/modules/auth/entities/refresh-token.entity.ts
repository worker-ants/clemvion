import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_token')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'token_hash', unique: true, length: 255 })
  tokenHash: string;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /**
   * 로그인 유지(remember me) 여부. 발급 경로(로그인 · 소셜 로그인 · Passkey 로그인 · 초대 가입)가
   * 정하고 회전한 새 토큰이 이어받는다. 수명(30일 / 7일)과 갱신 쿠키 `maxAge` 를 정하는
   * 정본이다(CLE-ACCT-SESSION 「로그인 유지」, REQ-SESSION-047, V156).
   * `auth_oauth_state.remember_me` 는 소셜 로그인 시작 값을 콜백까지 나르는 칸이고 이 칸과 다르다.
   */
  @Column({ name: 'remember_me', type: 'boolean', default: false })
  rememberMe: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'device_label', type: 'text', nullable: true })
  deviceLabel: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'last_used_ip', type: 'varchar', length: 45, nullable: true })
  lastUsedIp: string | null;
}
