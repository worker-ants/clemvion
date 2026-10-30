import {
  MEMBER_PERSONAL_INTEGRATIONS_PURGER,
  resolveMemberPersonalIntegrationsPurger,
} from './member-personal-integrations.port';

describe('resolveMemberPersonalIntegrationsPurger', () => {
  it('포트 토큰을 strict:false 로 찾아 구현을 그대로 돌려준다', () => {
    const purger = {
      purgeInTransaction: jest.fn(),
      finishAfterCommit: jest.fn(),
    };
    const get = jest.fn().mockReturnValue(purger);

    expect(resolveMemberPersonalIntegrationsPurger({ get })).toBe(purger);
    // 통합 모듈이 구현하므로 워크스페이스 모듈의 컨텍스트 밖에서 찾는다.
    expect(get).toHaveBeenCalledWith(MEMBER_PERSONAL_INTEGRATIONS_PURGER, {
      strict: false,
    });
  });

  // 못 찾았을 때 조용히 넘어가면 나간 멤버의 개인 통합이 다시 남는다. 호출자(나가기 · 제거)가 트랜잭션을 열기 전에 이 오류로
  // 끝나도록 오류를 삼키지 않고 그대로 던진다.
  it('못 찾으면 ModuleRef.get 의 오류를 삼키지 않고 그대로 던진다', () => {
    const notFound = new Error('Nest could not find the provider');
    const get = jest.fn().mockImplementation(() => {
      throw notFound;
    });

    expect(() => resolveMemberPersonalIntegrationsPurger({ get })).toThrow(
      notFound,
    );
  });
});
