import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';

@Entity('notification')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 50 })
  type: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'resource_type', length: 50, nullable: true })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId: string;

  // Background 본문 실패(background_failed) 알림의 per-run attribution 키.
  // 딥링크(resource_type/resource_id=workflow)와 분리된 내부 전용 컬럼.
  // `select: false` — 목록/카운트 등 엔티티 기본 SELECT 에서 배제해 REST 응답에
  // 노출되지 않도록 강제한다 (ClassSerializer 계층 부재 대비 방어). attribution
  // 조회(findByBackgroundRun)는 WHERE 절만 쓰므로 미노출과 무관하게 동작한다
  // (spec/data-flow/8-notifications.md §2.1, migration V107).
  @Column({
    name: 'background_run_id',
    type: 'uuid',
    nullable: true,
    select: false,
  })
  backgroundRunId: string | null;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ length: 20, default: 'in_app' })
  channel: string;

  @Column({ name: 'email_sent_at', type: 'timestamptz', nullable: true })
  emailSentAt: Date;

  // soft delete — NULL=visible, 채워짐=사용자가 닫은 시각.
  // 목록·미읽음 카운트는 dismissed_at IS NULL 만 본다 (spec/data-flow/8-notifications.md §4).
  @Column({ name: 'dismissed_at', type: 'timestamptz', nullable: true })
  dismissedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
