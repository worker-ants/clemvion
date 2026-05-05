/**
 * Unit tests for the pure backfill logic in `migrate-button-ids.ts`. The
 * DB-touching `main()` path is exercised manually (staging dry-run before
 * prod apply); this suite locks in the idempotency / preservation /
 * fallback rules so legacy edges survive the migration.
 */
import {
  backfillButtonIds,
  BackfillHit,
} from '../../scripts/migrate-button-ids';

describe('backfillButtonIds', () => {
  function run(config: Record<string, unknown>): {
    out: Record<string, unknown>;
    hits: BackfillHit[];
  } {
    const hits: BackfillHit[] = [];
    const out = backfillButtonIds('wf-1', 'node-1', config, hits);
    return { out, hits };
  }

  it('빈 button id 를 btn_${i} fallback 으로 채움', () => {
    const { out, hits } = run({
      buttons: [{ label: 'A' }, { label: 'B' }],
    });
    expect((out.buttons as Array<{ id: string }>).map((b) => b.id)).toEqual([
      'btn_0',
      'btn_1',
    ]);
    expect(hits).toHaveLength(2);
    expect(hits[0].location).toBe('buttons[0]');
    expect(hits[0].newId).toBe('btn_0');
  });

  it('살아있는 id 는 그대로 보존', () => {
    const input = {
      buttons: [
        { id: 'confirm', label: 'A' },
        { id: 'cancel', label: 'B' },
      ],
    };
    const { out, hits } = run(input);
    expect(hits).toHaveLength(0);
    expect(out).toBe(input); // reference 동일 = mutation 없음
  });

  it('itemButtons 위치는 itemBtn_${i} fallback', () => {
    const { out, hits } = run({
      itemButtons: [{}, {}, { id: 'keep' }],
    });
    expect((out.itemButtons as Array<{ id: string }>).map((b) => b.id)).toEqual(
      ['itemBtn_0', 'itemBtn_1', 'keep'],
    );
    expect(hits).toHaveLength(2);
    expect(hits[0].location).toBe('itemButtons[0]');
  });

  it('items[*].buttons 는 items_${i}_btn_${j} fallback', () => {
    const { out, hits } = run({
      items: [
        { title: 'X', buttons: [{}, { id: 'keep' }] },
        { title: 'Y', buttons: [{}] },
      ],
    });
    const items = out.items as Array<{ buttons: Array<{ id: string }> }>;
    expect(items[0].buttons.map((b) => b.id)).toEqual([
      'items_0_btn_0',
      'keep',
    ]);
    expect(items[1].buttons.map((b) => b.id)).toEqual(['items_1_btn_0']);
    expect(hits).toHaveLength(2);
  });

  it('invalid slug 인 id (e.g. 공백 포함) 은 살아있다고 보지 않고 재부여', () => {
    const { out, hits } = run({
      buttons: [
        { id: 'has space', label: 'A' },
        { id: 'OK_id', label: 'B' },
      ],
    });
    const buttons = out.buttons as Array<{ id: string }>;
    expect(buttons[0].id).toBe('btn_0');
    expect(buttons[1].id).toBe('OK_id');
    expect(hits).toHaveLength(1);
  });

  it('변경 없으면 input 그대로 (reference 비교)', () => {
    const input = { buttons: [{ id: 'a', label: 'A' }] };
    const { out } = run(input);
    expect(out).toBe(input);
  });

  it('button 위치 3곳 동시 backfill', () => {
    const { out, hits } = run({
      buttons: [{}],
      itemButtons: [{}],
      items: [{ buttons: [{}] }],
    });
    expect((out.buttons as Array<{ id: string }>)[0].id).toBe('btn_0');
    expect((out.itemButtons as Array<{ id: string }>)[0].id).toBe('itemBtn_0');
    expect(
      (out.items as Array<{ buttons: Array<{ id: string }> }>)[0].buttons[0].id,
    ).toBe('items_0_btn_0');
    expect(hits).toHaveLength(3);
  });

  it('idempotent — 두 번 호출해도 hits 추가 없음', () => {
    const first = run({ buttons: [{ label: 'A' }] });
    const hits2: BackfillHit[] = [];
    const second = backfillButtonIds('wf-1', 'node-1', first.out, hits2);
    expect(hits2).toHaveLength(0);
    expect(second).toBe(first.out);
  });
});
