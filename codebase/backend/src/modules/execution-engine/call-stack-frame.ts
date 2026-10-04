/** 중첩 재개 call-stack frame 에서 재개 조회에 필요한데 비어 있는 필드. */
export interface BrokenCallStackFrame {
  /** 처음으로 깨진 frame 의 위치. */
  readonly index: number;
  /** 비었거나 문자열이 아닌 필드 이름(`workflowId` · `invokerNodeId`). */
  readonly missing: readonly string[];
}

const REQUIRED_FIELDS = ['workflowId', 'invokerNodeId'] as const;

/**
 * 영속된 `resume_call_stack` frame 가운데 처음으로 깨진 것을 찾는다. 없으면 `null`.
 *
 * 두 필드는 재개 조회(`nodeRepository.findOneBy` · 그래프 로드)의 where 조건이다. 영속 데이터라
 * 타입이 보장하지 않고, TypeORM 1 은 where 의 undefined 를 예외로 막으므로(NERV Task
 * `CLE-T-91JNWW`) 비어 있으면 일반 `TypeORMError` 로 끝나 일반 실패 경로(실행 `failed`)를 탄다.
 * 호출자는 이 결과로 조회 전에 `RESUME_CHECKPOINT_MISSING` 으로 분류한다(NERV Task `CLE-T-BV4YXZ`).
 *
 * 비어 있지 않은 문자열이면 통과한다. uuid 형식은 보지 않는다(값을 쓰는 것이 엔진 자신이다).
 */
export function findBrokenCallStackFrame(
  frames: readonly unknown[],
): BrokenCallStackFrame | null {
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    const record =
      frame !== null && typeof frame === 'object'
        ? (frame as Record<string, unknown>)
        : {};
    const missing = REQUIRED_FIELDS.filter((field) => {
      const value = record[field];
      return typeof value !== 'string' || value.length === 0;
    });
    if (missing.length > 0) return { index, missing };
  }
  return null;
}
