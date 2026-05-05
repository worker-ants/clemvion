import { isValidStablePortId } from './port-id.util';

/**
 * Auto-generated id for `carousel` / `chart` / `table` / `template` 노드의
 * buttons. F-2 정책 (2026-05-05 사용자 결정 B-1 label-slug):
 *   - 사용자/LLM 이 명시한 id 가 유효(slug regex 통과) 하면 그대로 보존
 *   - 비어있거나 invalid 면 label 을 kebab-case slug 로 변환해 부여
 *   - 동일 slug 충돌 시 `-2`/`-3` 접미사로 해소
 *   - label 도 비면 index fallback (`btn_${i}` / `itemBtn_${i}` /
 *     `items_${i}_btn_${j}`) — `resolve-dynamic-ports.ts` 와 동일
 *
 * 정책 의미:
 *   - 안정성: 사용자가 후속에 label 만 수정해도 slug 가 재생성되지 않는다
 *     (id 가 이미 살아있으면 보존). 따라서 기존 edge 가 깨지지 않는다.
 *   - 가독성: `btn_confirm`, `btn_cancel` 같은 의미 있는 id — system-prompt
 *     의 "Prefer short descriptive slugs over UUIDs" 권고와 일치.
 *
 * 마이그레이션: 기존 워크플로에서 id 가 비어있던 button entry 는
 * `backend/scripts/migrate-button-ids.ts` 가 resolver fallback id (`btn_0` 등)
 * 로 채워 edge 가 끊기지 않게 한다. 그 이후 update_node 가 다시 호출돼도 id 가
 * 살아있으므로 본 헬퍼는 그대로 통과시킨다.
 */

const LABEL_SLUG_TRIM_RE = /^-+|-+$/g;
const LABEL_SLUG_NON_ALNUM_RE = /[^a-zA-Z0-9]+/g;

export function labelToSlug(label: string): string {
  if (typeof label !== 'string') return '';
  const lowered = label.toLowerCase();
  const replaced = lowered.replace(LABEL_SLUG_NON_ALNUM_RE, '-');
  const trimmed = replaced.replace(LABEL_SLUG_TRIM_RE, '');
  return trimmed.slice(0, 64);
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  // 단순 slice(0,64) 는 base 가 64자일 때 base-2/-3 가 모두 동일하게 잘려
  // uniqueness 가 깨진다 (review W-1). 접미사 길이만큼 base 를 미리 줄여서
  // 결합한다.
  let n = 2;
  while (true) {
    const suffix = `-${n}`;
    const headroom = 64 - suffix.length;
    const candidate =
      base.length <= headroom
        ? `${base}${suffix}`
        : `${base.slice(0, headroom)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
    n++;
  }
}

interface ButtonLike {
  id?: unknown;
  label?: unknown;
  [key: string]: unknown;
}

// 단일 출처: port-id.util.isValidStablePortId. button-slug 와 마이그레이션
// 스크립트가 모두 동일 정의를 사용 (review W-10).
const isValidExistingId = isValidStablePortId;

/**
 * 단일 buttons 배열을 정규화. 살아있는 id 는 그대로 두고 비어있는 entry 는
 * label-slug + 충돌 해소 + fallback prefix 로 채운다.
 */
function normalizeButtonsArray(
  buttons: ButtonLike[],
  fallbackPrefix: (i: number) => string,
): { buttons: ButtonLike[]; changed: boolean } {
  const taken = new Set<string>();
  // Pass 1: 살아있는 id 는 미리 reserve 해 충돌 회피. null/undefined entry 는
  // skip — pass 2 에서 새 entry 로 대체된다 (review W-13).
  for (const b of buttons) {
    if (b && typeof b === 'object' && isValidExistingId(b.id)) {
      taken.add(b.id.trim());
    }
  }
  let changed = false;
  const result = buttons.map((b, i) => {
    if (b == null || typeof b !== 'object') {
      // null/undefined entry 방어 (review W-13). entry 자체가 invalid 면
      // fallback prefix 로 채운 신규 객체를 만들어 반환한다.
      changed = true;
      const candidate = uniqueSlug(fallbackPrefix(i), taken);
      taken.add(candidate);
      return { id: candidate };
    }
    if (isValidExistingId(b.id)) {
      // 살아있는 id 는 그대로. trim 결과를 정규화해 저장 — 외측 공백 제거.
      const trimmed = b.id.trim();
      if (trimmed !== b.id) {
        changed = true;
        return { ...b, id: trimmed };
      }
      return b;
    }
    const labelSlug = typeof b.label === 'string' ? labelToSlug(b.label) : '';
    // label-slug, fallback prefix 모두 `uniqueSlug` 로 통과시켜 사용자가
    // 명시한 id (e.g. `btn_1`) 와 fallback prefix (e.g. index 1 의 `btn_1`)
    // 가 충돌해도 dedup 된다 (review W-2).
    const seed = labelSlug.length > 0 ? labelSlug : fallbackPrefix(i);
    const candidate = uniqueSlug(seed, taken);
    taken.add(candidate);
    changed = true;
    return { ...b, id: candidate };
  });
  return { buttons: result, changed };
}

interface CarouselItemLike {
  buttons?: unknown;
  [key: string]: unknown;
}

interface NodeConfigLike {
  buttons?: unknown;
  itemButtons?: unknown;
  items?: unknown;
  [key: string]: unknown;
}

/**
 * 노드 config 의 모든 buttons 위치를 정규화. carousel/chart/table/template
 * 가 사용하는 위치:
 *   - `config.buttons[*]`           → fallback prefix `btn_${i}`
 *   - `config.itemButtons[*]`       → fallback prefix `itemBtn_${i}` (carousel only)
 *   - `config.items[*].buttons[*]`  → fallback prefix `items_${i}_btn_${j}`
 *
 * 변경된 사본을 돌려준다 (원본 mutate 금지). 변경이 전혀 없으면 input 을
 * 그대로 반환 — caller 가 reference 비교로 변경 감지 가능.
 */
export function normalizeNodeButtonIds(
  config: NodeConfigLike | undefined,
): NodeConfigLike | undefined {
  if (!config || typeof config !== 'object') return config;

  let next: NodeConfigLike | null = null;
  const ensureCopy = (): NodeConfigLike => {
    if (!next) next = { ...config };
    return next;
  };

  if (Array.isArray(config.buttons)) {
    const out = normalizeButtonsArray(
      config.buttons as ButtonLike[],
      (i) => `btn_${i}`,
    );
    if (out.changed) ensureCopy().buttons = out.buttons;
  }

  if (Array.isArray(config.itemButtons)) {
    const out = normalizeButtonsArray(
      config.itemButtons as ButtonLike[],
      (i) => `itemBtn_${i}`,
    );
    if (out.changed) ensureCopy().itemButtons = out.buttons;
  }

  if (Array.isArray(config.items)) {
    let itemsChanged = false;
    const newItems = (config.items as CarouselItemLike[]).map((item, i) => {
      if (!item || typeof item !== 'object' || !Array.isArray(item.buttons)) {
        return item;
      }
      const out = normalizeButtonsArray(
        item.buttons as ButtonLike[],
        (j) => `items_${i}_btn_${j}`,
      );
      if (out.changed) {
        itemsChanged = true;
        return { ...item, buttons: out.buttons };
      }
      return item;
    });
    if (itemsChanged) ensureCopy().items = newItems;
  }

  return next ?? config;
}

/**
 * 이 노드 type 이 buttons 정규화 대상인지. 정규화 비용이 작아 모든 노드에
 * 대해 호출해도 무방하지만 의도를 명확히 하기 위해 명시 타입 게이트를 둔다.
 */
const BUTTON_NODE_TYPES = new Set(['carousel', 'chart', 'table', 'template']);

export function isButtonNodeType(type: string): boolean {
  return BUTTON_NODE_TYPES.has(type);
}
