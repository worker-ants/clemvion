import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Check,
} from 'typeorm';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { Node } from '../../nodes/entities/node.entity';

export enum EdgeType {
  DATA = 'data',
  ERROR = 'error',
}

@Entity('edge')
@Unique(['sourceNodeId', 'sourcePort', 'targetNodeId', 'targetPort'])
@Check(`"source_node_id != target_node_id"`)
export class Edge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_id' })
  workflowId: string;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @Column({ name: 'source_node_id' })
  sourceNodeId: string;

  @ManyToOne(() => Node, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_node_id' })
  sourceNode: Node;

  @Column({ name: 'source_port', length: 100, default: 'out' })
  sourcePort: string;

  @Column({ name: 'target_node_id' })
  targetNodeId: string;

  @ManyToOne(() => Node, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_node_id' })
  targetNode: Node;

  @Column({ name: 'target_port', length: 100, default: 'in' })
  targetPort: string;

  @Column({ type: 'enum', enum: EdgeType, default: EdgeType.DATA })
  type: EdgeType;

  @Column({ type: 'jsonb', nullable: true })
  condition: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
