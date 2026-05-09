import { NodeHandlerRegistry } from './node-handler.registry';
import { NodeHandler } from './node-handler.interface';

const noopHandler: NodeHandler = {
  validate: () => ({ valid: true, errors: [] }),
  execute: async () => ({ config: {}, output: null }),
};

describe('NodeHandlerRegistry', () => {
  let registry: NodeHandlerRegistry;

  beforeEach(() => {
    registry = new NodeHandlerRegistry();
  });

  describe('register / get / has', () => {
    it('registers and retrieves a handler', () => {
      registry.register('test_node', noopHandler);
      expect(registry.has('test_node')).toBe(true);
      expect(registry.get('test_node')).toBe(noopHandler);
    });

    it('throws UNKNOWN_NODE_TYPE for unknown type', () => {
      expect(() => registry.get('unknown')).toThrow(/UNKNOWN_NODE_TYPE/);
    });
  });

  // PR-G — self-registering metadata
  describe('getMetadata', () => {
    it('returns sentinel { kind: "standard" } when metadata not registered', () => {
      registry.register('legacy', noopHandler);
      expect(registry.getMetadata('legacy')).toEqual({ kind: 'standard' });
    });

    it('returns explicit metadata when registered', () => {
      registry.register('foreach', noopHandler, { kind: 'container' });
      expect(registry.getMetadata('foreach')).toEqual({ kind: 'container' });
    });

    it('handles all kinds (discriminated union round-trip)', () => {
      registry.register('a', noopHandler, { kind: 'standard' });
      registry.register('b', noopHandler, { kind: 'container' });
      registry.register('c', noopHandler, { kind: 'background' });
      registry.register('d', noopHandler, { kind: 'parallel' });
      registry.register('e', noopHandler, {
        kind: 'blocking',
        interaction: 'form',
      });
      registry.register('f', noopHandler, { kind: 'trigger' });
      expect(registry.getMetadata('a').kind).toBe('standard');
      expect(registry.getMetadata('b').kind).toBe('container');
      expect(registry.getMetadata('c').kind).toBe('background');
      expect(registry.getMetadata('d').kind).toBe('parallel');
      const blocking = registry.getMetadata('e');
      expect(blocking.kind).toBe('blocking');
      if (blocking.kind === 'blocking') {
        expect(blocking.interaction).toBe('form');
      }
      expect(registry.getMetadata('f').kind).toBe('trigger');
    });
  });

  describe('assertConsistency', () => {
    const prevEnv = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = prevEnv;
    });

    it('passes when all registered handlers have metadata', () => {
      registry.register('a', noopHandler, { kind: 'standard' });
      registry.register('b', noopHandler, { kind: 'container' });
      expect(() => registry.assertConsistency()).not.toThrow();
    });

    it('throws in production when a handler is registered without metadata', () => {
      process.env.NODE_ENV = 'production';
      registry.register('a', noopHandler, { kind: 'standard' });
      registry.register('b', noopHandler); // missing
      expect(() => registry.assertConsistency()).toThrow(
        /assertConsistency.*1 node type.*\[b\]/,
      );
    });

    it('warns (no throw) in non-production for missing metadata', () => {
      process.env.NODE_ENV = 'test';
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      registry.register('a', noopHandler);
      expect(() => registry.assertConsistency()).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('NodeHandlerRegistry'),
      );
      warnSpy.mockRestore();
    });
  });
});
