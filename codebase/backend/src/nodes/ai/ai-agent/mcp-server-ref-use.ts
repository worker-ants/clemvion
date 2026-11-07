import {
  isLiteralReference,
  type IntegrationUse,
} from '../../../modules/integrations/personal-integration-use.js';

/*
 * AI 에이전트 MCP 서버의 실행 시점 조회 인자(CLE-NODE-INT-COMMON 「IntegrationsService API (실행 엔진용)」,
 * CLE-EXEC-STATE 「보존 예외 `_resumeCheckpoint`」).
 *
 * 핸들러는 첫 턴에 평가 전 원본과 평가한 값을 비교해 서버마다 통합 참조가 표현식이었는지 정한다. 결과는 서버 항목 안이 아니라
 * 목록과 길이가 같은 평행 배열 `mcpServerFromExpression` 에 담는다. 서버 항목은 사용자 설정과 모양이 같아서 항목 안에 두면
 * 이 함수를 거치지 않고 설정을 싣는 경로가 사용자가 넣은 값을 그대로 넘긴다. 배열은 그런 경로에 없으므로 모든 서버가
 * 표현식으로 판정된다(닫힌 쪽 실패). 재개 · 재시도 턴은 실행 컨텍스트 없이 들어오므로 목록과 배열을 상태 · 체크포인트로
 * 함께 이어 받는다. 도구 프로바이더는 도구 목록을 만들 때 {@link mcpServerRefUse} 로 배열만 읽는다.
 */

/** 옛 체크포인트가 서버 항목 안에 싣던 키. {@link liftLegacyMcpServerFromExpression} 만 읽는다. */
const LEGACY_FROM_EXPRESSION_KEY = 'fromExpression';

/** 서버 목록과 같은 위치의 표현식 여부. `_resumeState` · `_resumeCheckpoint` · `_retryState` 에 함께 싣는다. */
export interface McpServerOrigins {
  /** `fromExpression` 키를 지운 서버 목록. */
  mcpServers: unknown[];
  /** i 번째 값이 i 번째 서버의 통합 참조가 평가 전 원본에서 표현식이었는지다. */
  mcpServerFromExpression: boolean[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 서버 항목에서 `fromExpression` 키를 지운 사본. 키가 없거나 객체가 아니면 그대로 돌려준다. */
function withoutFromExpression(item: unknown): unknown {
  if (!isRecord(item) || !(LEGACY_FROM_EXPRESSION_KEY in item)) return item;
  const { [LEGACY_FROM_EXPRESSION_KEY]: _dropped, ...rest } = item;
  return rest;
}

/**
 * 평가한 서버 목록과 그 표현식 여부 배열을 돌려준다. 원본이 배열이 아니거나(목록 자체가 표현식인 경우 포함) 평가한 목록과
 * 길이가 다르면 모든 항목이 표현식이다. 길이가 같으면 같은 순서의 항목끼리 비교하고, 원본 항목이나 평가한 항목이 객체가
 * 아니면 그 항목은 표현식이다. 리터럴인지는 {@link isLiteralReference} 가 본다.
 *
 * 돌려주는 서버 항목에서는 `fromExpression` 키를 지운다. 사용자 설정에 같은 키가 있어도 판정에 쓰지 않고, 롤링 배포 중
 * 항목의 키를 읽는 옛 인스턴스가 사용자 값을 믿지 않게 하려는 것이다.
 *
 * `evaluatedServers` 가 배열이 아니면 서버가 없는 것으로 보고 빈 목록을 돌려준다. 세 호출 지점(첫 턴 도구 구성 · 상태
 * 저장 · 체크포인트 재구성)이 이 규칙을 같이 쓰도록 호출 쪽이 아니라 여기서 정한다.
 *
 * `rawServers` 에는 평가 전 원본(첫 턴은 `context.rawConfig`, 재시도 재진입은 `node.config`)을 넘긴다. 평가가 끝난
 * `config` 로 폴백하면 표현식 참조가 리터럴로 보인다.
 */
export function markMcpServerRefOrigins(
  rawServers: unknown,
  evaluatedServers: unknown,
): McpServerOrigins {
  if (!Array.isArray(evaluatedServers)) {
    return { mcpServers: [], mcpServerFromExpression: [] };
  }
  const aligned =
    Array.isArray(rawServers) && rawServers.length === evaluatedServers.length;
  const mcpServerFromExpression = evaluatedServers.map(
    (item: unknown, i): boolean => {
      const rawItem: unknown = aligned ? rawServers[i] : undefined;
      const literal =
        isRecord(rawItem) &&
        isRecord(item) &&
        isLiteralReference(rawItem.integrationId, item.integrationId);
      return !literal;
    },
  );
  return {
    mcpServers: evaluatedServers.map(withoutFromExpression),
    mcpServerFromExpression,
  };
}

/**
 * 표현식 여부 배열이 없는 옛 AI 재개 체크포인트 · `_retryState` 의 서버 목록을 새 형식으로 옮긴다. 항목 값이 `false` 인
 * 위치만 `false` 이고 나머지(값이 없거나 객체가 아닌 항목 포함)는 표현식이다. 옮긴 뒤 항목에서 그 키를 지운다.
 *
 * 서버 항목의 `fromExpression` 을 읽는 곳은 이 함수 하나다. 체크포인트 복원(`buildRetryReentryState`)에서 서버 목록이
 * 있고 배열이 없을 때만 부른다.
 */
export function liftLegacyMcpServerFromExpression(
  servers: readonly unknown[],
): McpServerOrigins {
  return {
    mcpServers: servers.map(withoutFromExpression),
    mcpServerFromExpression: servers.map(
      (item) => !(isRecord(item) && item[LEGACY_FROM_EXPRESSION_KEY] === false),
    ),
  };
}

/**
 * AI 재개 체크포인트 · `_retryState` 에서 서버 목록과 표현식 여부 배열을 다시 만든다(`buildRetryReentryState`).
 *
 * - 서버 목록이 없으면(`undefined` · `null`) `rawServers`(현재 `node.config`)와 `evaluatedServers`(그 평가값)로 첫 턴처럼
 *   둘 다 다시 정한다. 저장된 배열은 함께 저장된 목록과 짝이라 새 목록에 쓰지 않는다.
 * - 서버 목록이 배열이 아닌 값이면 서버가 없는 것으로 본다. 도구 프로바이더도 그렇게 읽는다.
 * - 서버 목록이 있고 배열이 없으면(`undefined` · `null`) 이 규칙 전에 저장한 행이다.
 *   {@link liftLegacyMcpServerFromExpression} 로 항목 값을 옮긴다.
 * - 둘 다 있으면 그대로 쓴다. 배열의 값은 `false` 만 남기고 나머지는 `true` 로 고친다. 배열이 배열이 아니면 모든 서버를
 *   표현식으로 본다. 길이가 목록과 다르면 길이를 그대로 둬 {@link mcpServerRefUse} 가 모든 서버를 표현식으로 보게 한다.
 */
export function restoreMcpServerOrigins(
  savedServers: unknown,
  savedFromExpression: unknown,
  rawServers: unknown,
  evaluatedServers: unknown,
): McpServerOrigins {
  if (savedServers === undefined || savedServers === null) {
    return markMcpServerRefOrigins(rawServers, evaluatedServers);
  }
  if (!Array.isArray(savedServers)) {
    return { mcpServers: [], mcpServerFromExpression: [] };
  }
  if (savedFromExpression === undefined || savedFromExpression === null) {
    return liftLegacyMcpServerFromExpression(savedServers);
  }
  return {
    mcpServers: savedServers,
    mcpServerFromExpression: Array.isArray(savedFromExpression)
      ? savedFromExpression.map((v: unknown) => v !== false)
      : savedServers.map(() => true),
  };
}

/**
 * 도구 프로바이더가 `index` 번째 서버를 조회할 때 넘기는 `use`. 표현식 여부 배열의 길이가 서버 수(`serverCount`)와 같고
 * 그 위치의 값이 `false` 일 때만 리터럴이다. 배열이 없거나 길이가 다르면 표식을 거치지 않은 목록으로 보고 모든 서버를
 * 표현식으로 본다. `nodeId` 가 없으면 작성자를 알 수 없어 개인 통합은 거절된다.
 */
export function mcpServerRefUse(
  nodeId: string | null | undefined,
  fromExpressionFlags: unknown,
  index: number,
  serverCount: number,
): IntegrationUse {
  const literal =
    Array.isArray(fromExpressionFlags) &&
    fromExpressionFlags.length === serverCount &&
    fromExpressionFlags[index] === false;
  return { nodeId: nodeId ?? null, fromExpression: !literal };
}
