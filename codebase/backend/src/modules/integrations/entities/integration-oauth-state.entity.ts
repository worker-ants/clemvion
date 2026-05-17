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
import { Integration } from './integration.entity';
import { encryptedJsonTransformer } from '../services/credentials-transformer';

export type OAuthStateMode = 'new' | 'reauthorize' | 'request_scopes';

@Entity('integration_oauth_state')
export class IntegrationOAuthState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64, unique: true })
  state: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 32 })
  provider: string;

  @Column({ name: 'service_type', length: 50 })
  serviceType: string;

  @Column({ length: 32 })
  mode: OAuthStateMode;

  @Column({ name: 'integration_id', type: 'uuid', nullable: true })
  integrationId: string | null;

  @ManyToOne(() => Integration, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'integration_id' })
  integration: Integration | null;

  @Column({
    name: 'requested_scopes',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  requestedScopes: string[];

  @Column({
    name: 'integration_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  integrationName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  scope: string | null;

  /**
   * Provider-specific begin-time metadata. AES-256-GCM encrypted at rest
   * (same transformer as Integration.credentials and
   * IntegrationOAuthPreview.credentials) — required to keep private-app
   * OAuth client credentials out of DB dumps / replication streams / slow
   * query logs during the 10-minute state TTL. Cleared together with the
   * rest of the state row (TTL or DELETE-RETURNING on callback
   * consumption). Shape is provider-defined; consumers cast to a narrow
   * type at the service-layer boundary.
   */
  @Column({
    name: 'provider_meta',
    type: 'jsonb',
    nullable: true,
    transformer: encryptedJsonTransformer,
  })
  providerMeta: Record<string, unknown> | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
