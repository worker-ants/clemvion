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
    // raw `UPDATE … RETURNING` 의 런타임 값은 행 배열이 아니라 `[rows, affectedCount]`
    // 튜플이다. 이 mock 은 **이 저장소가 4개월 앓은 결함과 똑같이 틀린 shape** 를
    // 인코딩하고 있었다 (`01_12_26` testing W4) — 그 결함이 오래 산 이유 자체가
    // "mock 이 틀린 현실을 가르쳐 준" 것이었다.
    //
    // `refresh()` 는 오늘 반환값을 안 쓴다. 그래도 mock 은 드라이버의 실제 계약을
    // 비춰야 한다 — 안 그러면 다음 소비자가 **테스트로부터 거짓 shape 를 물려받는다.**
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
    // 같은 튜플 shape 의 0행 케이스 — `[]` 가 아니라 `[[], 0]` 이다.
    dataSource.query.mockResolvedValue([[], 0]);

    await expect(helper.refresh('kb-missing')).resolves.toBeUndefined();
  });

  it('propagates DB errors to the caller', async () => {
    dataSource.query.mockRejectedValue(new Error('db down'));

    await expect(helper.refresh('kb-1')).rejects.toThrow('db down');
  });
});
