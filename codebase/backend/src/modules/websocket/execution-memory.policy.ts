/**
 * 실행 단위 메모리 항목(`ExecutionSeqAllocator` 의 seq 미러, `WebsocketService` 의 routing context)이
 * 함께 쓰는 회수 정책. 두 항목은 terminal 이벤트를 보낸 인스턴스에서만 풀리므로, 실행을 park 한
 * 인스턴스와 끝낸 인스턴스가 다르면 park 한 쪽에 남는다(NERV Task CLE-T-4J965H). 그래서 유휴 TTL 과
 * 상한으로도 회수한다.
 */

/**
 * `exec:seq:` 키의 기본 sliding TTL(초). 24시간 = continuation-bus 와 같은 보수값.
 * 같은 값을 실행 단위 메모리 항목의 유휴 TTL 기본값으로도 쓴다.
 */
export const DEFAULT_SEQ_KEY_TTL_SECONDS = 86_400;

/**
 * 실행 단위 메모리 항목의 인스턴스당 상한. 한 인스턴스가 동시에 붙드는 실행 수보다 넉넉히 크게 잡았다.
 * 넘치면 가장 오래 만지지 않은 항목부터 지운다.
 */
export const EXECUTION_MEMORY_MAX_ENTRIES = 10_000;

/**
 * `EXECUTION_SEQ_TTL_SECONDS` 를 읽는다. 소수는 버리고, 그 결과가 1 이상일 때만 채택한다(아니면 24시간).
 * Redis seq 키의 sliding TTL 이고, 같은 값을 실행 단위 메모리 항목의 유휴 TTL 로도 쓴다. 미러가 Redis 키보다
 * 먼저 사라지지 않게 하려는 것이다. `0.5` 처럼 버리면 0 이 되는 값을 받으면 메모리 Map 생성이 실패하므로
 * 버린 뒤의 값으로 판단한다.
 */
export function resolveExecutionSeqTtlSeconds(): number {
  const seconds = Math.floor(Number(process.env.EXECUTION_SEQ_TTL_SECONDS));
  return Number.isFinite(seconds) && seconds > 0
    ? seconds
    : DEFAULT_SEQ_KEY_TTL_SECONDS;
}

/** 로그 인젝션 방지 — executionId 의 CR/LF/탭을 공백으로 바꾸고(기타 C0 생략) 길이를 128자로 자른다. */
export function sanitizeExecutionIdForLog(value: string): string {
  return String(value)
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, 128);
}

/**
 * 상한 때문에 항목을 지웠을 때 남길 경고 문장을 만든다. 두 서비스가 같은 형식과 sanitize 를 쓰게 한다.
 *
 * @param label 지운 항목의 이름(예: `seq 미러`, `routing context`)
 * @param evicted 지운 executionId 목록. 비어 있으면 호출하지 않는다.
 */
export function formatEvictionWarning(
  label: string,
  evicted: readonly string[],
): string {
  return `${label} 상한(${EXECUTION_MEMORY_MAX_ENTRIES}) 초과로 ${evicted.length}건 회수: ${evicted
    .map(sanitizeExecutionIdForLog)
    .join(', ')}`;
}
