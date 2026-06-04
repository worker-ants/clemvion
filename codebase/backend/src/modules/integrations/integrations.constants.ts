/**
 * DB constraint / index name for the unified store-identifier UNIQUE index
 * introduced in V072: `(workspace_id, service_type, mall_id) WHERE mall_id IS
 * NOT NULL`. Replaces the three per-service partial indexes
 * (`idx_integration_cafe24_workspace_mall` V046,
 * `idx_integration_makeshop_workspace_mall` V071,
 * `idx_integration_cafe24_mall_id_partial` V051).
 *
 * Referenced from:
 * - `integrations.service.ts#throwIfUniqueViolation` (name comparison)
 * - `integration-oauth.service.ts` race-backstop catch blocks (cafe24 private
 *   begin, makeshop install)
 *
 * Changing the index name requires a migration and must be updated here.
 * See `spec/1-data-model.md §3` for the full index table.
 */
export const STORE_IDENTIFIER_UNIQUE_CONSTRAINT =
  'idx_integration_workspace_service_mall';

/**
 * Per-service "store identifier already connected" error mapping — used by
 * `throwIfUniqueViolation` in `integrations.service.ts` and by the
 * race-backstop catch blocks in `integration-oauth.service.ts` to translate a
 * unified-UNIQUE-index violation (`STORE_IDENTIFIER_UNIQUE_CONSTRAINT`) into
 * the per-service 409 error code/message.
 *
 * Registering a service here is optional: unmapped services degrade gracefully
 * to `GENERIC_ALREADY_CONNECTED` (still a 409). New integrations that want a
 * better error message add one line here — no index/migration changes needed.
 *
 * cafe24/makeshop codes and messages are byte-identical to the values used
 * before V072 — no behavior change.
 *
 * See `spec/1-data-model.md §3` for index context.
 */
export const ALREADY_CONNECTED_BY_SERVICE: Record<
  string,
  { code: string; message: string }
> = {
  cafe24: {
    code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
    message:
      'A Cafe24 integration with this mall_id already exists in this workspace. Use the existing integration or delete it first.',
  },
  makeshop: {
    code: 'MAKESHOP_ALREADY_CONNECTED',
    message:
      'A MakeShop integration with this shop_uid already exists in this workspace. Use the existing integration or delete it first.',
  },
};

/**
 * Fallback error for a unified-UNIQUE-index violation from a service type that
 * is not registered in `ALREADY_CONNECTED_BY_SERVICE`. Ensures new integrations
 * that omit a registry entry still return a 409 (not a 500).
 */
export const GENERIC_ALREADY_CONNECTED = {
  code: 'INTEGRATION_ALREADY_CONNECTED',
  message:
    'An integration with this store identifier already exists in this workspace. Use the existing integration or delete it first.',
};
