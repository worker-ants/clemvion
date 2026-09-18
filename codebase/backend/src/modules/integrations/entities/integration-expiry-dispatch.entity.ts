import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Integration } from './integration.entity';

export type ExpiryThreshold = '7d' | '3d' | '0d';

@Entity('integration_expiry_dispatch')
// V009 의 이름 없는 UNIQUE 라 Postgres 가 자동 이름을 붙였다 — 이름은 적지 않는다.
// 삽입(`claimThreshold`)은 대상 없는 `ON CONFLICT DO NOTHING` 이라 이름을 참조하지 않는다.
@Unique(['integrationId', 'threshold', 'tokenExpiresAt'])
export class IntegrationExpiryDispatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id' })
  integrationId: string;

  @ManyToOne(() => Integration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'integration_id' })
  integration: Integration;

  @Column({ length: 16 })
  threshold: ExpiryThreshold;

  @Column({ name: 'token_expires_at', type: 'timestamptz' })
  tokenExpiresAt: Date;

  @CreateDateColumn({ name: 'dispatched_at', type: 'timestamptz' })
  dispatchedAt: Date;
}
