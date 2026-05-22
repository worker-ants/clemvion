/**
 * Presentation category zod schema re-export — single shared surface for
 * cross-layer consumers (e.g. `nodes/ai/.../render-tool-provider`) so they
 * don't reach into sibling presentation node directories directly.
 *
 * SoT: each presentation node's own `<name>.schema.ts` continues to own its
 * config schema definition. This module is a thin barrel — adding/renaming
 * schemas here is intentional; it forces a single update point when new
 * presentation types are added (e.g. future `chart3d`, `dashboard`, …).
 */
export { tableNodeConfigSchema } from '../table/table.schema';
export { chartConfigSchema } from '../chart/chart.schema';
export { carouselNodeConfigSchema } from '../carousel/carousel.schema';
export { templateNodeConfigSchema } from '../template/template.schema';
export { formNodeConfigSchema } from '../form/form.schema';
