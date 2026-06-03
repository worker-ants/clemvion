import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
  Index,
} from 'typeorm';
import { Workflow } from '../../workflows/entities/workflow.entity';

export enum NodeCategory {
  TRIGGER = 'trigger',
  LOGIC = 'logic',
  FLOW = 'flow',
  AI = 'ai',
  INTEGRATION = 'integration',
  DATA = 'data',
  PRESENTATION = 'presentation',
}

@Entity('node')
@Check(`"NOT (container_id IS NOT NULL AND tool_owner_id IS NOT NULL)"`)
// 노드 라벨 유니크는 앱 레이어(노드 생성/이름변경/캔버스 저장 시 차단)와 런타임
// #N 안전장치로 보장한다 — DB unique 제약은 두지 않는다 (spec/5-system/5-expression-language.md
// §8.3.2 노드 라벨 유니크 정책 + 중복 라벨 안전장치). 과거 @Unique('UQ_node_workflow_label')
// 데코레이터는 대응 마이그레이션이 없어 DB 에 적용되지 않는 오해성 선언이라 제거했다.
@Index('IDX_node_workflow_label', ['workflowId', 'label'])
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
