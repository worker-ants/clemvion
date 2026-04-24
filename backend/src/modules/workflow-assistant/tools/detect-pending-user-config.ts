/**
 * 노드 config 에는 LLM 이 값을 모르는 — 그래서 사용자가 직접 골라야만 하는 —
 * 필드가 있다. 예: `send_email.integrationId` (사용자 워크스페이스의 SMTP
 * Integration), `ai_agent.llmConfigId` (LLM 설정), `ai_agent.knowledgeBaseIds`
 * (KB 자원), `workflow.workflowId` (참조할 워크플로우). 어시스턴트가 노드를
 * 심어 놓고도 이 필드를 비워둔 채 대화를 끝내면 사용자는 실행 시점에 와서야
 * 알게 된다.
 *
 * 이 헬퍼는 노드의 `configSchema` (zod → JSON Schema 로 변환된 객체) 를 순회해
 * `ui.widget` 마커가 "사용자 입력 필요" 계열인 필드를 찾고, 현재 config 에서
 * 비어있는 것만 리스트로 반환한다. 리턴된 리스트는 tool_result 에 실려 LLM 에게
 * 되돌아가고, LLM 은 턴을 마치기 전 사용자에게 "X는 직접 설정해 주세요" 로
 * 안내해야 한다 (시스템 프롬프트에 연결된 규칙).
 */

export type UserActionWidget =
  | 'integration-selector'
  | 'llm-config-selector'
  | 'kb-selector'
  | 'workflow-selector';

const USER_ACTION_WIDGETS: ReadonlySet<string> = new Set<UserActionWidget>([
  'integration-selector',
  'llm-config-selector',
  'kb-selector',
  'workflow-selector',
]);

/**
 * `integrationServiceType` hint 는 serviceType DB 필터로 직결되므로, schema
 * meta 에 실릴 수 있는 값을 화이트리스트로 제한한다 (review W-4). 노드 스펙
 * 에 새 integration 종류가 생기면 여기 tuple 에만 추가하면 양 단의 타입/
 * validator 가 자동으로 갱신된다.
 */
export const SUPPORTED_INTEGRATION_SERVICE_TYPES = [
  'email',
  'http',
  'database',
] as const;

export type IntegrationServiceType =
  (typeof SUPPORTED_INTEGRATION_SERVICE_TYPES)[number];

const SUPPORTED_INTEGRATION_SERVICE_TYPE_SET: ReadonlySet<string> = new Set(
  SUPPORTED_INTEGRATION_SERVICE_TYPES,
);

/**
 * Candidate picker 에 표시할 개별 후보. ED-AI-39 (spec §4.3.1) 에 따라
 * 서버가 워크스페이스에서 조회해 `PendingUserConfigField.candidates` 에
 * 채워 내려준다.
 */
export interface CandidateEntry {
  /** 실제 id (integration.id · llm_config.id · knowledge_base.id · workflow.id). */
  id: string;
  /** 드롭다운에 표시할 주 텍스트. */
  label: string;
  /** 보조 텍스트 (예: integration 의 serviceType, LLM Config 의 model). */
  sublabel?: string;
}

export interface PendingUserConfigField {
  /** 필드 경로 (현재는 top-level 만 지원 — 실제 사용자 선택 필드는 모두 top-level). */
  field: string;
  /** 어떤 종류의 선택이 필요한지. 사용자에게 설명할 때 맥락이 된다. */
  widget: UserActionWidget;
  /** schema 에 선언된 한글/영문 라벨. */
  label: string;
  /**
   * widget 별 후보 조회 hint. 현재는 `integration-selector` 전용으로
   * schema meta 의 `integrationServiceType` 값(예: `'email'`/`'http'`) 이
   * 들어온다. CandidateLookupService 가 이 값으로 `Integration.service_type`
   * 필터링한다. 값이 없으면 connected 전체가 후보. 값은 화이트리스트
   * (`SUPPORTED_INTEGRATION_SERVICE_TYPES`) 로 제한된다.
   */
  integrationServiceType?: IntegrationServiceType;
  /**
   * 서버가 워크스페이스에서 조회한 후보 목록. `detectPendingUserConfig` 는
   * 빈 배열로만 초기화하고, 실제 조회는 `CandidateLookupService` 가 담당.
   * 빈 배열(`[]`) 은 "조회했지만 후보가 없음" 의 명시적 신호라
   * `undefined` 와 의미가 다르다.
   */
  candidates: CandidateEntry[];
}

interface JsonSchemaLike {
  type?: string | string[];
  properties?: Record<string, JsonSchemaLike>;
  items?: JsonSchemaLike;
  ui?: { widget?: string; label?: string };
  /** `.meta({ integrationServiceType })` 로 주입된 picker hint. */
  integrationServiceType?: string;
  // z.toJSONSchema 는 draft-2020 형식을 쓰므로 `$ref` 등이 있을 수 있지만,
  // 노드 config 에서는 inline 객체만 써왔다. 필요 시 확장.
}

/**
 * 스키마와 현재 config 를 받아 "비어있는 user-action 필드" 목록을 반환.
 * 값 판정 규칙:
 *  - 문자열: 트림 후 길이가 0 이면 비어있음
 *  - 배열: 길이가 0 이면 비어있음
 *  - undefined / null: 비어있음
 *  - 그 외: 값이 있는 것으로 간주 (boolean/number/object 등)
 */
export function detectPendingUserConfig(
  configSchema: unknown,
  config: Record<string, unknown>,
): PendingUserConfigField[] {
  const schema = configSchema as JsonSchemaLike | undefined;
  if (!schema?.properties) return [];

  const pending: PendingUserConfigField[] = [];
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const widget = propSchema?.ui?.widget;
    if (!widget || !USER_ACTION_WIDGETS.has(widget)) continue;
    if (!isEmptyValue(config[key])) continue;
    pending.push({
      field: key,
      widget: widget as UserActionWidget,
      label: propSchema?.ui?.label ?? humanize(key),
      // `detectPendingUserConfig` 단계에서는 스키마만 보고 "이 필드가
      // selector 인지" 만 판정한다. 실제 후보 목록은 `CandidateLookupService`
      // 가 워크스페이스 DB 를 조회해 채우므로, 여기서는 hint 만 통과시키고
      // `candidates: []` 로 초기화한다. hint 는 화이트리스트 검증해서
      // 임의 문자열이 DB 필터로 직결되지 않게 한다 (review W-4).
      ...(typeof propSchema?.integrationServiceType === 'string' &&
      SUPPORTED_INTEGRATION_SERVICE_TYPE_SET.has(
        propSchema.integrationServiceType,
      )
        ? {
            integrationServiceType:
              propSchema.integrationServiceType as IntegrationServiceType,
          }
        : {}),
      candidates: [],
    });
  }
  return pending;
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}
