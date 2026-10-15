import { isWorkflowInactive } from './is-workflow-inactive';

// 근거: NERV Task `CLE-T-XRWFMJ`. 워크플로우를 끄면 웹훅 · 채팅 채널 · 스케줄로 실행이 생기지 않는다.
describe('isWorkflowInactive', () => {
  it('실행을 시작하는 워크스페이스 안에서 id 와 활성 여부만 읽는다', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'wf1', isActive: true }),
    };

    await isWorkflowInactive(repo, 'wf1', 'ws');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'wf1', workspaceId: 'ws' },
      select: { id: true, isActive: true },
    });
  });

  it('워크플로우가 꺼져 있으면 true 다', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'wf1', isActive: false }),
    };

    await expect(isWorkflowInactive(repo, 'wf1', 'ws')).resolves.toBe(true);
  });

  it('워크플로우가 켜져 있으면 false 다', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'wf1', isActive: true }),
    };

    await expect(isWorkflowInactive(repo, 'wf1', 'ws')).resolves.toBe(false);
  });

  it('워크스페이스에 워크플로우가 없으면 false 다(거부는 실행 엔진이 한다)', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null) };

    await expect(isWorkflowInactive(repo, 'wf1', 'ws')).resolves.toBe(false);
  });
});
