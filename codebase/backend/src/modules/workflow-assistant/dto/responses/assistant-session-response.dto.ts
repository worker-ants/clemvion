import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  AUTO_RESUME_REASONS,
  PLAN_STEP_ACTIONS,
  type AssistantMessageRole,
  type AssistantStepAction,
  type AssistantToolCallKind,
  type AutoResumeReason,
} from '../../entities/workflow-assistant-message.entity';
import type { AssistantSessionStatus } from '../../entities/workflow-assistant-session.entity';

// 세션 CRUD 는 엔티티를 그대로 반환한다(`workflow-assistant.controller.ts`). 이 DTO 들은 반환 모양을 **바꾸지 않고 적는다** —
// 컬럼 전부, 관계는 싣지 않는다(조회가 관계를 로드하지 않는다). 맞는지는 e2e 가 `assertMatchesContract` 로 본다 —
// 선언되지 않은 키가 응답에 있으면 실패한다(api-convention §5.4 «검증 층»).
//
// 내부 서사를 `//` 에 두는 이유: JSDoc 은 공개 OpenAPI `description` 으로 나간다(`spec/conventions/swagger.md` §3).

const SESSION_STATUSES = [
  'active',
  'archived',
] as const satisfies readonly AssistantSessionStatus[];
const MESSAGE_ROLES = [
  'user',
  'assistant',
  'tool',
] as const satisfies readonly AssistantMessageRole[];
const TOOL_CALL_KINDS = [
  'explore',
  'plan',
  'edit',
  'finish',
] as const satisfies readonly AssistantToolCallKind[];

/** Assistant 세션 한 건. */
export class AssistantSessionDto {
  /** 세션 ID. */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 세션이 속한 워크스페이스 ID. */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 세션이 속한 워크플로우 ID. */
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  /** 세션을 만든 사용자 ID — 세션은 만든 사람만 본다. */
  @ApiProperty({ format: 'uuid' })
  userId: string;

  /** 세션 제목. 첫 메시지 전에는 없다. */
  @ApiProperty({
    type: String,
    nullable: true,
    example: '결제 알림 워크플로우 다듬기',
  })
  title: string | null;

  /** 세션이 고정한 LLM 설정 ID. 없으면 워크스페이스 기본값을 쓴다. */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  llmConfigId: string | null;

  /** 세션 상태. */
  @ApiProperty({ enum: SESSION_STATUSES, enumName: 'AssistantSessionStatus' })
  status: AssistantSessionStatus;

  /** 저장된 메시지 수. */
  @ApiProperty({ type: Number, example: 12 })
  messageCount: number;

  /** 마지막 상호작용 시각 — 목록 정렬 기준. */
  @ApiProperty({ format: 'date-time', example: '2026-09-26T03:14:00.000Z' })
  lastInteractionAt: string;

  /** 생성 시각. */
  @ApiProperty({ format: 'date-time', example: '2026-09-26T03:00:00.000Z' })
  createdAt: string;

  /** 마지막 변경 시각. */
  @ApiProperty({ format: 'date-time', example: '2026-09-26T03:14:00.000Z' })
  updatedAt: string;
}

/** Assistant 가 호출한 도구 한 건. */
export class AssistantToolCallDto {
  /** LLM 이 부여한 도구 호출 ID. `tool` 메시지의 `toolCallId` 가 이 값을 가리킨다. */
  @ApiProperty()
  id: string;

  /** 도구 이름. */
  @ApiProperty({ example: 'add_node' })
  name: string;

  // 도구마다 인자 스키마가 다르다 — 그 형태의 정본은 도구 정의(`tools/tool-definitions.ts`, LLM 에 넘기는 JSON Schema)다.
  // 여기서 16개 도구의 인자를 닫힌 union 으로 다시 적으면 정본이 둘이 된다 — `swagger.md` §1-4 «형태는 고정이나 SoT 이중화
  // 회피로 여는 경우». 엔티티(`AssistantToolCallRecord.arguments: Record<string, unknown>`)와 frontend 타입도 같은 열린 모양이라
  // 한쪽만 좁혀 둔 타입이 없다.
  /** 도구 인자 — 형태는 도구마다 다르다. */
  @ApiProperty({ type: 'object', additionalProperties: true })
  arguments: Record<string, unknown>;

  /** 도구 분류. */
  @ApiProperty({ enum: TOOL_CALL_KINDS, enumName: 'AssistantToolCallKind' })
  kind: AssistantToolCallKind;

  // 결과가 기록되기 전(스트림 중단 등)에는 키가 없다. 결과 모양도 도구마다 다르다 — 정본은 각 도구의 실행부다(위 `arguments` 와 같은 §1-4 예외).
  /** 도구 실행 결과 — 형태는 도구마다 다르다. 결과가 기록되지 않았으면 키가 없다. */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  result?: unknown;

  /** 이 호출이 완료시키는 계획 단계 ID(단일 — 옛 형식). */
  @ApiPropertyOptional()
  planStepId?: string;

  /** 이 호출이 완료시키는 계획 단계 ID 목록. `planStepId` 와 함께 오면 합쳐서 센다. */
  @ApiPropertyOptional({ type: [String] })
  planStepIds?: string[];

  /** 공급자가 다음 호출에 되돌려 받아야 하는 불투명 서명(Gemini 의 thought signature). 없으면 키가 없다. */
  @ApiPropertyOptional()
  signature?: string;
}

/** 계획의 한 단계. */
export class AssistantPlanStepDto {
  /** 단계 ID. */
  @ApiProperty({ example: 's1' })
  id: string;

  /** 단계가 하는 일. */
  @ApiProperty({ enum: PLAN_STEP_ACTIONS, enumName: 'AssistantStepAction' })
  action: AssistantStepAction;

  /** 단계 설명. */
  @ApiProperty()
  description: string;

  /** 단계를 택한 이유. 없으면 키가 없다. */
  @ApiPropertyOptional()
  rationale?: string;
}

/** Assistant 가 제안한 계획. */
export class AssistantPlanDto {
  /** 계획 제목. */
  @ApiProperty()
  title: string;

  /** 계획 요약. */
  @ApiProperty()
  summary: string;

  /** 계획 단계. */
  @ApiProperty({ type: () => [AssistantPlanStepDto] })
  steps: AssistantPlanStepDto[];

  /** 사용자에게 되묻는 질문. 없으면 키가 없다. */
  @ApiPropertyOptional({ type: [String] })
  openQuestions?: string[];

  /** 사용자가 계획을 승인한 시각. 승인 전에는 키가 없다. */
  @ApiPropertyOptional({ format: 'date-time' })
  approvedAt?: string;
}

/** 한 턴의 토큰 사용량. */
export class AssistantUsageDto {
  /** 입력 토큰 수. */
  @ApiProperty({ type: Number })
  inputTokens: number;

  /** 출력 토큰 수. */
  @ApiProperty({ type: Number })
  outputTokens: number;

  /** 합계 토큰 수. */
  @ApiProperty({ type: Number })
  totalTokens: number;

  /** 사고(thinking) 토큰 수. 공급자가 주지 않으면 키가 없다. */
  @ApiPropertyOptional({ type: Number })
  thinkingTokens?: number;

  /** 사용한 모델. */
  @ApiProperty({ example: 'gpt-4o' })
  model: string;
}

/** Assistant 세션의 메시지 한 건. */
@ApiExtraModels(AssistantToolCallDto, AssistantPlanDto, AssistantUsageDto)
export class AssistantMessageDto {
  /** 메시지 ID. */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 메시지가 속한 세션 ID. */
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  /** 발화자. */
  @ApiProperty({ enum: MESSAGE_ROLES, enumName: 'AssistantMessageRole' })
  role: AssistantMessageRole;

  /** 본문. 본문 없이 도구만 호출한 메시지는 null. */
  @ApiProperty({ type: String, nullable: true })
  content: string | null;

  /** assistant 메시지가 호출한 도구들. 없으면 null. */
  @ApiProperty({ type: () => [AssistantToolCallDto], nullable: true })
  toolCalls: AssistantToolCallDto[] | null;

  /** `tool` 메시지가 응답하는 도구 호출 ID. 그 밖의 메시지는 null. */
  @ApiProperty({ type: String, nullable: true })
  toolCallId: string | null;

  /** 이 메시지가 제안한 계획. 없으면 null. */
  @ApiProperty({ type: () => AssistantPlanDto, nullable: true })
  plan: AssistantPlanDto | null;

  /** 이 턴의 토큰 사용량. 기록되지 않았으면 null. */
  @ApiProperty({ type: () => AssistantUsageDto, nullable: true })
  usage: AssistantUsageDto | null;

  /** LLM 이 턴을 끝낸 이유(공급자 값 · `auto_resume_pending` 등). 없으면 null. */
  @ApiProperty({ type: String, nullable: true })
  finishReason: string | null;

  /** 이 턴이 자동 재개로 이어졌는가. */
  @ApiProperty()
  autoResumed: boolean;

  /** 자동 재개 사유. 재개하지 않았으면 null. */
  @ApiProperty({
    enum: AUTO_RESUME_REASONS,
    enumName: 'AutoResumeReason',
    nullable: true,
  })
  autoResumeReason: AutoResumeReason | null;

  /** 자동 재개 회차. 재개하지 않았으면 null. */
  @ApiProperty({ type: Number, nullable: true })
  autoResumeAttempt: number | null;

  /** 생성 시각. */
  @ApiProperty({ format: 'date-time', example: '2026-09-26T03:14:00.000Z' })
  createdAt: string;
}

/** 세션 상세 — 세션과 그 메시지(오래된 것부터). */
@ApiExtraModels(AssistantSessionDto, AssistantMessageDto)
export class AssistantSessionDetailDto {
  /** 세션. */
  @ApiProperty({ type: () => AssistantSessionDto })
  session: AssistantSessionDto;

  /** 메시지 — 생성 시각 오름차순. */
  @ApiProperty({ type: () => [AssistantMessageDto] })
  messages: AssistantMessageDto[];
}
