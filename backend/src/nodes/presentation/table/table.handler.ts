import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  evaluate,
  ExpressionContext as EngineContext,
} from '@workflow/expression-engine';
import { getNestedValue } from '../../core/nested-value.util.js';
import {
  PRESENTATION_MAX_BYTES,
  truncateArrayForOutput,
} from '../../core/truncate-output.util.js';
import { ButtonDef } from '../_shared/button.types.js';
import { tableNodeMetadata } from './table.schema.js';

type TableMode = 'static' | 'dynamic';

const EXPRESSION_PATTERN = /\{\{/;

interface ColumnConfig {
  field: string;
  label: string;
  sortable?: boolean;
}

export class TableHandler implements NodeHandler {
  metadata = tableNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers no-columns + invalid
    // mode + columns/rows/buttons type guards + sortBy↔columns cross-check.
    // Mode normalization mirrors the zod default ('dynamic') so missing-mode
    // configs still hit the static/dynamic-aware rules consistently.
    const normalized =
      (config?.mode as string | undefined) === undefined
        ? { ...config, mode: 'dynamic' }
        : config;
    const errors = evaluateMetadataBlockingErrors(this.metadata, normalized);
    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const mode: TableMode = ((config.mode as string) ?? 'dynamic') as TableMode;
    // `columns` default is `[]` per schema — fall back so `for (const col of columns)`
    // never dereferences undefined.
    const columns = Array.isArray(config.columns)
      ? (config.columns as ColumnConfig[])
      : [];
    const pageSize = config.pageSize as number | undefined;
    const sortBy = config.sortBy as string | undefined;
    const sortOrder = (config.sortOrder as string) ?? 'asc';

    let dataRows: Record<string, unknown>[];

    if (mode === 'static') {
      const rawRows = Array.isArray(config.rows)
        ? (config.rows as unknown[]).filter(
            (r): r is Record<string, unknown> =>
              r !== null && typeof r === 'object' && !Array.isArray(r),
          )
        : [];
      dataRows = rawRows.map((item) => {
        const row: Record<string, unknown> = {};
        for (const col of columns) {
          row[col.field] = item[col.field] ?? null;
        }
        return row;
      });
    } else {
      const source = config.dataSource != null ? config.dataSource : input;
      const sourceArray = Array.isArray(source) ? source : [source];
      const baseCtx = (context.expressionContext ?? {}) as EngineContext;

      // Pre-classify columns: expression vs plain field path (avoids O(N×M) regex)
      const exprFields = new Set(
        columns
          .filter((c) => EXPRESSION_PATTERN.test(c.field))
          .map((c) => c.field),
      );

      dataRows = sourceArray.map(
        (item: Record<string, unknown>, index: number) => {
          const row: Record<string, unknown> = {};
          const itemCtx: EngineContext = {
            ...baseCtx,
            $dataSource: sourceArray,
            $sourceItem: item,
            $sourceItemIndex: index,
          };

          for (const col of columns) {
            if (exprFields.has(col.field)) {
              row[col.field] = this.safeEvaluate(col.field, itemCtx);
            } else {
              row[col.field] = getNestedValue(item, col.field) ?? null;
            }
          }
          return row;
        },
      );
    }

    if (sortBy) {
      dataRows = [...dataRows].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        if (aVal === bVal) return 0;
        const cmp = aVal != null && bVal != null && aVal < bVal ? -1 : 1;
        return sortOrder === 'desc' ? -cmp : cmp;
      });
    }

    if (pageSize) {
      dataRows = dataRows.slice(0, pageSize);
    }

    // Cap evaluated `rows` at the Presentation 1MB threshold BEFORE
    // rendering so the HTML stays aligned with the surfaced rows array.
    // Otherwise rendered would echo the full dataset's HTML even when rows
    // are truncated, defeating the cap.
    const cappedRows = truncateArrayForOutput(dataRows, PRESENTATION_MAX_BYTES);

    // Resolve label expressions (once, using first item context if available)
    const resolvedColumns = this.resolveColumnLabels(
      columns,
      config,
      input,
      context,
    );

    const rendered = this.renderHtml(
      resolvedColumns,
      columns,
      cappedRows.value,
    );

    // CONVENTIONS Principle 7 — config echoes raw column definitions
    // (per-column `field` / `label` may be `{{ ... }}` templates the engine
    // resolved before dispatch). evaluated rows + resolved column labels
    // live in output.
    const rawConfig = context.rawConfig ?? config;
    const payload: Record<string, unknown> = {
      rows: cappedRows.value,
      // `totalRows` reflects the full pre-cap dataset size (post pageSize /
      // sort) so downstream observers can detect the cap even without the
      // explicit `rowsTruncated` flag (`rows.length !== totalRows`).
      totalRows: dataRows.length,
      rendered,
      // Surface resolved (label-evaluated) columns on output for downstream
      // nodes that want the post-evaluation view.
      columns: resolvedColumns,
    };
    if (cappedRows.truncated) {
      payload.rowsTruncated = true;
      payload.rowsTotalCount = cappedRows.originalLength;
    }
    const configEcho: Record<string, unknown> = {
      mode: rawConfig.mode ?? mode,
      columns: rawConfig.columns ?? columns,
      ...(rawConfig.pageSize !== undefined
        ? { pageSize: rawConfig.pageSize }
        : pageSize !== undefined
          ? { pageSize }
          : {}),
      ...(rawConfig.sortBy !== undefined
        ? { sortBy: rawConfig.sortBy, sortOrder: rawConfig.sortOrder }
        : sortBy !== undefined
          ? { sortBy, sortOrder }
          : {}),
    };

    const buttons = config.buttons as ButtonDef[] | undefined;
    if (Array.isArray(buttons) && buttons.length > 0) {
      return Promise.resolve({
        config: {
          ...configEcho,
          buttons,
          buttonConfig: {
            buttons,
          },
        },
        output: payload,
        status: 'waiting_for_input',
        meta: { interactionType: 'buttons', durationMs: 0 },
      });
    }

    return Promise.resolve({ config: configEcho, output: payload });
  }

  private resolveColumnLabels(
    columns: ColumnConfig[],
    config: Record<string, unknown>,
    input: unknown,
    context: ExecutionContext,
  ): ColumnConfig[] {
    const mode = (config.mode as string) ?? 'dynamic';
    if (mode !== 'dynamic') return columns;

    const hasExpressionLabel = columns.some((c) =>
      EXPRESSION_PATTERN.test(c.label),
    );
    if (!hasExpressionLabel) return columns;

    const sourceArray = this.resolveDataSource(config, input);
    const baseCtx = (context.expressionContext ?? {}) as EngineContext;
    const ctx: EngineContext = {
      ...baseCtx,
      $dataSource: sourceArray,
    };

    return columns.map((col) => {
      if (EXPRESSION_PATTERN.test(col.label)) {
        return { ...col, label: String(this.safeEvaluate(col.label, ctx)) };
      }
      return col;
    });
  }

  private renderHtml(
    resolvedColumns: ColumnConfig[],
    originalColumns: ColumnConfig[],
    rows: Record<string, unknown>[],
  ): string {
    const headerCells = resolvedColumns
      .map((col) => `<th>${this.escapeHtml(col.label)}</th>`)
      .join('');

    const bodyRows = rows
      .map((row) => {
        const cells = originalColumns
          .map(
            (col) =>
              `<td>${this.escapeHtml(this.toDisplayString(row[col.field]))}</td>`,
          )
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }

  private resolveDataSource(
    config: Record<string, unknown>,
    input: unknown,
  ): unknown[] {
    const source = config.dataSource != null ? config.dataSource : input;
    return Array.isArray(source) ? source : [source];
  }

  private safeEvaluate(template: string, ctx: EngineContext): unknown {
    try {
      return evaluate(template, ctx);
    } catch (e) {
      console.error('[TableHandler] safeEvaluate error:', template, e);
      console.error(
        '[TableHandler] ctx.$sourceItem:',
        JSON.stringify(ctx.$sourceItem),
      );
      console.error('[TableHandler] ctx.$var:', JSON.stringify(ctx.$var));
      return null;
    }
  }

  private toDisplayString(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value.toString();
    }
    return JSON.stringify(value);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
