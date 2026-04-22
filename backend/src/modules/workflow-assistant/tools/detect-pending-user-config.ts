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

export interface PendingUserConfigField {
  /** 필드 경로 (현재는 top-level 만 지원 — 실제 사용자 선택 필드는 모두 top-level). */
  field: string;
  /** 어떤 종류의 선택이 필요한지. 사용자에게 설명할 때 맥락이 된다. */
  widget: UserActionWidget;
  /** schema 에 선언된 한글/영문 라벨. */
  label: string;
}

interface JsonSchemaLike {
  type?: string | string[];
  properties?: Record<string, JsonSchemaLike>;
  items?: JsonSchemaLike;
  ui?: { widget?: string; label?: string };
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
