import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  Condition,
  evaluateCondition,
} from '../../core/condition-evaluator.util.js';
import { switchNodeMetadata } from './switch.schema.js';
type CaseValueType = 'string' | 'number' | 'boolean';
type SwitchMode = 'value' | 'expression';

interface SwitchCase {
  id: string;
  label?: string;
  value?: unknown;
  valueType?: CaseValueType;
  condition?: Condition;
}

interface SwitchConfig {
  mode?: SwitchMode;
  switchValue?: unknown;
  cases: SwitchCase[];
  hasDefault?: boolean;
  strictComparison?: boolean;
}

export class SwitchHandler implements NodeHandler {
  metadata = switchNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers value-mode
    // switchValue (only the falsy case), cases empty, per-case id uniqueness +
    // valueType whitelist + condition-required-in-expression-mode. Handler
    // keeps mode/hasDefault/strictComparison enum-and-type guards plus the
    // whitespace-only switchValue + non-array cases checks the warningRule
    // mini-DSL can't express.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    const { mode, switchValue, cases, hasDefault, strictComparison } =
      config as unknown as SwitchConfig;
    const resolvedMode: SwitchMode = mode ?? 'value';
    if (mode !== undefined && mode !== 'value' && mode !== 'expression') {
      errors.push('mode must be "value" or "expression"');
    }
    if (
      resolvedMode === 'value' &&
      typeof switchValue === 'string' &&
      switchValue.trim() === '' &&
      switchValue !== ''
    ) {
      errors.push('switchValue is required');
    }
    if (cases !== undefined && !Array.isArray(cases)) {
      errors.push('cases must be a non-empty array');
    }
    if (hasDefault !== undefined && typeof hasDefault !== 'boolean') {
      errors.push('hasDefault must be a boolean');
    }
    if (
      strictComparison !== undefined &&
      typeof strictComparison !== 'boolean'
    ) {
      errors.push('strictComparison must be a boolean');
    }
    return { valid: errors.length === 0, errors };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const { mode, switchValue, cases, hasDefault, strictComparison } =
      config as unknown as SwitchConfig;
    const resolvedMode: SwitchMode = mode ?? 'value';
    const strict = strictComparison === true;
    // CONVENTIONS Principle 7 — config echoes raw switchValue / cases
    // (templates preserved). Engine populates `rawConfig`; unit-test
    // fallback to evaluated config.
    const rawConfig = (context.rawConfig ?? config) as unknown as SwitchConfig;
    const configEcho = {
      switchValue: rawConfig.switchValue,
      cases: rawConfig.cases,
      mode: rawConfig.mode ?? 'value',
    };

    // The expression engine pre-resolves `switchValue` templates (`{{ ... }}`)
    // to primitives before this handler is invoked, so we use the value
    // directly — no additional path lookup. Treating it as a path was a bug
    // (see plan/switch-node-input-lucky-dove).
    const matchedCase =
      resolvedMode === 'expression'
        ? cases.find(
            (c) =>
              c.condition !== undefined &&
              c.condition !== null &&
              evaluateCondition(input, c.condition, { strict }),
          )
        : this.matchByValue(switchValue, cases, strict);

    if (matchedCase) {
      return {
        config: configEcho,
        output: input,
        meta: {
          mode: resolvedMode,
          matchedCase: matchedCase.id,
          ...(resolvedMode === 'value' ? { value: switchValue } : {}),
        },
        port: matchedCase.id,
      };
    }

    if (hasDefault !== false) {
      return {
        config: configEcho,
        output: input,
        meta: {
          mode: resolvedMode,
          matchedCase: 'default',
          ...(resolvedMode === 'value' ? { value: switchValue } : {}),
        },
        port: 'default',
      };
    }

    throw new Error('No matching case found and no default case configured');
  }

  private matchByValue(
    switchValue: unknown,
    cases: SwitchCase[],
    strict: boolean,
  ): SwitchCase | undefined {
    return cases.find((c) => {
      const caseValue = this.coerceCaseValue(c.value, c.valueType);
      if (strict) {
        return caseValue === switchValue;
      }
      // Intentional loose equality — spec §3.2.1 defines strictComparison
      // default as `false`, so `"42" == 42` must match unless opted in to
      // strict mode above.
      return caseValue == switchValue;
    });
  }

  private coerceCaseValue(value: unknown, valueType?: CaseValueType): unknown {
    if (valueType === undefined || valueType === 'string') {
      return value;
    }
    if (typeof value !== 'string') {
      return value;
    }
    if (valueType === 'number') {
      const n = Number(value);
      return Number.isNaN(n) ? value : n;
    }
    if (valueType === 'boolean') {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }
    return value;
  }
}
