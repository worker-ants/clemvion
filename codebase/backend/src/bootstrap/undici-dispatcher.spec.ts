/**
 * undici autoSelectFamily global dispatcher 회귀 보호 test.
 *
 * SoT: ./undici-dispatcher.ts (Node 22 + undici IPv6 broken route ETIMEDOUT fix).
 *
 * 검증 전략: `undici` module 의 `setGlobalDispatcher` 와 `Agent` 를 jest mock 으로
 * 가로채 호출 인자 + 호출 횟수를 검증. 실 dispatcher 교체 side-effect 가 process-wide 라
 * 다른 test 오염을 회피해야 하므로 mock 이 더 안전.
 */

const setGlobalDispatcherMock = jest.fn();
const agentCtorMock = jest.fn();

jest.mock('undici', () => ({
  setGlobalDispatcher: (...args: unknown[]) => setGlobalDispatcherMock(...args),
  Agent: jest.fn().mockImplementation((opts: unknown) => {
    agentCtorMock(opts);
    return { __isMockAgent: true, opts };
  }),
}));

describe('undici-dispatcher — autoSelectFamily global dispatcher', () => {
  let resetAppliedForTesting: () => void;
  let applyAutoSelectFamilyDispatcher: () => void;

  beforeEach(() => {
    jest.resetModules();
    setGlobalDispatcherMock.mockClear();
    agentCtorMock.mockClear();
    delete process.env.DISABLE_UNDICI_AUTO_SELECT_FAMILY;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./undici-dispatcher') as {
      resetAppliedForTesting: () => void;
      applyAutoSelectFamilyDispatcher: () => void;
    };
    resetAppliedForTesting = mod.resetAppliedForTesting;
    applyAutoSelectFamilyDispatcher = mod.applyAutoSelectFamilyDispatcher;
  });

  it('module load 시점에 Agent({autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 300}) + setGlobalDispatcher 1회 호출', () => {
    // beforeEach 의 require() 시점에 module-level applyAutoSelectFamilyDispatcher() 1회 실행.
    expect(agentCtorMock).toHaveBeenCalledTimes(1);
    expect(agentCtorMock).toHaveBeenCalledWith({
      autoSelectFamily: true,
      autoSelectFamilyAttemptTimeout: 300,
    });
    expect(setGlobalDispatcherMock).toHaveBeenCalledTimes(1);
    // setGlobalDispatcher 의 첫 인자 = mock Agent 의 반환값
    const arg = setGlobalDispatcherMock.mock.calls[0]?.[0] as {
      __isMockAgent?: boolean;
    };
    expect(arg.__isMockAgent).toBe(true);
  });

  it('idempotent — applyAutoSelectFamilyDispatcher() 재호출 시 setGlobalDispatcher 추가 호출 없음', () => {
    // module load 시 1회 호출 후
    setGlobalDispatcherMock.mockClear();
    agentCtorMock.mockClear();
    applyAutoSelectFamilyDispatcher();
    applyAutoSelectFamilyDispatcher();
    applyAutoSelectFamilyDispatcher();
    expect(setGlobalDispatcherMock).not.toHaveBeenCalled();
    expect(agentCtorMock).not.toHaveBeenCalled();
  });

  it('resetAppliedForTesting() 후 재호출 — setGlobalDispatcher 다시 호출', () => {
    setGlobalDispatcherMock.mockClear();
    agentCtorMock.mockClear();
    resetAppliedForTesting();
    applyAutoSelectFamilyDispatcher();
    expect(setGlobalDispatcherMock).toHaveBeenCalledTimes(1);
    expect(agentCtorMock).toHaveBeenCalledTimes(1);
  });

  it('DISABLE_UNDICI_AUTO_SELECT_FAMILY=1 환경변수 — Agent 생성 skip, setGlobalDispatcher 호출 없음', () => {
    setGlobalDispatcherMock.mockClear();
    agentCtorMock.mockClear();
    resetAppliedForTesting();
    process.env.DISABLE_UNDICI_AUTO_SELECT_FAMILY = '1';
    applyAutoSelectFamilyDispatcher();
    expect(setGlobalDispatcherMock).not.toHaveBeenCalled();
    expect(agentCtorMock).not.toHaveBeenCalled();
  });
});
