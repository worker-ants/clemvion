import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type LoginHistoryEvent =
  | 'login_success'
  | 'login_failed'
  | 'totp_failed'
  | 'webauthn_failed'
  | 'logout'
  | 'session_revoked'
  | 'token_reuse_detected';

@Entity('login_history')
@Index('idx_login_history_user_created', ['userId', 'createdAt'])
@Index('idx_login_history_email_created', ['email', 'createdAt'])
export class LoginHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 32 })
  event: LoginHistoryEvent;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'device_label', type: 'text', nullable: true })
  deviceLabel: string | null;

  @Column({ name: 'family_id', type: 'uuid', nullable: true })
  familyId: string | null;

  @Column({
    name: 'failure_reason',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  failureReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
