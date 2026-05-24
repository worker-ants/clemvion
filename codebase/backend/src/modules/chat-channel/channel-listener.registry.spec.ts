import { ChannelListenerRegistry } from './channel-listener.registry';

describe('ChannelListenerRegistry', () => {
  let registry: ChannelListenerRegistry;

  beforeEach(() => {
    registry = new ChannelListenerRegistry();
  });

  describe('register / has / get', () => {
    it('미등록 trigger — has false / get undefined / size 0', () => {
      expect(registry.has('t-1')).toBe(false);
      expect(registry.get('t-1')).toBeUndefined();
      expect(registry.size()).toBe(0);
    });

    it('register 후 has true / get entry / size 1', () => {
      registry.register('t-1', 'telegram');
      expect(registry.has('t-1')).toBe(true);
      const entry = registry.get('t-1');
      expect(entry?.provider).toBe('telegram');
      expect(entry?.registeredAt).toBeInstanceOf(Date);
      expect(registry.size()).toBe(1);
    });

    it('멱등성 — 동일 triggerId 재등록 시 overwrite (R8 setupChannel 멱등성)', () => {
      registry.register('t-1', 'telegram');
      const firstEntry = registry.get('t-1');
      registry.register('t-1', 'telegram');
      // size 가 1 그대로 — 중복 entry 추가 안 함.
      expect(registry.size()).toBe(1);
      // entry 가 새 객체로 교체됨 (overwrite).
      expect(registry.get('t-1')).not.toBe(firstEntry);
      expect(registry.get('t-1')?.provider).toBe('telegram');
    });

    it('provider 변경 시 entry overwrite + warning 로그', () => {
      const warnSpy = jest
        .spyOn(registry['logger'], 'warn')
        .mockImplementation();
      registry.register('t-1', 'telegram');
      registry.register('t-1', 'slack');
      expect(registry.get('t-1')?.provider).toBe('slack');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('provider 변경'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('unregister', () => {
    it('등록 → unregister → has false', () => {
      registry.register('t-1', 'telegram');
      registry.unregister('t-1');
      expect(registry.has('t-1')).toBe(false);
      expect(registry.size()).toBe(0);
    });

    it('미등록 trigger unregister — graceful noop', () => {
      expect(() => registry.unregister('never-registered')).not.toThrow();
      expect(registry.size()).toBe(0);
    });
  });

  describe('bulkRegister (bootstrap 복원)', () => {
    it('빈 registry 에 일괄 등록', () => {
      registry.bulkRegister([
        { triggerId: 't-1', provider: 'telegram' },
        { triggerId: 't-2', provider: 'slack' },
        { triggerId: 't-3', provider: 'discord' },
      ]);
      expect(registry.size()).toBe(3);
      expect(registry.get('t-1')?.provider).toBe('telegram');
      expect(registry.get('t-2')?.provider).toBe('slack');
      expect(registry.get('t-3')?.provider).toBe('discord');
    });

    it('기존 entry 가 있어도 bulk 덮어쓰기', () => {
      registry.register('t-1', 'telegram');
      registry.bulkRegister([{ triggerId: 't-1', provider: 'slack' }]);
      expect(registry.get('t-1')?.provider).toBe('slack');
      expect(registry.size()).toBe(1);
    });
  });

  describe('다중 provider 동시 등록', () => {
    it('telegram / slack / discord 모두 별 trigger 로 등록', () => {
      registry.register('t-tg', 'telegram');
      registry.register('t-sl', 'slack');
      registry.register('t-dc', 'discord');
      expect(registry.size()).toBe(3);
      expect(registry.has('t-tg')).toBe(true);
      expect(registry.has('t-sl')).toBe(true);
      expect(registry.has('t-dc')).toBe(true);
    });

    it('한 provider 의 trigger unregister 가 다른 provider 영향 X', () => {
      registry.register('t-tg', 'telegram');
      registry.register('t-sl', 'slack');
      registry.unregister('t-tg');
      expect(registry.has('t-tg')).toBe(false);
      expect(registry.has('t-sl')).toBe(true);
      expect(registry.size()).toBe(1);
    });
  });
});
