import {
  FORBIDDEN_NOT_A_MEMBER,
  forbiddenForRole,
} from './forbidden-descriptions';

describe('403 설명 헬퍼 — 가드 거부 코드를 싣는 문장', () => {
  it('비멤버 문장은 NOT_A_MEMBER 를 싣는다', () => {
    expect(FORBIDDEN_NOT_A_MEMBER).toBe(
      '워크스페이스 멤버가 아님(NOT_A_MEMBER)',
    );
  });

  it('역할 문장은 비멤버와 역할 미달 두 코드를 싣는다', () => {
    expect(forbiddenForRole('editor')).toBe(
      '워크스페이스 멤버가 아님(NOT_A_MEMBER) 또는 Editor 이상 권한 필요(EDITOR_REQUIRED)',
    );
    expect(forbiddenForRole('admin')).toBe(
      '워크스페이스 멤버가 아님(NOT_A_MEMBER) 또는 Admin 이상 권한 필요(ADMIN_REQUIRED)',
    );
    expect(forbiddenForRole('owner')).toBe(
      '워크스페이스 멤버가 아님(NOT_A_MEMBER) 또는 Owner 권한 필요(OWNER_REQUIRED)',
    );
  });

  it('viewer 는 멤버십과 같다 — 비멤버 문장뿐이다', () => {
    expect(forbiddenForRole('viewer')).toBe(FORBIDDEN_NOT_A_MEMBER);
  });
});
