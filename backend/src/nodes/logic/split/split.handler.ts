import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { resolveFieldValue } from '../../core/nested-value.util.js';
import { splitNodeMetadata } from './split.schema.js';

interface SplitConfig {
  // Either a dot-path string applied to `$input` (e.g. `"items"`) OR the
  // resolved value itself when an inline expression like `{{ $var.a }}` is
  // used.
  fieldPath: unknown;
}

interface SplitItem {
  index: number;
  value: unknown;
}

export class SplitHandler implements NodeHandler {
  metadata = splitNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    const errors = evaluateMetadataBlockingErrors(this.metadata, config);
    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const { fieldPath } = config as unknown as SplitConfig;
    // CONVENTIONS Principle 7 — config echoes raw fieldPath (`{{ ... }}`
    // template preserved); resolveFieldValue still operates on the
    // evaluated `fieldPath` from `config`.
    const rawConfig = (context.rawConfig ?? config) as unknown as SplitConfig;
    const baseConfig = { fieldPath: rawConfig.fieldPath };

    const arrayValue = resolveFieldValue(input, fieldPath);

    if (!Array.isArray(arrayValue)) {
      // CONVENTIONS Principle 9 — `{ <컬렉션>, count }` 형태.
      // CONVENTIONS Principle 10 — null/undefined / 비배열 → 빈 배열 fallback.
      return Promise.resolve({
        config: baseConfig,
        output: { items: [] as SplitItem[], count: 0 },
      });
    }

    const items: SplitItem[] = (arrayValue as unknown[]).map(
      (value, index) => ({
        index,
        value,
      }),
    );

    return Promise.resolve({
      config: baseConfig,
      output: { items, count: items.length },
    });
  }
}
