import {
  validateButtons,
  hasPortButtons,
  hasOnlyLinkButtons,
} from './button.types.js';

describe('button.types', () => {
  describe('hasPortButtons', () => {
    it('should return true when port buttons exist', () => {
      expect(
        hasPortButtons([
          { id: '1', label: 'Approve', type: 'port' },
          { id: '2', label: 'Link', type: 'link', url: 'http://x.com' },
        ]),
      ).toBe(true);
    });

    it('should return false when only link buttons', () => {
      expect(
        hasPortButtons([
          { id: '1', label: 'Link', type: 'link', url: 'http://x.com' },
        ]),
      ).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(hasPortButtons([])).toBe(false);
    });
  });

  describe('hasOnlyLinkButtons', () => {
    it('should return true when all link buttons', () => {
      expect(
        hasOnlyLinkButtons([
          { id: '1', label: 'A', type: 'link', url: 'http://a.com' },
          { id: '2', label: 'B', type: 'link', url: 'http://b.com' },
        ]),
      ).toBe(true);
    });

    it('should return false when port buttons exist', () => {
      expect(
        hasOnlyLinkButtons([
          { id: '1', label: 'A', type: 'link', url: 'http://a.com' },
          { id: '2', label: 'B', type: 'port' },
        ]),
      ).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(hasOnlyLinkButtons([])).toBe(false);
    });
  });

  describe('validateButtons', () => {
    it('should pass for empty buttons (non-blocking mode)', () => {
      expect(validateButtons({})).toEqual([]);
      expect(validateButtons({ buttons: [] })).toEqual([]);
    });

    it('should pass for valid port button config', () => {
      const errors = validateButtons({
        buttons: [{ id: 'btn-1', label: 'Approve', type: 'port' }],
      });
      expect(errors).toEqual([]);
    });

    it('should pass for valid link button config', () => {
      const errors = validateButtons({
        buttons: [
          {
            id: 'btn-1',
            label: 'Details',
            type: 'link',
            url: 'http://example.com',
          },
        ],
      });
      expect(errors).toEqual([]);
    });

    it('should fail when label is missing', () => {
      const errors = validateButtons({
        buttons: [{ id: 'btn-1', label: '', type: 'port' }],
      });
      expect(errors.some((e) => e.includes('label'))).toBe(true);
    });

    it('should fail when link button has no URL', () => {
      const errors = validateButtons({
        buttons: [{ id: 'btn-1', label: 'Link', type: 'link' }],
      });
      expect(errors.some((e) => e.includes('url'))).toBe(true);
    });

    it('should fail when port button has URL', () => {
      const errors = validateButtons({
        buttons: [
          { id: 'btn-1', label: 'Port', type: 'port', url: 'http://x.com' },
        ],
      });
      expect(errors.some((e) => e.includes('url is not allowed'))).toBe(true);
    });

    // cap 5 — 2026-05-19 정준화 (spec/4-nodes/6-presentation/0-common.md §Rationale).
    it('passes with exactly 5 buttons (cap)', () => {
      const buttons = Array.from({ length: 5 }, (_, i) => ({
        id: `btn-${i}`,
        label: `Button ${i}`,
        type: 'port' as const,
      }));
      const errors = validateButtons({ buttons });
      expect(errors.some((e) => e.includes('Maximum'))).toBe(false);
    });

    it('should fail when more than 5 buttons (cap exceeded)', () => {
      const buttons = Array.from({ length: 6 }, (_, i) => ({
        id: `btn-${i}`,
        label: `Button ${i}`,
        type: 'port' as const,
      }));
      const errors = validateButtons({ buttons });
      expect(errors.some((e) => e.includes('Maximum 5'))).toBe(true);
    });

    it('should fail for duplicate IDs', () => {
      const errors = validateButtons({
        buttons: [
          { id: 'same-id', label: 'A', type: 'port' },
          { id: 'same-id', label: 'B', type: 'port' },
        ],
      });
      expect(errors.some((e) => e.includes('unique'))).toBe(true);
    });

    it('should fail for invalid button type', () => {
      const errors = validateButtons({
        buttons: [{ id: 'btn-1', label: 'X', type: 'invalid' }],
      });
      expect(errors.some((e) => e.includes('type'))).toBe(true);
    });

    it('should fail for invalid style', () => {
      const errors = validateButtons({
        buttons: [{ id: 'btn-1', label: 'X', type: 'port', style: 'neon' }],
      });
      expect(errors.some((e) => e.includes('style'))).toBe(true);
    });

    it('should ignore unknown buttonTimeout field (no longer supported)', () => {
      const errors = validateButtons({
        buttons: [{ id: 'btn-1', label: 'X', type: 'port' }],
        buttonTimeout: 100000,
      });
      expect(errors).toEqual([]);
    });

    // SUMMARY#11 — userMessage + validateButtons integration
    it('passes for port button with userMessage set (spec §1, §10.8)', () => {
      // type="port" + userMessage is the primary AI Agent use-case.
      // validateButtons must not reject this combination.
      const errors = validateButtons({
        buttons: [
          {
            id: 'btn-1',
            label: 'Inquire',
            type: 'port',
            userMessage: 'I want to inquire about this item',
          },
        ],
      });
      expect(errors).toEqual([]);
    });

    it('returns advisory warning for link button with userMessage (spec §1.1)', () => {
      // type="link" + userMessage: the message is ignored at click-time (external
      // URL takes priority). validateButtons surfaces an advisory message so
      // LLM-authored payloads can surface the mismatch to the canvas user.
      const errors = validateButtons({
        buttons: [
          {
            id: 'btn-1',
            label: 'Open',
            type: 'link',
            url: 'https://example.com',
            userMessage: 'This is ignored for link type',
          },
        ],
      });
      expect(
        errors.some((e) => e.includes('ignored') && e.includes('link')),
      ).toBe(true);
    });
  });

  describe('reserved error port id (REQ-NODEUI-042)', () => {
    // CLE-NODE-OUTPUT-FLOW Principle 6 의 4번 — 엔진은 `_selectedPort === 'error'`
    // 와 연결선 `sourcePort === 'error'` 를 문자열로 비교하므로 버튼 id `error` 는
    // 에러 포트와 구분되지 않는다.
    it('rejects a global button whose id is exactly "error"', () => {
      const errors = validateButtons({
        buttons: [{ id: 'error', label: 'Error', type: 'port' }],
      });
      expect(errors).toContain(
        'buttons[0].id "error" is reserved for the error port',
      );
    });

    it('allows ids that only resemble "error" (exact match only)', () => {
      const errors = validateButtons({
        buttons: [
          { id: 'Error', label: 'A', type: 'port' },
          { id: 'error_1', label: 'B', type: 'port' },
          { id: 'errors', label: 'C', type: 'port' },
        ],
      });
      expect(errors).toEqual([]);
    });

    it('rejects "error" on link buttons too (id is still a port key)', () => {
      const errors = validateButtons({
        buttons: [
          { id: 'error', label: 'Help', type: 'link', url: 'https://x.com' },
        ],
      });
      expect(errors).toContain(
        'buttons[0].id "error" is reserved for the error port',
      );
    });
  });
});
