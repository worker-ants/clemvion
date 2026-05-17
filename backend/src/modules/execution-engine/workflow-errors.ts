/**
 * Typed error 계층 — sub-workflow handler (`workflow.handler.ts`) 가 분기에
 * 사용한다. 본 클래스들이 도입되기 전에는 handler 가 executor 의 throw
 * 메시지를 부분문자열 매칭으로 분류했고, executor 메시지를 무심코 손대면
 * silent regression 으로 모든 NOT_FOUND/TIMEOUT 케이스가 fallback
 * `SUB_WORKFLOW_FAILED` 로 떨어지는 위험이 있었다 (W-17).
 *
 * 이제 핸들러는 `err instanceof WorkflowNotFoundError` 처럼 typed 분기를
 * 1차로 사용하고, 옛 메시지 매칭은 외부 throw 호환을 위한 defensive
 * backstop 으로 보조한다.
 *
 * **메시지 포맷 보존**: 옛 코드를 grep 으로 추적하는 호출자·테스트 (예:
 * `execution-engine.service.spec.ts` 의 `.rejects.toThrow('Workflow not
 * found: ...')`) 가 깨지지 않도록 클래스 `message` 는 옛 throw 와 동일
 * 패턴을 유지한다.
 */

/**
 * 대상 워크플로우 정의가 존재하지 않음. `executeInline` / `executeAsync` /
 * `executeSync` / `execute` 의 진입 검증에서 발생.
 */
export class WorkflowNotFoundError extends Error {
  readonly workflowId: string;
  constructor(workflowId: string) {
    super(`Workflow not found: ${workflowId}`);
    this.name = 'WorkflowNotFoundError';
    this.workflowId = workflowId;
  }
}

/**
 * sync 모드 sub-workflow 의 wall-clock timeout 초과. `executeSync` 의
 * `Promise.race` 가 timeout branch 에서 reject 할 때 발생.
 */
export class SubWorkflowTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Sub-workflow execution timed out after ${timeoutMs}ms`);
    this.name = 'SubWorkflowTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}
