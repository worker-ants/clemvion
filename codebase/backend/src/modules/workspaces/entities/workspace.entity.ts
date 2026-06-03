import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('workspace')
// 주의: `@Unique(['ownerId','type'])` 는 두지 않는다 — 의도된 invariant 는 "owner 당
// personal 1개" 뿐인데, (owner_id, type) 전체 UNIQUE 는 **team 다중 소유**(spec
// data-flow/12-workspace.md §2.1 Rationale: "team 워크스페이스는 다수 보유 가능")를
// 잘못 금지한다. personal 유일성은 앱 레이어(findOrCreatePersonalWorkspace)로 보장하며,
// DB 강제가 필요하면 `(owner_id) WHERE type='personal'` 부분 유니크 인덱스로 도입한다
// (broad UNIQUE 아님). 과거 미적용 @Unique 데코레이터(마이그레이션 부재)는 제거했다.
@Index(['ownerId', 'type'])
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20, default: 'personal' })
  type: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ unique: true, length: 100 })
  slug: string;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
