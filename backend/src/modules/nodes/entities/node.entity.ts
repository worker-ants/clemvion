import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { Workflow } from '../../workflows/entities/workflow.entity';

export enum NodeCategory {
  LOGIC = 'logic',
  FLOW = 'flow',
  AI = 'ai',
  INTEGRATION = 'integration',
  DATA = 'data',
  PRESENTATION = 'presentation',
}

@Entity('node')
@Check(`"NOT (container_id IS NOT NULL AND tool_owner_id IS NOT NULL)"`)
export class Node {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_id' })
  workflowId: string;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @Column({ length: 50 })
  type: string;

  @Column({ type: 'enum', enum: NodeCategory })
  category: NodeCategory;

  @Column({ length: 255 })
  label: string;

  @Column({ name: 'position_x', type: 'double precision', default: 0 })
  positionX: number;

  @Column({ name: 'position_y', type: 'double precision', default: 0 })
  positionY: number;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Column({ name: 'is_disabled', default: false })
  isDisabled: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'container_id', type: 'uuid', nullable: true })
  containerId: string | null;

  @ManyToOne(() => Node, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'container_id' })
  container: Node;

  @Column({ name: 'tool_owner_id', type: 'uuid', nullable: true })
  toolOwnerId: string | null;

  @ManyToOne(() => Node, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tool_owner_id' })
  toolOwner: Node;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
