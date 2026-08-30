import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { KbStatsHelper } from './kb-stats.helper';

describe('KbStatsHelper', () => {
  let helper: KbStatsHelper;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [KbStatsHelper, { provide: DataSource, useValue: dataSource }],
    }).compile();
    helper = module.get(KbStatsHelper);
  });

  it('runs a single atomic UPDATE that recounts entity + relation', async () => {
    // Raw `UPDATE … RETURNING` resolves to a `[rows, affectedCount]` tuple, not a bare
    // row array — this mock used to encode the same wrong shape that caused the
    // tracked 4-month bug (`01_12_26` testing W4). `refresh()` doesn't consume the
    // return value today, but the mock should still reflect the real driver contract
    // so a future consumer doesn't inherit a false shape from the test.
    dataSource.query.mockResolvedValue([
      [{ entity_count: 12, relation_count: 34 }],
      1,
    ]);

    await helper.refresh('kb-1');

    expect(dataSource.query).toHaveBeenCalledTimes(1);
    const [sql, params] = dataSource.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/UPDATE\s+knowledge_base/i);
    expect(sql).toMatch(/SET\s+entity_count\s*=\s*\(\s*SELECT\s+COUNT\(\*\)/i);
    expect(sql).toMatch(/relation_count\s*=\s*\(\s*SELECT\s+COUNT\(\*\)/i);
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\$1/i);
    expect(sql).toMatch(/RETURNING\s+entity_count,\s*relation_count/i);
    expect(params).toEqual(['kb-1']);
  });

  it('tolerates an empty RETURNING result (KB row missing) without throwing', async () => {
    // Same tuple shape, 0-row case: `[[], 0]`, not `[]`.
    dataSource.query.mockResolvedValue([[], 0]);

    await expect(helper.refresh('kb-missing')).resolves.toBeUndefined();
  });

  it('propagates DB errors to the caller', async () => {
    dataSource.query.mockRejectedValue(new Error('db down'));

    await expect(helper.refresh('kb-1')).rejects.toThrow('db down');
  });
});
