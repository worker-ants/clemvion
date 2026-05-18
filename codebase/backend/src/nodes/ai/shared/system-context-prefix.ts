/**
 * AI 노드 시스템 프롬프트 자동 prefix (System Context Prefix) — 3 AI 노드
 * (AI Agent / Text Classifier / Information Extractor) 공통 헬퍼.
 *
 * Spec: spec/4-nodes/3-ai/0-common.md §11.
 *
 * systemPrompt 앞에 현재 시각·timezone 을 자동 prepend 하여 LLM 의 시각 추론
 * (예: "어제 자정", "최근 7일") 이 timezone 모호성에 빠지지 않게 한다. Cafe24
 * MCP 도구 description 의 KST suffix 와 함께 두 채널로 LLM 에 timezone 정보를
 *전달하는 한 묶음 결정 (2026-05-18).
 */

import type { ExecutionContext } from '../../core/node-handler.interface.js';

export type SystemContextSection = 'time' | 'timezone' | 'workspace' | 'node';

export const SYSTEM_CONTEXT_DEFAULT_INCLUDE = true;
export const SYSTEM_CONTEXT_DEFAULT_SECTIONS: readonly SystemContextSection[] = [
  'time',
  'timezone',
];

const ALL_SECTIONS: readonly SystemContextSection[] = [
  'time',
  'timezone',
  'workspace',
  'node',
];

export interface BuildSystemContextPrefixArgs {
  /** Execution 단위 frozen 시각. `$now` 와 동일 epoch. UTC absolute. */
  now: Date;
  /** Workspace.settings.timezone (IANA) → process.env.TZ → 'UTC' SoT 결과. */
  timezone: string;
  workspace?: {
    id?: string;
    name?: string;
  };
  node?: {
    id?: string;
    label?: string;
    type?: string;
  };
  /** 활성 섹션 목록. 빈 배열은 prefix 미생성. */
  sections: readonly SystemContextSection[];
}

/**
 * §11.3 SoT precedence: Workspace.settings.timezone → process.env.TZ → 'UTC'.
 * 각 단계의 결과 IANA name 으로 Intl.DateTimeFormat 검증하고 실패 시 다음 단계로
 * fall through.
 */
export function resolveSystemContextTimezone(
  workspaceTimezone?: string,
): string {
  const candidates = [workspaceTimezone, process.env.TZ, 'UTC'];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isValidIanaTimezone(candidate)) return candidate;
  }
  return 'UTC';
}

function isValidIanaTimezone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/**
 * §11.2 섹션별 출력 — `## System Context` 헤더 + bullet line 으로 구성.
 * 빈 sections 또는 모든 섹션의 출력이 빈 경우 빈 문자열 반환.
 *
 * @returns prefix 본문. 비어있지 않으면 끝에 `\n\n` 두 줄을 포함해 호출자가
 *   사용자 systemPrompt 앞에 그대로 concat 할 수 있도록 한다.
 */
export function buildSystemContextPrefix(
  args: BuildSystemContextPrefixArgs,
): string {
  if (!args.sections || args.sections.length === 0) return '';

  const lines: string[] = [];
  const seen = new Set<SystemContextSection>();
  for (const section of args.sections) {
    if (seen.has(section)) continue;
    seen.add(section);
    const line = renderSection(section, args);
    if (line) lines.push(line);
  }
  if (lines.length === 0) return '';

  return `## System Context\n${lines.join('\n')}\n\n`;
}

function renderSection(
  section: SystemContextSection,
  args: BuildSystemContextPrefixArgs,
): string {
  switch (section) {
    case 'time':
      return `- Current time: ${formatIsoWithTimezone(args.now, args.timezone)}`;
    case 'timezone':
      return `- Timezone: ${args.timezone} (${formatUtcOffsetLabel(args.now, args.timezone)})`;
    case 'workspace': {
      const id = args.workspace?.id ?? '';
      const name = args.workspace?.name ?? '';
      if (!id && !name) return '';
      const label = name || '(unnamed)';
      return id
        ? `- Workspace: ${label} (id: ${id})`
        : `- Workspace: ${label}`;
    }
    case 'node': {
      const id = args.node?.id ?? '';
      const label = args.node?.label ?? '';
      const type = args.node?.type ?? '';
      if (!id && !label && !type) return '';
      const head = label || '(unlabeled)';
      const meta: string[] = [];
      if (type) meta.push(`type: ${type}`);
      if (id) meta.push(`id: ${id}`);
      return meta.length > 0
        ? `- Node: ${head} (${meta.join(', ')})`
        : `- Node: ${head}`;
    }
  }
}

/**
 * Date 를 IANA timezone 기준 ISO 8601 (offset designator 포함) 으로 출력.
 * 예: `2026-05-18T12:45:12+09:00` (KST), `2026-05-18T03:45:12Z` (UTC).
 */
export function formatIsoWithTimezone(date: Date, timezone: string): string {
  const parts = getPartsInTimezone(date, timezone);
  if (!parts) return date.toISOString(); // fallback — should not happen
  const offset = computeOffsetMinutes(date, timezone);
  const offsetLabel = formatOffsetIsoSuffix(offset);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offsetLabel}`;
}

/**
 * `UTC+9` / `UTC-5` / `UTC+5:30` 형식 — §11.2 timezone 행 표기.
 */
export function formatUtcOffsetLabel(date: Date, timezone: string): string {
  const offset = computeOffsetMinutes(date, timezone);
  if (offset === 0) return 'UTC';
  const sign = offset > 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}

function getPartsInTimezone(
  date: Date,
  timezone: string,
):
  | {
      year: string;
      month: string;
      day: string;
      hour: string;
      minute: string;
      second: string;
    }
  | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    const hour = get('hour') === '24' ? '00' : get('hour'); // chromium edge case
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour,
      minute: get('minute'),
      second: get('second'),
    };
  } catch {
    return null;
  }
}

function computeOffsetMinutes(date: Date, timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });
    const parts = fmt.formatToParts(date);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (!offsetPart) return 0;
    // "GMT+09:00" / "GMT-05:00" / "GMT" / "GMT+05:30"
    const match = offsetPart.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) return 0;
    const [, sign, hours, minutes] = match;
    const h = parseInt(hours, 10);
    const m = minutes ? parseInt(minutes, 10) : 0;
    const total = h * 60 + m;
    return sign === '+' ? total : -total;
  } catch {
    return 0;
  }
}

function formatOffsetIsoSuffix(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'Z';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

/**
 * 노드 config 에서 §11.1 의 두 필드를 normalize 한다. default 적용 정책:
 * - `includeSystemContext` 부재/`undefined` → `true`
 * - `systemContextSections` 부재/`undefined` → `['time', 'timezone']`
 * - `systemContextSections: []` → `includeSystemContext: false` 와 동등 (빈 prefix)
 *
 * Spec: §11.1 "기존 row 해석 정책" — config 에 두 필드가 없으면 default 로 해석.
 */
export function normalizeSystemContextConfig(config: Record<string, unknown>): {
  enabled: boolean;
  sections: readonly SystemContextSection[];
} {
  const includeRaw = config['includeSystemContext'];
  const enabled =
    includeRaw === undefined
      ? SYSTEM_CONTEXT_DEFAULT_INCLUDE
      : Boolean(includeRaw);
  if (!enabled) return { enabled: false, sections: [] };
  const sectionsRaw = config['systemContextSections'];
  let sections: readonly SystemContextSection[] = SYSTEM_CONTEXT_DEFAULT_SECTIONS;
  if (Array.isArray(sectionsRaw)) {
    sections = sectionsRaw.filter((v): v is SystemContextSection =>
      ALL_SECTIONS.includes(v as SystemContextSection),
    );
  }
  return { enabled: sections.length > 0, sections };
}

/**
 * Handler 에서 호출하는 1-step API. ExecutionContext 와 config 로부터 prefix 본문
 * 을 만들어 사용자 systemPrompt 의 앞에 prepend 할 수 있는 문자열을 반환한다.
 * default 가 적용된 정상 경로에서 비어있지 않다. config 가 명시적으로 비활성화한
 * 경우 빈 문자열 반환.
 */
export function buildSystemContextPrefixFromContext(args: {
  context: ExecutionContext;
  config: Record<string, unknown>;
  now: Date;
}): string {
  const { enabled, sections } = normalizeSystemContextConfig(args.config);
  if (!enabled) return '';
  const variables = args.context.variables as Record<string, unknown>;
  const workspaceTimezone =
    typeof variables['__workspaceTimezone'] === 'string'
      ? (variables['__workspaceTimezone'] as string)
      : undefined;
  const timezone = resolveSystemContextTimezone(workspaceTimezone);
  return buildSystemContextPrefix({
    now: args.now,
    timezone,
    workspace: {
      id:
        typeof variables['__workspaceId'] === 'string'
          ? (variables['__workspaceId'] as string)
          : undefined,
    },
    node: {
      id: args.context.nodeId,
    },
    sections,
  });
}
