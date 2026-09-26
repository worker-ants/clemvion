import { ApiPropertyOptional } from '@nestjs/swagger';

// `POST /api/executions/:id/continue` 요청 본문 — **OpenAPI 스키마 전용**.
//
// `continueExecution` 의 `@Body()` 파라미터는 인라인 객체 타입을 유지하고 이 클래스는 `@ApiBody({ type })` 로만 쓴다 — 선례
// `workflows/dto/execute-workflow.dto.ts`. 파라미터 타입을 이 클래스로 바꾸면 전역 `CustomValidationPipe` 가 진입해 여분 키가
// 400 이 된다(데코레이터가 없으면 모든 요청이 거부된다). 폼 값 검증은 엔진이 대기 중인 폼 노드의 필드 정의로 한다. 캐너리:
// `executions-continue-body.spec.ts`.
//
// 내부 서사를 `//` 에 두는 이유: JSDoc 은 공개 OpenAPI `description` 으로 나간다(`spec/conventions/swagger.md` §3).

/** 입력 대기 실행에 전달하는 폼 제출. */
export class ContinueExecutionRequestDto {
  /** 폼 필드 이름 → 값. 대기 중인 폼 노드의 필드 정의로 검증되고, 어긋나면 400 `VALIDATION_ERROR`(첫 오류만). */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  formData?: Record<string, unknown>;
}
