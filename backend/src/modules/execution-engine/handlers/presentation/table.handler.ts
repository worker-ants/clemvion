import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

type TableMode = 'static' | 'dynamic';

interface ColumnConfig {
  field: string;
  label: string;
  sortable?: boolean;
}

export class TableHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const mode: TableMode = ((config.mode as string) ?? 'dynamic') as TableMode;

    if (mode !== 'static' && mode !== 'dynamic') {
      errors.push('mode must be either "static" or "dynamic"');
    }

    if (
      !config.columns ||
      !Array.isArray(config.columns) ||
      config.columns.length === 0
    ) {
      errors.push('columns is required and must be a non-empty array');
    }

    if (mode === 'static') {
      if (
        !config.rows ||
        !Array.isArray(config.rows) ||
        config.rows.length === 0
      ) {
        errors.push(
          'rows is required and must be a non-empty array in static mode',
        );
      }
    }

    if (
      config.sortBy &&
      typeof config.sortBy === 'string' &&
      Array.isArray(config.columns)
    ) {
      const columnFields = (config.columns as Array<{ field: string }>).map(
        (c) => c.field,
      );
      if (!columnFields.includes(config.sortBy)) {
        errors.push(
          `sortBy "${config.sortBy}" must match one of the defined column fields`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ExecutionContext,
  ): Promise<unknown> {
    const mode: TableMode = ((config.mode as string) ?? 'dynamic') as TableMode;
    const columns = config.columns as ColumnConfig[];
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
      dataRows = sourceArray.map((item: Record<string, unknown>) => {
        const row: Record<string, unknown> = {};
        for (const col of columns) {
          row[col.field] = item[col.field] ?? null;
        }
        return row;
      });
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

    const rendered = this.renderHtml(columns, dataRows);

    return Promise.resolve({
      type: 'table',
      columns,
      rows: dataRows,
      totalRows: dataRows.length,
      rendered,
    });
  }

  private renderHtml(
    columns: ColumnConfig[],
    rows: Record<string, unknown>[],
  ): string {
    const headerCells = columns
      .map((col) => `<th>${this.escapeHtml(col.label)}</th>`)
      .join('');

    const bodyRows = rows
      .map((row) => {
        const cells = columns
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
      .replace(/"/g, '&quot;');
  }
}
