import { Logger } from '@nestjs/common';
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

// D5 (2026-05-17) — Table client-side render 전환. backend 는 더 이상
// `output.rendered` HTML snapshot 을 생성하지 않으며, frontend
// `TableContent` 컴포넌트가 `output.rows` + `output.columns` 로 직접
// 렌더한다. Carousel / Chart 와 완전 일관 (config + data → 클라이언트 렌더).

type TableMode = 'static' | 'dynamic';

const EXPRESSION_PATTERN = /\{\{/;
const logger = new Logger('TableHandler');

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

    // Cap evaluated `rows` at the Presentation 1MB threshold.
    const cappedRows = truncateArrayForOutput(dataRows, PRESENTATION_MAX_BYTES);

    // Resolve label expressions (once, using first item context if available)
    const resolvedColumns = this.resolveColumnLabels(
      columns,
      config,
      input,
      context,
    );

    // CONVENTIONS Principle 7 — config echoes raw column definitions
    // (per-column `field` / `label` may be `{{ ... }}` templates the engine
    // resolved before dispatch). evaluated rows + resolved column labels
    // live in output. D5 (2026-05-17) — `output.rendered` HTML snapshot 폐기,
    // frontend `TableContent` 가 `rows` + `columns` 로 직접 렌더.
    const rawConfig = context.rawConfig ?? config;
    const payload: Record<string, unknown> = {
      rows: cappedRows.value,
      // `totalRows` reflects the full pre-cap dataset size (post pageSize /
      // sort) so downstream observers can detect the cap even without the
      // explicit `rowsTruncated` flag (`rows.length !== totalRows`).
      totalRows: dataRows.length,
      // Surface resolved (label-evaluated) columns on output for downstream
      // nodes that want the post-evaluation view.
      columns: resolvedColumns,
    };
    if (cappedRows.truncated) {
      payload.rowsTruncated = true;
      payload.rowsTotalCount = cappedRows.originalLength;
    }
    // D1 (2026-05-17) — explicit enumeration baseline. Echo every non-sensitive
    // schema field unconditionally; `dataSource` / `rows` / `pagination` were
    // previously missing.
    const configEcho: Record<string, unknown> = {
      mode: rawConfig.mode ?? mode,
      dataSource: rawConfig.dataSource,
      columns: rawConfig.columns ?? columns,
      rows: rawConfig.rows,
      pagination: rawConfig.pagination,
      pageSize:
        rawConfig.pageSize !== undefined ? rawConfig.pageSize : pageSize,
      sortBy: rawConfig.sortBy !== undefined ? rawConfig.sortBy : sortBy,
      sortOrder:
        rawConfig.sortOrder !== undefined ? rawConfig.sortOrder : sortOrder,
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
      // PII/토큰 노출 차단: ctx.$sourceItem / ctx.$var 의 키 이름만 로깅한다.
      // 전체 값 직렬화는 운영 로그를 통한 민감 정보 유출 경로가 된다 (Review INFO #4).
      const sourceKeys =
        ctx.$sourceItem && typeof ctx.$sourceItem === 'object'
          ? Object.keys(ctx.$sourceItem as Record<string, unknown>)
          : typeof ctx.$sourceItem;
      const varKeys =
        ctx.$var && typeof ctx.$var === 'object'
          ? Object.keys(ctx.$var as Record<string, unknown>)
          : typeof ctx.$var;
      logger.error(
        `safeEvaluate error: template=${template} sourceItemKeys=${JSON.stringify(sourceKeys)} varKeys=${JSON.stringify(varKeys)}`,
        e instanceof Error ? e.stack : String(e),
      );
      return null;
    }
  }
}
