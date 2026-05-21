/**
 * AI 노드 §11 (System Context Prefix) zod schema fragment 공통 헬퍼.
 *
 * Spec: spec/4-nodes/3-ai/0-common.md §11.
 *
 * AI Agent / Text Classifier / Information Extractor 3 노드 schema 가 동일한
 * `includeSystemContext` + `systemContextSections` 쌍을 갖는다. 각 노드의 다른
 * 필드들과의 표시 순서 (`order`) 만 다르므로 본 헬퍼는 `(orderStart, group)` 을
 * 받아 그 노드의 schema 객체 spread 에 그대로 쓸 수 있는 2 필드 fragment 를
 * 반환한다.
 *
 * SoT: 본 헬퍼 — 라벨·hint·options·default 가 단일 진실. 3 노드 schema 의 UI
 *      라벨이 sync 를 잃지 않도록 한다.
 */

import { z } from 'zod';
import {
  SYSTEM_CONTEXT_DEFAULT_INCLUDE,
  SYSTEM_CONTEXT_DEFAULT_SECTIONS,
} from './system-context-prefix.js';

const SECTION_OPTIONS = [
  { value: 'time', label: 'Current time (ISO 8601 with offset)' },
  { value: 'timezone', label: 'Timezone (IANA + UTC offset)' },
  { value: 'workspace', label: 'Workspace id / name' },
  { value: 'node', label: 'Node id / label / type' },
] as const;

const INCLUDE_HINT =
  'Prepend current time + timezone to the system prompt so the LLM avoids KST/UTC drift.';

/**
 * 3 AI 노드 schema 의 §11 fragment 를 생성한다.
 *
 * @param orderStart `includeSystemContext` 의 UI order. `systemContextSections`
 *                   는 자동으로 `orderStart + 1`.
 * @param group      UI 그룹 라벨. default `'System Context'`.
 */
export function buildSystemContextSchemaFields(
  orderStart: number,
  group: string = 'System Context',
) {
  return {
    includeSystemContext: z
      .boolean()
      .default(SYSTEM_CONTEXT_DEFAULT_INCLUDE)
      .meta({
        ui: {
          label: 'Include System Context',
          widget: 'checkbox',
          order: orderStart,
          group,
          hint: INCLUDE_HINT,
        },
      }),
    systemContextSections: z
      .array(z.enum(['time', 'timezone', 'workspace', 'node']))
      .default([...SYSTEM_CONTEXT_DEFAULT_SECTIONS])
      .meta({
        ui: {
          label: 'Context Sections',
          widget: 'multiselect',
          order: orderStart + 1,
          group,
          options: [...SECTION_OPTIONS],
          visibleWhen: { field: 'includeSystemContext', equals: true },
        },
      }),
  };
}

/**
 * spec §11.7 — 3 AI 핸들러가 NodeHandlerOutput.config 를 빌드할 때 spread 로
 * 합성할 §11 echo 슬라이스를 반환. 사용자가 명시 변경한 경우에만 키를 노출,
 * default 값과 일치하면 키 자체를 생략 (CONVENTIONS Principle 7 optional 필드
 * echo 규약 정합).
 *
 * 비교 규칙:
 * - `includeSystemContext`: undefined 이거나 default (`true`) 이면 생략. `false`
 *   는 명시 opt-out 으로 보고 echo.
 * - `systemContextSections`: undefined 이거나 default 와 *같은 멤버 set* 이면
 *   생략 (순서·중복 무시). default 의 부분집합 / 다른 멤버 / 빈 배열은 모두 명시
 *   변경으로 보고 echo.
 * - `includeSystemContext` 가 명시 `false` 인 경우 sections 가 default 와 같아도
 *   같이 생략 (의미상 무의미한 noise 회피).
 *
 * 사용 예: `const configEcho = { ...rest, ...pickNonDefaultSystemContext(rawConfig) };`
 */
export function pickNonDefaultSystemContext(
  rawConfig: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!rawConfig || typeof rawConfig !== 'object') return {};
  const result: Record<string, unknown> = {};
  const include = rawConfig['includeSystemContext'];
  const sections = rawConfig['systemContextSections'];

  const includeIsExplicitOptOut =
    include !== undefined && include !== SYSTEM_CONTEXT_DEFAULT_INCLUDE;
  if (includeIsExplicitOptOut) {
    result['includeSystemContext'] = include;
    return result;
  }
  if (sections !== undefined && !isDefaultSectionSet(sections)) {
    result['systemContextSections'] = sections;
  }
  return result;
}

function isDefaultSectionSet(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v !== 'string') return false;
    seen.add(v);
  }
  if (seen.size !== SYSTEM_CONTEXT_DEFAULT_SECTIONS.length) return false;
  for (const def of SYSTEM_CONTEXT_DEFAULT_SECTIONS) {
    if (!seen.has(def)) return false;
  }
  return true;
}
