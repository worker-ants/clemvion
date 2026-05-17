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
@Unique('integration_expiry_dispatch_key', [
  'integrationId',
  'threshold',
  'tokenExpiresAt',
])
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
