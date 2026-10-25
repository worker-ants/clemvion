import {
  isLiteralReference,
  type IntegrationUse,
} from '../../../modules/integrations/personal-integration-use.js';

/*
 * AI 에이전트 MCP 서버 항목(`mcpServers[]`)의 실행 시점 조회 인자(CLE-NODE-INT-COMMON 「IntegrationsService API (실행
 * 엔진용)」, CLE-EXEC-STATE 「보존 예외 `_resumeCheckpoint`」).
 *
 * 핸들러는 첫 턴에 평가 전 원본과 평가한 값을 비교해 항목마다 `fromExpression` 을 정해 싣는다. 재개 · 재시도 턴은 실행
 * 컨텍스트 없이 들어오므로 그 값을 상태 · 체크포인트로 이어 받는다. 도구 프로바이더는 도구 목록을 만들 때 항목의 값을 읽는다.
 */

/** 서버 항목에 싣는 키. 사용자 설정에 같은 키가 있어도 핸들러가 덮어쓴다. */
export const MCP_SERVER_FROM_EXPRESSION_KEY = 'fromExpression';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withFromExpression(item: unknown, fromExpression: boolean): unknown {
  if (!isRecord(item)) return item;
  return { ...item, [MCP_SERVER_FROM_EXPRESSION_KEY]: fromExpression };
}

/**
 * 평가한 서버 항목마다 `fromExpression` 을 정한 사본을 돌려준다. 원본이 배열이 아니거나(목록 자체가 표현식인 경우
 * 포함) 평가한 목록과 길이가 다르면 모든 항목이 표현식이다. 길이가 같으면 같은 순서의 항목끼리 비교하고, 원본 항목이 객체가
 * 아니면 그 항목은 표현식이다. 리터럴인지는 {@link isLiteralReference} 가 본다.
 *
 * `rawServers` 에는 평가 전 원본(첫 턴은 `context.rawConfig`, 재시도 재진입은 `node.config`)을 넘긴다. 평가가 끝난
 * `config` 로 폴백하면 표현식 참조가 리터럴로 보인다.
 */
export function markMcpServerRefOrigins(
  rawServers: unknown,
  evaluatedServers: readonly unknown[],
): unknown[] {
  const aligned =
    Array.isArray(rawServers) && rawServers.length === evaluatedServers.length;
  return evaluatedServers.map((item, i) => {
    const rawItem: unknown = aligned ? rawServers[i] : undefined;
    const literal =
      isRecord(rawItem) &&
      isRecord(item) &&
      isLiteralReference(rawItem.integrationId, item.integrationId);
    return withFromExpression(item, !literal);
  });
}

/**
 * 도구 프로바이더가 서버 항목 하나를 조회할 때 넘기는 `use`. 값이 `false` 일 때만 리터럴이다. 값이 없는 옛 항목(이 규칙 전에
 * 저장한 체크포인트 · `_retryState`)은 표현식으로 본다. `nodeId` 가 없으면 작성자를 알 수 없어 개인 통합은 거절된다.
 */
export function mcpServerRefUse(
  nodeId: string | null | undefined,
  ref: unknown,
): IntegrationUse {
  const flag = isRecord(ref) ? ref[MCP_SERVER_FROM_EXPRESSION_KEY] : undefined;
  return { nodeId: nodeId ?? null, fromExpression: flag !== false };
}
