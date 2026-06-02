import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { EmbedConfigService } from './embed-config.service';

function makeService(opts: {
  trigger?: Partial<Trigger> | null;
  workspace?: Partial<Workspace> | null;
  triggerThrows?: boolean;
}) {
  const triggerRepository = {
    findOne: opts.triggerThrows
      ? jest.fn().mockRejectedValue(new Error('db down'))
      : jest.fn().mockResolvedValue(opts.trigger ?? null),
  } as unknown as Repository<Trigger>;
  const workspaceRepository = {
    findOne: jest.fn().mockResolvedValue(opts.workspace ?? null),
  } as unknown as Repository<Workspace>;
  const svc = new EmbedConfigService(triggerRepository, workspaceRepository);
  return { svc, triggerRepository, workspaceRepository };
}

describe('EmbedConfigService', () => {
  it('allowlist 설정된 워크스페이스 → enforce=true', async () => {
    const { svc } = makeService({
      trigger: { workspaceId: 'ws1' } as Partial<Trigger>,
      workspace: {
        settings: {
          interactionAllowedOrigins: [
            'https://a.example.com',
            'https://b.example.com',
          ],
        },
      } as Partial<Workspace>,
    });
    const r = await svc.resolve('abc');
    expect(r).toEqual({
      allowlist: ['https://a.example.com', 'https://b.example.com'],
      enforce: true,
    });
  });

  it('allowlist 미설정(빈) → enforce=false (allow-all)', async () => {
    const { svc } = makeService({
      trigger: { workspaceId: 'ws1' } as Partial<Trigger>,
      workspace: { settings: {} } as Partial<Workspace>,
    });
    const r = await svc.resolve('abc');
    expect(r).toEqual({ allowlist: [], enforce: false });
  });

  it('비-문자열 origin 은 필터링', async () => {
    const { svc } = makeService({
      trigger: { workspaceId: 'ws1' } as Partial<Trigger>,
      workspace: {
        settings: {
          interactionAllowedOrigins: ['https://a.example.com', 123, null],
        },
      } as unknown as Partial<Workspace>,
    });
    const r = await svc.resolve('abc');
    expect(r).toEqual({ allowlist: ['https://a.example.com'], enforce: true });
  });

  it('trigger 미존재 → 빈 allowlist(allow-all, 존재 노출 회피)', async () => {
    const { svc, workspaceRepository } = makeService({ trigger: null });
    const r = await svc.resolve('nope');
    expect(r).toEqual({ allowlist: [], enforce: false });
    expect(workspaceRepository.findOne).not.toHaveBeenCalled();
  });

  it('조회 오류 → allow-all 로 degrade(위젯 비파손)', async () => {
    const { svc } = makeService({ triggerThrows: true });
    const r = await svc.resolve('abc');
    expect(r).toEqual({ allowlist: [], enforce: false });
  });

  it('인증 webhook(authConfigId NOT NULL) → trigger findOne 결과 없음 → 빈 allowlist(W4 필터)', async () => {
    // authConfigId: IsNull() 필터로 인증 webhook은 findOne 결과가 null 이어야 함.
    // 서비스 자체에서는 trigger===null → allow-all 를 반환하므로, 인증 webhook의
    // workspace allowlist 정보가 공개 노출되지 않음을 테스트.
    const { svc, workspaceRepository } = makeService({ trigger: null });
    const r = await svc.resolve('authenticated-endpoint');
    expect(r).toEqual({ allowlist: [], enforce: false });
    expect(workspaceRepository.findOne).not.toHaveBeenCalled();
  });
});