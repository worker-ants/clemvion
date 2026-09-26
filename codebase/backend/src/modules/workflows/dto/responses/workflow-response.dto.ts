import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EdgeDto } from '../../../edges/dto/responses/edge-response.dto';
import { EdgeType } from '../../../edges/entities/edge.entity';
import { NodeDto } from '../../../nodes/dto/responses/node-response.dto';
import { NodeCategory } from '../../../nodes/entities/node.entity';

/**
 * 워크플로우 기본 속성 응답 DTO.
 */
export class WorkflowDto {
  /** 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 워크플로우 이름 */
  @ApiProperty({ example: '신규 리드 처리 자동화' })
  name: string;

  /** 설명 */
  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  /** 활성화 여부 */
  @ApiProperty()
  isActive: boolean;

  /** 태그 목록 */
  @ApiProperty({ type: [String], example: ['sales', 'automation'] })
  tags: string[];

  /** 폴더 UUID (루트이면 null) */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  folderId?: string | null;

  /** 워크플로우 설정 객체 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  settings: Record<string, unknown>;

  /** 현재 버전 번호 */
  @ApiProperty({ example: 3 })
  currentVersion: number;

  /** 생성자 UUID */
  @ApiProperty({ format: 'uuid' })
  createdBy: string;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/**
 * 수동 실행 요청 접수 응답.
 */
export class ExecuteAcceptedDto {
  /** 생성된 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  executionId: string;
}

/**
 * 캔버스 저장 결과. 이 응답은 TransformInterceptor 에 의해 한번 더 감싸지지 않고
 * 서비스 반환값이 그대로 `{ data: <이 객체> }` 로 래핑됩니다.
 */
export class CanvasSaveResultDto {
  /** 저장 후 워크플로우 */
  @ApiProperty({ type: () => WorkflowDto })
  workflow: WorkflowDto;

  // 원소를 타입 없는 객체(`items: { type: 'object' }`)로 두면 응답 계약 검증자가 그 안으로 내려가지 않아, 원소에 무엇이
  // 실려도 대조를 통과한다. 서비스는 엔티티(`Node` · `Edge`)를 그대로 돌려주고 두 DTO 가 그 컬럼과 1:1 이다.

  /** 저장 후 노드 배열 */
  @ApiProperty({ type: () => [NodeDto] })
  nodes: NodeDto[];

  /** 저장 후 엣지 배열 */
  @ApiProperty({ type: () => [EdgeDto] })
  edges: EdgeDto[];
}

/**
 * 개별 graph warning rule 평가 결과.
 */
export class GraphWarningResultDto {
  /** 규칙 ID (예: `parallel:nested-depth-exceeded`) */
  @ApiProperty({ example: 'parallel:nested-depth-exceeded' })
  ruleId: string;

  /** 심각도 */
  @ApiProperty({ enum: ['error', 'warning'] })
  severity: 'error' | 'warning';

  /** 위반한 노드 UUID */
  @ApiProperty({ format: 'uuid' })
  nodeId: string;

  /** 영문 SoT / fallback 메시지. ko 표시는 frontend 가 ruleId 로 localize */
  @ApiProperty({ example: 'Nested parallel depth exceeds limit' })
  message: string;

  /**
   * 동적 메시지의 보간 값(노드 라벨·수치). frontend 가 `GRAPH_WARNING_KO[ruleId]`
   * 한국어 템플릿의 `{{name}}` 에 보간 (i18n Principle 3-C). 정적 메시지 rule 은 생략.
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { node: 'Outer', child: 'Inner', product: 64, cap: 32 },
  })
  params?: Record<string, string | number>;
}

/**
 * GET /workflows/:id/graph-warnings 응답 DTO.
 */
export class GraphWarningsResponseDto {
  /** 규칙 평가 결과 목록 */
  @ApiProperty({ type: [GraphWarningResultDto] })
  results: GraphWarningResultDto[];

  /** severity=error 가 1건 이상 있으면 true — 저장 버튼 disable 기준 */
  @ApiProperty()
  hasError: boolean;

  /** severity=warning 가 1건 이상 있으면 true — 노란 배지 표시 기준 */
  @ApiProperty()
  hasWarning: boolean;
}

// 아래 두 DTO 는 `NodeDto` · `EdgeDto` 를 재사용하지 않는다 — export 는 UUID 를 싣지 않고 노드 간 참조를 같은 응답
// `nodes[]` 의 index 로 정규화한다(`spec/2-navigation/1-workflow-list.md` §3.2). import 요청 DTO(`ImportNodeDto` ·
// `ImportEdgeDto`)도 쓰지 않는다 — export 는 모든 키를 항상 싣고 `description` · `condition` 에 `null` 을 싣는데, 요청
// DTO 는 그 키들이 optional 이고 그 둘이 nullable 이 아니다. 요청은 «무엇을 받는가», 응답은 «무엇이 항상 실리는가» 다.

/**
 * 워크플로우 내보내기 JSON 의 노드 한 개.
 */
export class ExportedNodeDto {
  /** 노드 타입 식별자 */
  @ApiProperty({ example: 'http_request' })
  type: string;

  /** 노드 카테고리 */
  @ApiProperty({ enum: NodeCategory, enumName: 'NodeCategory' })
  category: NodeCategory;

  /** 노드 라벨. 워크플로우 안에서 유일하다. */
  @ApiProperty({ example: 'Fetch API' })
  label: string;

  /** 캔버스 X 좌표 */
  @ApiProperty({ example: 250 })
  positionX: number;

  /** 캔버스 Y 좌표 */
  @ApiProperty({ example: 300 })
  positionY: number;

  /** 노드별 설정 객체 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  config: Record<string, unknown>;

  /** 노드 비활성화 여부 */
  @ApiProperty()
  isDisabled: boolean;

  /** 노드 설명. 없으면 null */
  // `type` 을 적는다 — `string | null` 은 설계 타입이 `Object` 로 emit 된다. 데코레이터는 swagger CLI 플러그인 메타데이터를
  // 먼저 보고 없으면 설계 타입으로 떨어지므로, 플러그인이 없는 생성(테스트의 응답 계약 검증자)에서는 `type: object` 가
  // 된다(실측). 적어 두면 배포 빌드와 테스트가 같은 스키마를 본다. `workflow-response.dto.spec.ts` 가 고정한다.
  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  /** 컨테이너 노드의 `nodes[]` 배열 index. 루트 노드면 null */
  @ApiProperty({ type: 'integer', nullable: true, example: null })
  containerIndex: number | null;

  /** Tool 소유 노드의 `nodes[]` 배열 index. 없으면 null */
  @ApiProperty({ type: 'integer', nullable: true, example: null })
  toolOwnerIndex: number | null;
}

/**
 * 워크플로우 내보내기 JSON 의 엣지 한 개.
 */
export class ExportedEdgeDto {
  /** source 노드의 `nodes[]` 배열 index */
  @ApiProperty({ type: 'integer', example: 0 })
  sourceNodeIndex: number;

  /** source 포트 이름 */
  @ApiProperty({ example: 'out' })
  sourcePort: string;

  /** target 노드의 `nodes[]` 배열 index */
  @ApiProperty({ type: 'integer', example: 1 })
  targetNodeIndex: number;

  /** target 포트 이름 */
  @ApiProperty({ example: 'in' })
  targetPort: string;

  /** 엣지 타입 */
  @ApiProperty({ enum: EdgeType, enumName: 'EdgeType' })
  type: EdgeType;

  /** 조건부 엣지의 조건 객체. 없으면 null */
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  condition: Record<string, unknown> | null;
}

/**
 * 워크플로우 내보내기 결과 (JSON 포맷).
 */
export class ExportWorkflowDto {
  /** 내보내기 포맷 버전 */
  @ApiProperty({ example: 1 })
  formatVersion: number;

  /** 이름 */
  @ApiProperty()
  name: string;

  /** 설명 */
  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  /** 태그 */
  @ApiProperty({ type: [String] })
  tags: string[];

  /** 설정 객체 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  settings: Record<string, unknown>;

  /** 노드 배열. 노드 간 참조(`containerIndex` · `toolOwnerIndex` · 엣지의 `*NodeIndex`)는 이 배열의 index 다. */
  @ApiProperty({ type: () => [ExportedNodeDto] })
  nodes: ExportedNodeDto[];

  /** 엣지 배열 */
  @ApiProperty({ type: () => [ExportedEdgeDto] })
  edges: ExportedEdgeDto[];
}
