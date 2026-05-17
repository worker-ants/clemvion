import {
  CAFE24_INQUIRY_URL,
  RESTRICTED_APPROVAL,
  SCOPE_LEVEL_RESTRICTED_SCOPES,
  extractCafe24ScopeTokens,
  pickRestrictedApprovalScopes,
} from './restricted-approval.js';

describe('Cafe24 partner-approval helpers', () => {
  describe('RESTRICTED_APPROVAL static catalog', () => {
    it('contains all scope-level groups from spec §1 (mileage/notification/privacy)', () => {
      expect(RESTRICTED_APPROVAL.mileage.level).toBe('scope');
      expect(RESTRICTED_APPROVAL.notification.level).toBe('scope');
      expect(RESTRICTED_APPROVAL.privacy.level).toBe('scope');
    });

    it('contains all operation-level groups from spec §2', () => {
      expect(RESTRICTED_APPROVAL.store_activitylogs.level).toBe('operation');
      expect(RESTRICTED_APPROVAL.store_menus.level).toBe('operation');
      expect(RESTRICTED_APPROVAL.store_naverpay_setting.level).toBe(
        'operation',
      );
      expect(RESTRICTED_APPROVAL.store_kakaopay_setting.level).toBe(
        'operation',
      );
      expect(RESTRICTED_APPROVAL.store_pg_settings.level).toBe('operation');
    });

    it('every entry exposes a non-empty inquiryUrl', () => {
      for (const [key, entry] of Object.entries(RESTRICTED_APPROVAL)) {
        expect(entry.inquiryUrl).toBe(CAFE24_INQUIRY_URL);
        expect(entry.approvalGroup).toBeTruthy();
        expect(['scope', 'operation', 'program']).toContain(entry.level);
        expect(key).toMatch(/^[a-z_]+$/);
      }
    });

    it('analytics is intentionally absent (placeholder track per spec §3)', () => {
      expect((RESTRICTED_APPROVAL as Record<string, unknown>).analytics).toBe(
        undefined,
      );
    });
  });

  describe('SCOPE_LEVEL_RESTRICTED_SCOPES derived from RESTRICTED_APPROVAL', () => {
    it('contains read+write tokens for every scope-level approvalGroup', () => {
      expect(SCOPE_LEVEL_RESTRICTED_SCOPES.has('mall.read_mileage')).toBe(true);
      expect(SCOPE_LEVEL_RESTRICTED_SCOPES.has('mall.write_mileage')).toBe(
        true,
      );
      expect(SCOPE_LEVEL_RESTRICTED_SCOPES.has('mall.read_notification')).toBe(
        true,
      );
      expect(SCOPE_LEVEL_RESTRICTED_SCOPES.has('mall.write_notification')).toBe(
        true,
      );
      expect(SCOPE_LEVEL_RESTRICTED_SCOPES.has('mall.read_privacy')).toBe(true);
      expect(SCOPE_LEVEL_RESTRICTED_SCOPES.has('mall.write_privacy')).toBe(
        true,
      );
    });

    it('excludes operation-level groups (general mall.read_store)', () => {
      expect(SCOPE_LEVEL_RESTRICTED_SCOPES.has('mall.read_store')).toBe(false);
      expect(SCOPE_LEVEL_RESTRICTED_SCOPES.has('mall.write_store')).toBe(false);
    });

    it('excludes general-purpose scopes', () => {
      expect(SCOPE_LEVEL_RESTRICTED_SCOPES.has('mall.read_product')).toBe(
        false,
      );
      expect(SCOPE_LEVEL_RESTRICTED_SCOPES.has('mall.write_order')).toBe(false);
    });
  });

  describe('pickRestrictedApprovalScopes', () => {
    it('returns undefined for nullish / empty input', () => {
      expect(pickRestrictedApprovalScopes(undefined)).toBe(undefined);
      expect(pickRestrictedApprovalScopes([])).toBe(undefined);
    });

    it('returns undefined when no candidate is in the restricted list', () => {
      expect(
        pickRestrictedApprovalScopes(['mall.read_product', 'mall.write_order']),
      ).toBe(undefined);
    });

    it('keeps only restricted scopes and preserves stable order', () => {
      expect(
        pickRestrictedApprovalScopes([
          'mall.read_product', // not restricted
          'mall.read_mileage', // restricted
          'mall.write_order', // not restricted
          'mall.write_notification', // restricted
        ]),
      ).toEqual(['mall.read_mileage', 'mall.write_notification']);
    });

    it('deduplicates repeated entries', () => {
      expect(
        pickRestrictedApprovalScopes([
          'mall.read_privacy',
          'mall.read_privacy',
          'mall.read_privacy',
        ]),
      ).toEqual(['mall.read_privacy']);
    });

    it('ignores empty strings without breaking', () => {
      expect(
        pickRestrictedApprovalScopes(['', 'mall.read_mileage', '']),
      ).toEqual(['mall.read_mileage']);
    });
  });

  describe('extractCafe24ScopeTokens', () => {
    it('returns [] for nullish / non-object input', () => {
      expect(extractCafe24ScopeTokens(undefined)).toEqual([]);
      expect(extractCafe24ScopeTokens(null)).toEqual([]);
      expect(extractCafe24ScopeTokens(42)).toEqual([]);
      expect(extractCafe24ScopeTokens(true)).toEqual([]);
    });

    it('parses tokens from a flat string', () => {
      expect(
        extractCafe24ScopeTokens(
          'INVALID_SCOPE: missing mall.read_mileage, mall.write_notification',
        ),
      ).toEqual(['mall.read_mileage', 'mall.write_notification']);
    });

    it('parses tokens from a shallow object body', () => {
      expect(
        extractCafe24ScopeTokens({
          error_code: 'INSUFFICIENT_SCOPE',
          error_message: 'mall.read_privacy is not authorized for this client',
        }),
      ).toEqual(['mall.read_privacy']);
    });

    it('parses tokens nested one level deep (Cafe24 `error.code/message`)', () => {
      expect(
        extractCafe24ScopeTokens({
          error: {
            code: 'INSUFFICIENT_SCOPE',
            message: 'requested mall.write_mileage rejected',
          },
        }),
      ).toEqual(['mall.write_mileage']);
    });

    it('deduplicates tokens across sources', () => {
      expect(
        extractCafe24ScopeTokens({
          error_message: 'mall.read_mileage / mall.read_mileage',
          error_description: 'mall.read_mileage missing',
        }),
      ).toEqual(['mall.read_mileage']);
    });

    it('returns multiple distinct tokens in encounter order', () => {
      expect(
        extractCafe24ScopeTokens(
          'requires mall.write_privacy and mall.read_notification then mall.read_mileage',
        ),
      ).toEqual([
        'mall.write_privacy',
        'mall.read_notification',
        'mall.read_mileage',
      ]);
    });

    it('returns [] when the body has no scope-shaped tokens', () => {
      expect(extractCafe24ScopeTokens({ error: 'UNRELATED' })).toEqual([]);
    });
  });

  describe('end-to-end: extract + pick composes for INSUFFICIENT_SCOPE pipeline', () => {
    it('builds the requiresCafe24Approval list for the 403 markAuthFailed path', () => {
      const errBody = {
        error_code: 'INSUFFICIENT_SCOPE',
        error_message:
          'Missing scopes: mall.read_mileage, mall.write_notification, mall.read_product',
      };
      const tokens = extractCafe24ScopeTokens(errBody);
      const picked = pickRestrictedApprovalScopes(tokens);
      expect(picked).toEqual([
        'mall.read_mileage',
        'mall.write_notification',
      ]);
    });

    it('returns undefined when only non-restricted scopes are mentioned', () => {
      const errBody = {
        error: { code: 'INSUFFICIENT_SCOPE', message: 'mall.read_product' },
      };
      const picked = pickRestrictedApprovalScopes(
        extractCafe24ScopeTokens(errBody),
      );
      expect(picked).toBe(undefined);
    });
  });
});
