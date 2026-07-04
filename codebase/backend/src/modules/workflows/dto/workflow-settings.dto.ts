import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * 워크플로우 실행 설정(`Workflow.settings` JSONB)의 write 검증 DTO.
 *
 * 전역 `CustomValidationPipe` 가 `whitelist + forbidNonWhitelisted` 이므로 여기 선언되지
 * 않은 키는 400 으로 거부된다 — workspace 의 `UpdateWorkspaceSettingsDto` 와 동일한 strict
 * 정책이며, `spec/1-data-model.md §2.4` 가 이미 `Workflow.settings` 를 `maxConcurrentExecutions`
 * 로 스코프한다(§8 admission gate). 신규 설정 키는 여기 필드를 추가해 확장한다.
 */
export class WorkflowSettingsDto {
  /**
   * 워크플로우당 동시 실행(`running` Execution) 상한 (§8 admission gate). 양의 정수만
   * 유효하며 미설정 시 시스템 기본값(3). 런타임의 `resolveConcurrencyCap` 이 부적합 값을
   * defaultCap 으로 무시하는 backstop 을 갖지만, 본 DTO 가 write 경계에서 선차단한다.
   * Parallel 노드 `config.maxConcurrency`(노드 내 branch 동시성)와는 스코프가 다른 별개 설정.
   */
  @ApiPropertyOptional({
    type: Number,
    example: 3,
    description:
      '워크플로우당 동시 실행(running Execution) 상한. 양의 정수, 미설정 시 기본 3 (spec §8 admission gate).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentExecutions?: number;
}
