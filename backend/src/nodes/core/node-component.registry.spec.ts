import { z } from 'zod';
import { Test } from '@nestjs/testing';
import { NodeHandlerRegistry } from './node-handler.registry';
import { NodeComponentRegistry } from './node-component.registry';
import {
  HandlerDependencies,
  NodeComponent,
  NodeHandler,
} from './node-component.interface';

const handlerStub: NodeHandler = {
  validate: () => ({ valid: true, errors: [] }),
  execute: () => Promise.resolve({ config: {}, output: null }),
};

function makeComponent(
  type: string,
  overrides: Partial<NodeComponent> = {},
): NodeComponent {
  return {
    metadata: {
      type,
      category: 'logic',
      label: type,
      description: 'x',
      icon: 'Square',
      color: '#000',
    },
    ports: { inputs: [], outputs: [] },
    configSchema: z.object({ foo: z.string() }),
    createHandler: () => handlerStub,
    ...overrides,
  };
}

describe('NodeComponentRegistry', () => {
  let registry: NodeComponentRegistry;
  let handlerRegistry: NodeHandlerRegistry;
  const deps = {} as HandlerDependencies;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [NodeHandlerRegistry, NodeComponentRegistry],
    }).compile();

    registry = module.get(NodeComponentRegistry);
    handlerRegistry = module.get(NodeHandlerRegistry);
  });

  describe('bootstrap', () => {
    it('registers each component handler with the handler registry', () => {
      const createA = jest.fn().mockReturnValue(handlerStub);
      const createB = jest.fn().mockReturnValue(handlerStub);
      registry.bootstrap(
        [
          makeComponent('alpha', { createHandler: createA }),
          makeComponent('beta', { createHandler: createB }),
        ],
        deps,
      );

      expect(createA).toHaveBeenCalledWith(deps);
      expect(createB).toHaveBeenCalledWith(deps);
      expect(handlerRegistry.has('alpha')).toBe(true);
      expect(handlerRegistry.has('beta')).toBe(true);
    });

    it('throws on duplicate component type', () => {
      expect(() =>
        registry.bootstrap([makeComponent('dup'), makeComponent('dup')], deps),
      ).toThrow(/Duplicate node component/);
    });
  });

  describe('getComponent', () => {
    it('returns the registered component for known type', () => {
      const c = makeComponent('known');
      registry.bootstrap([c], deps);
      expect(registry.getComponent('known')).toBe(c);
    });

    it('returns undefined for unknown type', () => {
      expect(registry.getComponent('missing')).toBeUndefined();
    });
  });

  describe('listMetadata', () => {
    it('returns metadata for every registered component', () => {
      registry.bootstrap([makeComponent('a'), makeComponent('b')], deps);
      const types = registry.listMetadata().map((m) => m.type);
      expect(types).toEqual(['a', 'b']);
    });
  });

  describe('listDefinitions', () => {
    it('returns metadata + ports + JSON Schema', () => {
      registry.bootstrap([makeComponent('x')], deps);
      const [def] = registry.listDefinitions();
      expect(def.metadata.type).toBe('x');
      expect(def.ports).toEqual({ inputs: [], outputs: [] });
      expect(def.configSchema).toBeDefined();
      expect(typeof def.configSchema).toBe('object');
    });

    it('serializes input and output schemas when provided', () => {
      registry.bootstrap(
        [
          makeComponent('y', {
            inputSchema: z.array(z.number()),
            outputSchema: z.object({ ok: z.boolean() }),
          }),
        ],
        deps,
      );
      const [def] = registry.listDefinitions();
      expect(def.inputSchema).toBeDefined();
      expect(def.outputSchema).toBeDefined();
    });

    it('omits input/output schemas when not provided', () => {
      registry.bootstrap([makeComponent('z')], deps);
      const [def] = registry.listDefinitions();
      expect(def.inputSchema).toBeUndefined();
      expect(def.outputSchema).toBeUndefined();
    });
  });

  describe('listCategories', () => {
    it('returns all 7 node categories sorted by order', () => {
      const categories = registry.listCategories();
      expect(categories.map((c) => c.id)).toEqual([
        'trigger',
        'logic',
        'flow',
        'ai',
        'integration',
        'data',
        'presentation',
      ]);
      for (const c of categories) {
        expect(c.label).toBeTruthy();
        expect(c.icon).toBeTruthy();
        expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(typeof c.order).toBe('number');
      }
    });
  });
});
