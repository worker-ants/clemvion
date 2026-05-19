export interface ButtonDef {
  id: string;
  label: string;
  type: 'link' | 'port';
  url?: string;
  style?: 'primary' | 'secondary' | 'outline' | 'danger';
}

export interface ButtonConfig {
  buttons: ButtonDef[];
  /** Maps button id → item index for carousel/table per-item buttons. */
  buttonItemMap?: Record<string, number>;
}

export interface ButtonInteractionData {
  interactionType: 'button_click' | 'button_continue';
  buttonId?: string;
  buttonLabel?: string;
  clickedAt: string;
  clickedBy?: string;
}

export function hasPortButtons(buttons: ButtonDef[]): boolean {
  return buttons.some((b) => b.type === 'port');
}

export function hasOnlyLinkButtons(buttons: ButtonDef[]): boolean {
  return buttons.length > 0 && buttons.every((b) => b.type === 'link');
}

export interface ButtonValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Per-node global button cap. Mirror points:
 *  - spec/4-nodes/6-presentation/0-common.md §1.1 "최대 버튼 수"
 *  - frontend `button-list-editor.tsx` `maxButtons` default
 *  - carousel `validateCarouselItemButtons` per-item cap (same value)
 *
 * Carousel ⇒ a single item can display global 5 + itemButtons 5 = 10 buttons
 * (사용자 가시 모델). spec/4-nodes/6-presentation/0-common.md §Rationale.
 */
export const MAX_BUTTONS_PER_NODE = 5;

/**
 * Validate button configuration according to spec §1.6 and §1.7.
 * Returns errors array (empty = valid).
 */
export function validateButtons(config: Record<string, unknown>): string[] {
  const rawButtons = config.buttons as unknown[] | undefined;
  if (!rawButtons || !Array.isArray(rawButtons) || rawButtons.length === 0) {
    return []; // No buttons = valid (non-blocking mode)
  }

  const errors: string[] = [];

  if (rawButtons.length > MAX_BUTTONS_PER_NODE) {
    errors.push(`Maximum ${MAX_BUTTONS_PER_NODE} buttons allowed per node`);
  }

  // Unique IDs
  const ids = new Set<string>();
  for (let i = 0; i < rawButtons.length; i++) {
    const btn = rawButtons[i] as Record<string, unknown>;

    if (!btn.id || typeof btn.id !== 'string') {
      errors.push(`buttons[${i}].id is required`);
    } else if (btn.id.includes('__item_')) {
      errors.push(
        `buttons[${i}].id must not contain reserved separator "__item_"`,
      );
    } else if (ids.has(btn.id)) {
      errors.push(`buttons[${i}].id must be unique (duplicate: ${btn.id})`);
    } else {
      ids.add(btn.id);
    }

    // Label required
    if (!btn.label || typeof btn.label !== 'string') {
      errors.push(`buttons[${i}].label is required and must be a string`);
    }

    // Type validation
    if (!btn.type || !['link', 'port'].includes(btn.type as string)) {
      errors.push(`buttons[${i}].type must be "link" or "port"`);
    }

    // Link URL required
    if (btn.type === 'link' && (!btn.url || typeof btn.url !== 'string')) {
      errors.push(`buttons[${i}].url is required for link type buttons`);
    } else if (btn.type === 'link' && btn.url) {
      if (/^(javascript|data|vbscript):/i.test((btn.url as string).trim())) {
        errors.push(`buttons[${i}].url contains a disallowed URL scheme`);
      }
    }

    // Port cannot have URL
    if (btn.type === 'port' && btn.url) {
      errors.push(`buttons[${i}].url is not allowed for port type buttons`);
    }

    // Style validation
    if (
      btn.style !== undefined &&
      !['primary', 'secondary', 'outline', 'danger'].includes(
        btn.style as string,
      )
    ) {
      errors.push(
        `buttons[${i}].style must be one of: primary, secondary, outline, danger`,
      );
    }
  }

  return errors;
}
