import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * 데이터셋 공유 범위 (spec/3-workflow-editor/3-execution.md §2.2).
 * - private: 소유자(owner)만 조회·수정·삭제.
 * - workspace: 워크스페이스 구성원에게 read-only 공유 (소유자만 수정/삭제,
 *   타 구성원은 clone 으로 자기 소유 사본을 만들어 수정).
 */
export enum TestDatasetVisibility {
  PRIVATE = 'private',
  WORKSPACE = 'workspace',
}

/**
 * 워크플로우 Mock Input(테스트 입력) 저장 데이터셋 (§2.2 저장/이름 지정).
 *
 * 권한 모델: 유저 귀속 기본(visibility=private). 소유자가 workspace 공유를 선택하면
 * 같은 워크스페이스 구성원이 read-only 로 조회·불러오기 가능. 타 구성원이 수정하려면
 * clone(자기 소유 private 사본 생성) 한다. workspace_id 는 워크스페이스 격리·공유
 * 목록 쿼리를 위해 비정규화 저장(생성 시 workflow 의 workspace 에서 채움).
 *
 * spec: 3-workflow-editor/3-execution.md §2.2, 1-data-model.md §2.x.
 */
@Entity('workflow_test_dataset')
@Unique(['workflowId', 'ownerId', 'name'])
@Index(['ownerId', 'workflowId'])
@Index(['workspaceId', 'visibility'])
export class WorkflowTestDataset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_id', type: 'uuid' })
  workflowId: string;

  /** 데이터셋 소유 유저 (생성자). 수정/삭제 권한의 단일 기준. */
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  /** 워크스페이스 격리·공유 목록 쿼리용 (workflow 의 workspace 에서 비정규화). */
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: TestDatasetVisibility.PRIVATE,
  })
  visibility: TestDatasetVisibility;

  @Column({ length: 255 })
  name: string;

  /**
   * Mock Input JSON (POST /workflows/:id/execute body.input 으로 그대로 사용).
   * DB 컬럼명은 `data` 이나, API/엔티티 속성은 `input` — TransformInterceptor 가
   * 응답 객체에 top-level `data` 키가 있으면 "이미 래핑됨" 으로 오판하므로
   * (`{ data: <payload> }` 이중 래핑 회피) 응답 surface 에서 `data` 키를 피한다.
   */
  @Column({ name: 'data', type: 'jsonb', default: {} })
  input: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
