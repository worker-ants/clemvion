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

    it('should fail when more than 10 buttons', () => {
      const buttons = Array.from({ length: 11 }, (_, i) => ({
        id: `btn-${i}`,
        label: `Button ${i}`,
        type: 'port' as const,
      }));
      const errors = validateButtons({ buttons });
      expect(errors.some((e) => e.includes('Maximum 10'))).toBe(true);
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

    it('should validate buttonTimeout range', () => {
      const errors = validateButtons({
        buttons: [{ id: 'btn-1', label: 'X', type: 'port' }],
        buttonTimeout: 100000,
      });
      expect(errors.some((e) => e.includes('buttonTimeout'))).toBe(true);
    });

    it('should pass for valid buttonTimeout', () => {
      const errors = validateButtons({
        buttons: [{ id: 'btn-1', label: 'X', type: 'port' }],
        buttonTimeout: 300,
      });
      expect(errors).toEqual([]);
    });

    it('should fail when port buttons exist and timeoutAction is continue', () => {
      const errors = validateButtons({
        buttons: [{ id: 'btn-1', label: 'X', type: 'port' }],
        buttonTimeout: 300,
        buttonTimeoutAction: 'continue',
      });
      expect(errors.some((e) => e.includes('cannot be "continue"'))).toBe(true);
    });

    it('should pass when port buttons exist and timeoutAction is cancel', () => {
      const errors = validateButtons({
        buttons: [{ id: 'btn-1', label: 'X', type: 'port' }],
        buttonTimeout: 300,
        buttonTimeoutAction: 'cancel',
      });
      expect(errors).toEqual([]);
    });

    it('should allow continue timeoutAction when only link buttons', () => {
      const errors = validateButtons({
        buttons: [
          { id: 'btn-1', label: 'X', type: 'link', url: 'http://x.com' },
        ],
        buttonTimeout: 300,
        buttonTimeoutAction: 'continue',
      });
      expect(errors).toEqual([]);
    });
  });
});
