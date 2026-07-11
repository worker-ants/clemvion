import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import type { ConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

/**
 * `POST /api/external/executions/:id/interact` / `/cancel` 의 ack body.
 *
 * [Spec EIA §5.1 / §5.4]. 명령 수신 직후의 동기 응답 — 실제 노드 진행은 비동기.
 * `currentStatus` 는 명령 직후 본 endpoint 가 관측한 최근 상태.
 */
export class InteractAckDto {
  @ApiProperty({ format: 'uuid' })
  executionId: string;

  @ApiProperty({ example: true, description: '명령이 큐에 적재됨' })
  accepted: boolean;

  @ApiPropertyOptional({
    enum: [
      'pending',
      'running',
      'waiting_for_input',
      'completed',
      'failed',
      'cancelled',
    ],
    description:
      '명령 수신 직후 관측된 execution status. 즉시 다른 상태로 전이될 수 있으므로 SSE 스트림으로 확정 상태를 받는 것을 권장.',
  })
  currentStatus?:
    | 'pending'
    | 'running'
    | 'waiting_for_input'
    | 'completed'
    | 'failed'
    | 'cancelled';
}

/**
 * `POST /api/external/executions/:id/refresh-token` 응답. [Spec EIA §5.5].
 */
export class RefreshTokenResponseDto {
  @ApiProperty({
    description: 'iext_ prefixed JWT (단명, default 1h).',
    example: 'iext_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token: string;

  @ApiProperty({
    description: 'ISO 8601 만료 시각.',
    example: '2026-05-21T01:00:00.000Z',
  })
  expiresAt: string;
}

/** waiting_for_input 상태에서 현재 입력을 대기 중인 노드. [Spec EIA §5.3]. */
export class CurrentNodeDto {
  /** 대기 중인 노드의 ID. */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 노드 타입 (예: `Carousel`, `ai_agent`). */
  @ApiProperty({ example: 'Carousel' })
  type: string;

  /** 인터랙션 종류. 인식 불가한 노드는 `null`. */
  @ApiProperty({
    enum: ['form', 'buttons', 'ai_conversation'],
    nullable: true,
  })
  interactionType: 'form' | 'buttons' | 'ai_conversation' | null;
}

/**
 * `context` 두 변형의 공통 봉투. [Spec EIA §5.3].
 *
 * 봉투만 스키마화하고 내부 payload 는 열린 map 으로 남긴다 — 노드 타입별 자유 형식이라
 * 클래스로 고정하면 노드 output 규약(`spec/conventions/node-output.md`)과 SoT 가 이중화된다.
 * [Swagger 규약 §1-4](../../../../../../spec/conventions/swagger.md).
 *
 * `abstract` 이지만 export 한다 — `getStatus` 조립부가 분기 전 공통 필드를 선조립할 때 이 타입으로
 * **명시 annotate** 해야 하기 때문이다. object spread 는 fresh literal 타입을 넓히므로
 * (`interactionType` 이 `string` 이 된다) annotation 없이는 두 variant 에 assignable 하지 않다.
 * 구조적 타이핑이라 객체 리터럴 대입에 `new` 는 불필요하고, `@ApiExtraModels` 에 등록하지 않으므로
 * OpenAPI 에 phantom 스키마가 생기지도 않는다.
 */
export abstract class WaitingContextBaseDto {
  /** 현재 대기 중인 인터랙션 종류. **variant 판별자가 아니다** (아래 `ExecutionStatusDto.context` 주석 참조). */
  @ApiProperty({ enum: ['form', 'buttons', 'ai_conversation'] })
  interactionType: 'form' | 'buttons' | 'ai_conversation';

  /** 대기 중인 노드 ID. `submit_message` / `click_button` 이 이 값을 되돌려 보낸다. */
  @ApiProperty({ format: 'uuid' })
  waitingNodeId: string;

  /**
   * 대화 히스토리 durable 스냅샷. 형태 SoT 는
   * [conversation-thread §1.3](../../../../../../spec/conventions/conversation-thread.md).
   *
   * **부재 시 키 자체를 생략**한다(present-when-available) — 형제 `result`/`error` 의 `null` 관례와 다르며,
   * SSE `waiting_for_input` wire 와 형식을 일치시키기 위함이다. 따라서 `| null` 을 쓰지 않는다.
   * [API 규약 §5.4](../../../../../../spec/5-system/2-api-convention.md).
   */
  @ApiPropertyOptional({
    description:
      '대화 히스토리 스냅샷. 값이 없으면 키를 생략한다 (null 아님 — API 규약 §5.4).',
    type: 'object',
    additionalProperties: true,
  })
  conversationThread?: ConversationThread;
}

/** `interactionType=buttons` 이고 buttonConfig 복원에 성공한 경우. [Spec EIA §5.3]. */
export class ButtonsContextDto extends WaitingContextBaseDto {
  /** SSE 와 동일 wire: `{ buttons, nodeOutput }`. 내부는 노드 타입별 자유 형식. */
  @ApiProperty({
    description:
      '버튼 목록 + 원본 노드 output (SSE waiting_for_input 과 동일 wire).',
    type: 'object',
    additionalProperties: true,
  })
  buttonConfig: { buttons: unknown; nodeOutput: Record<string, unknown> };
}

/**
 * `form` / `ai_conversation`, 그리고 **buttonConfig 를 복원하지 못한 `buttons`**. [Spec EIA §5.3].
 *
 * 마지막 케이스 때문에 `interactionType` 은 sound 판별자가 아니다.
 */
export class NodeOutputContextDto extends WaitingContextBaseDto {
  /** 대기 노드의 output. `formConfig` / `conversationConfig` 가 이 안에 중첩된다. */
  @ApiProperty({
    description:
      '대기 노드 output (formConfig/conversationConfig 를 내부에 포함).',
    type: 'object',
    additionalProperties: true,
  })
  nodeOutput: Record<string, unknown>;
}

/**
 * `GET /api/external/executions/:id` 단발 상태 조회 응답. [Spec EIA §5.3].
 *
 * `context` 는 **판별자 없는 닫힌 2-variant union** 이다. 클라이언트는 `interactionType` 이 아니라
 * **키 존재**(`'buttonConfig' in context`)로 분기한다 — `buttons` 가 buttonConfig 복원 실패 시
 * `NodeOutputContextDto` 변형으로 fallthrough 하기 때문.
 */
@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)
export class ExecutionStatusDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  @ApiProperty({
    enum: [
      'pending',
      'running',
      'waiting_for_input',
      'completed',
      'failed',
      'cancelled',
    ],
  })
  status:
    | 'pending'
    | 'running'
    | 'waiting_for_input'
    | 'completed'
    | 'failed'
    | 'cancelled';

  /** waiting_for_input 상태에서만 실값. 그 외에는 `null`. */
  @ApiPropertyOptional({
    description: 'waiting_for_input 상태에서만. 현재 입력 대기 중인 노드.',
    type: () => CurrentNodeDto,
    nullable: true,
  })
  currentNode?: CurrentNodeDto | null;

  /**
   * waiting_for_input 상태의 인터랙션 표면. 그 외에는 `null`.
   *
   * 판별자 없는 `oneOf` — `discriminator` 를 선언하면 SDK 생성기가 `buttons` 를 항상
   * `ButtonsContextDto` 로 narrowing 해 fallthrough 케이스에서 런타임 `undefined` 접근이 된다.
   * [Swagger 규약 §1-4](../../../../../../spec/conventions/swagger.md).
   */
  @ApiPropertyOptional({
    description:
      'waiting_for_input 상태의 인터랙션 표면. buttonConfig 변형 또는 nodeOutput 변형 (키 존재로 분기).',
    oneOf: [
      { $ref: getSchemaPath(ButtonsContextDto) },
      { $ref: getSchemaPath(NodeOutputContextDto) },
    ],
    nullable: true,
  })
  context?: ButtonsContextDto | NodeOutputContextDto | null;

  /** completed 가 아니면 `null` (키 present — API 규약 §5.4). */
  @ApiPropertyOptional({
    description: 'completed 시점의 최종 결과 envelope.',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  result?: Record<string, unknown> | null;

  /** failed 가 아니면 `null` (키 present — API 규약 §5.4). */
  @ApiPropertyOptional({
    description: 'failed 시점의 에러 envelope.',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  error?: Record<string, unknown> | null;

  /**
   * REST 단발 응답에서는 항상 `0` placeholder — in-memory SSE seq 카운터에 접근하지 않는다.
   * 클라이언트는 SSE `Last-Event-Id` 로 실제 seq 를 보정한다 (EIA §5.3).
   */
  @ApiProperty({
    description:
      '본 execution 의 WS event monotonic seq. REST 단발 응답은 항상 0 placeholder — SSE 가 권위.',
    example: 0,
  })
  seq: number;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
