import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

interface ColumnConfig {
  field: string;
  label: string;
  sortable?: boolean;
}

export class TableHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (
      !config.columns ||
      !Array.isArray(config.columns) ||
      config.columns.length === 0
    ) {
      errors.push('columns is required and must be a non-empty array');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const columns = config.columns as ColumnConfig[];
    const pageSize = config.pageSize as number | undefined;
    const sortBy = config.sortBy as string | undefined;
    const sortOrder = (config.sortOrder as string) ?? 'asc';

    let inputArray = Array.isArray(input) ? input : [input];

    if (sortBy) {
      inputArray = [...inputArray].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortBy];
        const bVal = (b as Record<string, unknown>)[sortBy];
        if (aVal === bVal) return 0;
        const cmp = aVal != null && bVal != null && aVal < bVal ? -1 : 1;
        return sortOrder === 'desc' ? -cmp : cmp;
      });
    }

    if (pageSize) {
      inputArray = inputArray.slice(0, pageSize);
    }

    const rows = inputArray.map((item: Record<string, unknown>) => {
      const row: Record<string, unknown> = {};
      for (const col of columns) {
        row[col.field] = item[col.field] ?? null;
      }
      return row;
    });

    const rendered = this.renderHtml(columns, rows);

    return { type: 'table', columns, rows, totalRows: rows.length, rendered };
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
              `<td>${this.escapeHtml(String(row[col.field] ?? ''))}</td>`,
          )
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
