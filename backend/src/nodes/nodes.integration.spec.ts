import { ALL_NODE_COMPONENTS } from './index';

describe('Node components', () => {
  it('registers a unique type for each component', () => {
    const types = ALL_NODE_COMPONENTS.map((c) => c.metadata.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('ships matching metadata fields (type, category, label, icon, color)', () => {
    for (const c of ALL_NODE_COMPONENTS) {
      expect(c.metadata.type).toBeTruthy();
      expect(c.metadata.category).toBeTruthy();
      expect(c.metadata.label).toBeTruthy();
      expect(c.metadata.icon).toBeTruthy();
      expect(c.metadata.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('declares non-null input/output port arrays', () => {
    for (const c of ALL_NODE_COMPONENTS) {
      expect(Array.isArray(c.ports.inputs)).toBe(true);
      expect(Array.isArray(c.ports.outputs)).toBe(true);
    }
  });

  it.each(ALL_NODE_COMPONENTS.map((c) => [c.metadata.type, c] as const))(
    '%s: defaultConfig satisfies configSchema',
    (_type, component) => {
      const defaults = component.metadata.defaultConfig ?? {};
      const result = component.configSchema.safeParse(defaults);
      if (!result.success) {
        throw new Error(
          `defaultConfig invalid for ${component.metadata.type}: ${JSON.stringify(result.error.issues)}`,
        );
      }
      expect(result.success).toBe(true);
    },
  );
});
