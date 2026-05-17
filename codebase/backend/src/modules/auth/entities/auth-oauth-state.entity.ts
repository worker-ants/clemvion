import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type AuthOAuthMode = 'login' | 'register';

@Entity('auth_oauth_state')
export class AuthOAuthState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64, unique: true })
  state: string;

  @Column({ length: 32 })
  provider: string;

  @Column({ length: 16 })
  mode: AuthOAuthMode;

  @Column({ name: 'remember_me', default: false })
  rememberMe: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
