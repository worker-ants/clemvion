/*
 * 노드 `config` 안의 통합 참조(CLE-PLAT-DATA 「참조의 소속」 의 「통합 참조」). 참조의 자리는 그 목록 하나가 정하고 백엔드는
 * 참조를 꺼내는 코드를 이 파일에 둔다. 저장 검사(노드 생성 · 수정, 캔버스 저장)와 참조 비우기(복제 · 가져오기 · 버전 복원)가
 * 모두 이 함수들로 참조를 꺼내고 비운다. 노드가 통합을 참조하는 자리가 새로 생기면 여기와 스펙 목록에 함께 더한다.
 *
 * 노드 스키마에서 `integration-selector` · `mcp-server-selector` 위젯이 붙은 필드가 이 자리와 같은지는
 * `node-integration-refs.spec.ts` 가 노드 스키마 전체를 돌며 확인한다.
 */

const MCP_SERVERS_FIELD = 'mcpServers';

/** `config.integrationId` 로 통합을 참조하는 노드. */
export const INTEGRATION_ID_REF_NODE_TYPES: ReadonlySet<string> = new Set([
  'send_email',
  'database_query',
  'http_request',
  'cafe24',
  'makeshop',
]);

/** `config.mcpServers[].integrationId` 로 통합을 참조하는 노드. */
export const MCP_SERVER_REF_NODE_TYPES: ReadonlySet<string> = new Set([
  'ai_agent',
]);

/**
 * 참조 자리의 노드 안 경로. 응답의 `field`(`ClearedIntegrationRef.field`)와 {@link clearNodeIntegrationRefs} 의 `fields` 가 이
 * 형식을 쓰므로 경로 문자열은 여기서만 만든다.
 */
export const INTEGRATION_ID_FIELD = 'config.integrationId';

/** `config.mcpServers[index].integrationId` 의 경로. `index` 는 비우기 전 순서다. */
export function mcpServerRefField(index: number): string {
  return `config.${MCP_SERVERS_FIELD}[${index}].integrationId`;
}

/** 참조가 선 자리 — `config.integrationId` 는 `integrationId`, `config.mcpServers[]` 의 항목은 `mcpServer`. */
export type NodeIntegrationRefKind = 'integrationId' | 'mcpServer';

/** 노드 안의 통합 참조 하나. */
export interface NodeIntegrationRef {
  kind: NodeIntegrationRefKind;
  /** 노드 안의 경로. {@link INTEGRATION_ID_FIELD} 또는 {@link mcpServerRefField}(`j` 는 비우기 전 순서). */
  field: string;
  /**
   * 참조한 통합 id. 값이 문자열이 아니면 `null` 이다. 어느 통합도 가리키지 못하므로 부르는 쪽은 없는 통합과 같이 다룬다.
   */
  integrationId: string | null;
  /** 참조 값이 표현식(`{{ }}`)이다. 저장할 때는 어떤 통합인지 알 수 없어 판정하지 않는다. */
  expression: boolean;
}

/** 저장된 같은 id 의 노드. 바뀐 참조를 가릴 때 기준선이다. */
export interface StoredNodeConfig {
  type: string;
  config: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 고르지 않은 자리(키 없음 · `null` · 빈 문자열)면 `undefined`, 아니면 참조 하나. */
function refAt(
  kind: NodeIntegrationRefKind,
  field: string,
  value: unknown,
): NodeIntegrationRef | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    return { kind, field, integrationId: null, expression: false };
  }
  return {
    kind,
    field,
    integrationId: value,
    expression: value.includes('{{'),
  };
}

/**
 * 바뀐 참조를 가릴 때 쓰는 값. 문자열이 아닌 값도 그 값 그대로 견주려고 JSON 으로 바꾼다. 문자열도 따옴표가 붙은 채라
 * 숫자 `123` 과 문자열 `"123"` 이 같은 값으로 보이지 않는다.
 */
function comparable(value: unknown): string {
  return JSON.stringify(value);
}

function usesIntegrationIdRef(type: string, config: Record<string, unknown>) {
  if (!INTEGRATION_ID_REF_NODE_TYPES.has(type)) return false;
  // HTTP Request 는 `authentication='integration'` 일 때만 이 값을 실행에 쓴다.
  return type !== 'http_request' || config.authentication === 'integration';
}

/** 참조와 그 자리의 원본 값. 바뀐 참조를 가릴 때 정규화 전의 값을 견주려고 함께 들고 다닌다. */
interface RefEntry {
  ref: NodeIntegrationRef;
  /** 저장된 `config` 에 있던 그대로의 값. `ref.integrationId` 는 문자열이 아니면 `null` 로 정규화된 값이다. */
  raw: unknown;
}

function collectRefEntries(type: string, config: unknown): RefEntry[] {
  if (!isRecord(config)) return [];
  const entries: RefEntry[] = [];
  const push = (ref: NodeIntegrationRef | undefined, raw: unknown) => {
    if (ref) entries.push({ ref, raw });
  };
  if (usesIntegrationIdRef(type, config)) {
    push(
      refAt('integrationId', INTEGRATION_ID_FIELD, config.integrationId),
      config.integrationId,
    );
  }
  if (MCP_SERVER_REF_NODE_TYPES.has(type)) {
    const servers = config[MCP_SERVERS_FIELD];
    // 목록 자체가 표현식이면 항목을 알 수 없다. 저장 검사도 비우기도 판정하지 않는다.
    if (Array.isArray(servers)) {
      servers.forEach((item, j) => {
        if (!isRecord(item)) return;
        push(
          refAt('mcpServer', mcpServerRefField(j), item.integrationId),
          item.integrationId,
        );
      });
    }
  }
  return entries;
}

/** 노드의 통합 참조를 모두 꺼낸다. 표현식 참조도 `expression: true` 로 함께 돌려준다. */
export function extractNodeIntegrationRefs(
  type: string,
  config: unknown,
): NodeIntegrationRef[] {
  return collectRefEntries(type, config).map((entry) => entry.ref);
}

/**
 * 새로 넣거나 바꾼 참조만 돌려준다(CLE-PLAT-DATA 「참조의 소속」). `stored` 가 없으면(새 노드) 모든 참조가 새 참조다.
 *
 * - `config.integrationId` 는 저장된 값과 다르면 바뀐 참조다. HTTP Request 가 `authentication` 을 `integration` 으로 바꾸면
 *   남아 있던 값이 그때부터 쓰이므로 바뀐 참조로 본다.
 * - `config.mcpServers` 는 항목들의 `integrationId` 집합을 비교하고 순서는 보지 않는다. 저장된 집합에 없던 값만 돌려준다.
 */
export function changedNodeIntegrationRefs(
  type: string,
  config: unknown,
  stored: StoredNodeConfig | undefined,
): NodeIntegrationRef[] {
  const current = collectRefEntries(type, config);
  if (!stored) return current.map((entry) => entry.ref);
  const before = collectRefEntries(stored.type, stored.config);
  // 문자열이 아닌 값도 바뀐 값으로 가르려고 두 갈래 모두 정규화 전의 원본 값을 견준다.
  const beforeIntegrationId = before.find(
    (entry) => entry.ref.kind === 'integrationId',
  );
  const beforeServerValues = new Set(
    before
      .filter((entry) => entry.ref.kind === 'mcpServer')
      .map((entry) => comparable(entry.raw)),
  );
  return current
    .filter((entry) =>
      entry.ref.kind === 'integrationId'
        ? beforeIntegrationId === undefined ||
          comparable(beforeIntegrationId.raw) !== comparable(entry.raw)
        : !beforeServerValues.has(comparable(entry.raw)),
    )
    .map((entry) => entry.ref);
}

/**
 * `fields` 에 든 참조를 비운 `config` 사본을 돌려준다(CLE-PLAT-DATA 「참조의 소속」 의 «비울 때»). `config.integrationId` 는
 * 키를 지우고, MCP 서버 항목은 항목째 뺀다. 그 항목의 노출 도구 목록과 토글도 함께 빠진다. 입력은 바꾸지 않는다.
 */
export function clearNodeIntegrationRefs(
  config: Record<string, unknown>,
  fields: ReadonlySet<string>,
): Record<string, unknown> {
  if (fields.size === 0) return config;
  const next: Record<string, unknown> = { ...config };
  if (fields.has(INTEGRATION_ID_FIELD)) delete next.integrationId;
  const servers = next[MCP_SERVERS_FIELD];
  if (Array.isArray(servers)) {
    next[MCP_SERVERS_FIELD] = servers.filter(
      (_item, j) => !fields.has(mcpServerRefField(j)),
    );
  }
  return next;
}
