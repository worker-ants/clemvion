import {
  buildSystemContextSchemaFields,
  pickNonDefaultSystemContext,
} from './system-context-schema';

// spec: spec/4-nodes/3-ai/0-common.md §11.1 / §11.7

describe('system-context-schema', () => {
  describe('buildSystemContextSchemaFields', () => {
    it('returns includeSystemContext + systemContextSections with matching order/group', () => {
      const fields = buildSystemContextSchemaFields(42);
      expect(Object.keys(fields).sort()).toEqual([
        'includeSystemContext',
        'systemContextSections',
      ]);

      const includeMeta = fields.includeSystemContext.meta() as {
        ui: { order: number; group: string; widget: string };
      };
      const sectionsMeta = fields.systemContextSections.meta() as {
        ui: { order: number; group: string; widget: string };
      };
      expect(includeMeta.ui.order).toBe(42);
      expect(sectionsMeta.ui.order).toBe(43);
      expect(includeMeta.ui.group).toBe('System Context');
      expect(sectionsMeta.ui.group).toBe('System Context');
    });

    it('honours a custom group label', () => {
      const fields = buildSystemContextSchemaFields(10, 'Custom Group');
      const includeMeta = fields.includeSystemContext.meta() as {
        ui: { group: string };
      };
      expect(includeMeta.ui.group).toBe('Custom Group');
    });

    it('defaults: includeSystemContext=true, sections=["time","timezone"]', () => {
      const fields = buildSystemContextSchemaFields(0);
      const includeDefault = fields.includeSystemContext.parse(undefined);
      const sectionsDefault = fields.systemContextSections.parse(undefined);
      expect(includeDefault).toBe(true);
      expect(sectionsDefault).toEqual(['time', 'timezone']);
    });
  });

  describe('pickNonDefaultSystemContext (spec §11.7)', () => {
    it('returns {} when both fields are absent (legacy row)', () => {
      expect(pickNonDefaultSystemContext({})).toEqual({});
    });

    it('returns {} when both fields equal defaults', () => {
      expect(
        pickNonDefaultSystemContext({
          includeSystemContext: true,
          systemContextSections: ['time', 'timezone'],
        }),
      ).toEqual({});
    });

    it('treats sections order/dup as equivalent to default', () => {
      expect(
        pickNonDefaultSystemContext({
          systemContextSections: ['timezone', 'time', 'time'],
        }),
      ).toEqual({});
    });

    it('echoes includeSystemContext when user opts out', () => {
      expect(
        pickNonDefaultSystemContext({
          includeSystemContext: false,
          systemContextSections: ['time', 'timezone'],
        }),
      ).toEqual({ includeSystemContext: false });
    });

    it('skips sections entirely when includeSystemContext is explicit false (noise trim)', () => {
      expect(
        pickNonDefaultSystemContext({
          includeSystemContext: false,
          systemContextSections: ['workspace', 'node'],
        }),
      ).toEqual({ includeSystemContext: false });
    });

    it('echoes only sections when user changes sections but keeps include=true (default)', () => {
      expect(
        pickNonDefaultSystemContext({
          includeSystemContext: true,
          systemContextSections: ['time', 'timezone', 'workspace'],
        }),
      ).toEqual({
        systemContextSections: ['time', 'timezone', 'workspace'],
      });
    });

    it('echoes empty sections array (treated as explicit opt-out variant)', () => {
      expect(
        pickNonDefaultSystemContext({
          systemContextSections: [],
        }),
      ).toEqual({ systemContextSections: [] });
    });

    it('ignores unrelated config fields', () => {
      expect(
        pickNonDefaultSystemContext({
          model: 'gpt-4o',
          systemPrompt: 'You are…',
        }),
      ).toEqual({});
    });

    it('returns {} when rawConfig is undefined', () => {
      expect(pickNonDefaultSystemContext(undefined)).toEqual({});
    });
  });
});
