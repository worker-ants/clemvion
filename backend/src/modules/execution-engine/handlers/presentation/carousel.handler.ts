import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

export class CarouselHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.titleField || typeof config.titleField !== 'string') {
      errors.push('titleField is required and must be a string');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const titleField = config.titleField as string;
    const descriptionField = config.descriptionField as string | undefined;
    const imageField = config.imageField as string | undefined;
    const maxItems = config.maxItems as number | undefined;
    const layout = (config.layout as string) ?? 'horizontal';

    const inputArray = Array.isArray(input) ? input : [input];
    const limitedArray = maxItems ? inputArray.slice(0, maxItems) : inputArray;

    const items = limitedArray.map((item: Record<string, unknown>) => ({
      title: item[titleField] ?? '',
      description: descriptionField ? (item[descriptionField] ?? '') : '',
      image: imageField ? (item[imageField] ?? '') : undefined,
    }));

    const rendered = this.renderHtml(items, layout);

    return { type: 'carousel', items, layout, rendered };
  }

  private renderHtml(
    items: Array<{ title: unknown; description: unknown; image?: unknown }>,
    layout: string,
  ): string {
    const itemsHtml = items
      .map(
        (item) =>
          `<div class="carousel-item">` +
          (item.image
            ? `<img src="${this.escapeHtml(String(item.image))}" alt="${this.escapeHtml(String(item.title))}" />`
            : '') +
          `<h3>${this.escapeHtml(String(item.title))}</h3>` +
          `<p>${this.escapeHtml(String(item.description))}</p>` +
          `</div>`,
      )
      .join('');

    return `<div class="carousel carousel-${layout}">${itemsHtml}</div>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
