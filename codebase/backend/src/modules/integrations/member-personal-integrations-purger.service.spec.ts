import { MemberPersonalIntegrationsPurgerService } from './member-personal-integrations-purger.service';

describe('MemberPersonalIntegrationsPurgerService', () => {
  let integrationsService: { finishIntegrationDeletion: jest.Mock };
  let purger: MemberPersonalIntegrationsPurgerService;

  beforeEach(() => {
    integrationsService = {
      finishIntegrationDeletion: jest.fn().mockResolvedValue(undefined),
    };
    purger = new MemberPersonalIntegrationsPurgerService(
      integrationsService as never,
    );
  });

  describe('purgeInTransaction', () => {
    it('호출자의 매니저로 그 멤버의 개인 통합만 지우고 serviceType 으로 바꿔 돌려준다', async () => {
      // DELETE … RETURNING 은 `[rows, rowCount]` 튜플로 온다(CLE-ENG-RAWQUERY).
      const query = jest.fn().mockResolvedValue([
        [
          { id: 'int-1', service_type: 'cafe24', name: 'my-mall' },
          { id: 'int-2', service_type: 'google', name: 'Drive' },
        ],
        2,
      ]);

      const purged = await purger.purgeInTransaction({ query } as never, {
        workspaceId: 'ws-1',
        userId: 'user-7',
      });

      expect(purged).toEqual([
        { id: 'int-1', serviceType: 'cafe24', name: 'my-mall' },
        { id: 'int-2', serviceType: 'google', name: 'Drive' },
      ]);
      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      // 상태 · 사용처 조건이 없다. 조직 통합은 지우지 않는다.
      expect(sql.replace(/\s+/g, ' ')).toContain(
        "DELETE FROM integration WHERE workspace_id = $1 AND created_by = $2 AND scope = 'personal' RETURNING id, service_type, name",
      );
      expect(params).toEqual(['ws-1', 'user-7']);
    });

    it('지울 행이 없으면 빈 배열이다', async () => {
      const query = jest.fn().mockResolvedValue([[], 0]);
      await expect(
        purger.purgeInTransaction({ query } as never, {
          workspaceId: 'ws-1',
          userId: 'user-7',
        }),
      ).resolves.toEqual([]);
    });

    it('결과 형태가 어긋나면 던져 트랜잭션을 되돌린다', async () => {
      const query = jest.fn().mockResolvedValue({ rowCount: 1 });
      await expect(
        purger.purgeInTransaction({ query } as never, {
          workspaceId: 'ws-1',
          userId: 'user-7',
        }),
      ).rejects.toThrow(/RETURNING/);
    });
  });

  describe('finishAfterCommit', () => {
    const departure = {
      workspaceId: 'ws-1',
      actorUserId: 'admin-1',
      mode: 'removed' as const,
      memberUserId: 'user-7',
    };
    const purged = [
      { id: 'int-1', serviceType: 'cafe24', name: 'my-mall' },
      { id: 'int-2', serviceType: 'google', name: 'Drive' },
    ];

    it('지운 통합마다 일반 삭제와 같은 후처리를 나가기 · 제거의 맥락과 함께 부른다', async () => {
      await purger.finishAfterCommit(purged, departure);

      expect(integrationsService.finishIntegrationDeletion.mock.calls).toEqual(
        purged.map((row) => [
          row,
          { workspaceId: 'ws-1', userId: 'admin-1' },
          { mode: 'removed', memberUserId: 'user-7' },
        ]),
      );
    });

    it('한 통합의 후처리가 던져도 던지지 않고 나머지를 이어 간다', async () => {
      integrationsService.finishIntegrationDeletion.mockRejectedValueOnce(
        new Error('redis down'),
      );

      await expect(
        purger.finishAfterCommit(purged, departure),
      ).resolves.toBeUndefined();
      expect(
        integrationsService.finishIntegrationDeletion,
      ).toHaveBeenCalledTimes(2);
    });
  });
});
