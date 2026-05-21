import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * [Spec EIA §5.1 / §11] — Inbound 명령 종류. WebSocket 의 `execution.*` 명령에서 prefix 만
 * 제거한 케밥-소문자 형태.
 */
export const INTERACT_COMMANDS = [
  'submit_form',
  'click_button',
  'submit_message',
  'end_conversation',
  'cancel',
] as const;

export type InteractCommand = (typeof INTERACT_COMMANDS)[number];

/**
 * 단일 DTO 로 5 종류 명령을 모두 수용 (discriminated union 의 backend 표현).
 * Controller / Service 가 `command` 값에 따라 필수 필드를 추가 검증한다 (예: submit_form 은
 * `data` 필수). class-validator 의 정적 검사만으로는 모든 분기를 표현하기 어려워, runtime
 * narrow 로 보강한다.
 */
export class InteractDto {
  /** 명령 종류. WS 의 `execution.<command>` 와 1:1 매핑. */
  @ApiProperty({ enum: INTERACT_COMMANDS, example: 'submit_form' })
  @IsIn(INTERACT_COMMANDS as unknown as string[])
  command: InteractCommand;

  /**
   * 대상 노드 UUID. `cancel` 을 제외한 모든 command 에서 필수. service 가 runtime 검증.
   */
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      '대상 노드 UUID. cancel 을 제외한 4개 command 에서 필수. waiting_for_input 상태인 NodeExecution 의 graph node id 와 일치해야 한다.',
  })
  @IsOptional()
  @IsUUID()
  nodeId?: string;

  /**
   * `submit_form` 의 필드 값 맵. `{ [fieldName]: value }`.
   *
   * WS 의 동일 명령에서는 `formData` 였으나 REST 컨벤션에 맞춰 `data` 로 명명한다.
   * 매핑 정보는 [Spec EIA §11].
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'submit_form 의 필드 값 맵. submit_form 이외의 command 에서는 무시.',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  /** `click_button` 의 버튼 UUID. */
  @ApiPropertyOptional({
    description: 'click_button 의 버튼 UUID 또는 "__continue__".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  buttonId?: string;

  /** `submit_message` 의 사용자 메시지. */
  @ApiPropertyOptional({
    description: 'submit_message 의 사용자 메시지 본문 (multi-turn AI 노드).',
    maxLength: 32_000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32_000)
  message?: string;

  /** end_conversation / cancel 의 사유 (디버그용 표시). */
  @ApiPropertyOptional({
    description: 'end_conversation 또는 cancel 시 사유 (옵션, 디버그 표시).',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
