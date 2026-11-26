import type { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import {
  BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS,
  compactBackgroundFlatOutputCache,
} from './background-execution.queue';

type Structured = ExecutionContext['structuredOutputCache'];

describe('background-execution.queue', () => {
  // 끝난 작업은 건수가 아니라 나이로 지운다(NERV Task CLE-T-9XMCS6). 작업 데이터에 노드 출력
  // 스냅샷이 실려 건수 기준이면 큰 작업이 Redis 에 오래 남는다. 실패 작업은 조사할 시간을 남긴다.
  it('완료 작업은 24시간, 실패 작업은 7일 뒤 지운다', () => {
    expect(BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS).toEqual({
      removeOnComplete: { age: 24 * 60 * 60 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    });
  });

  // 구조화 항목이 있는 노드의 flat 값은 작은 표지로 줄여 싣는다(NERV Task CLE-T-XTTSXB).
  describe('compactBackgroundFlatOutputCache', () => {
    const structuredOf = (output: unknown, port = 'success'): Structured =>
      ({ config: {}, output, port }) as unknown as Structured;

    it('구조화 항목이 있으면 flat 값 대신 라우팅 표지만 남긴다', () => {
      const flat = {
        a: { rows: [1, 2, 3], _selectedPort: 'success' },
        b: { data: [4, 5], _selectedPort: 'true' },
      };
      const structured = {
        a: structuredOf({ rows: [1, 2, 3] }),
        b: structuredOf([4, 5], 'true'),
      } as unknown as Structured;

      expect(compactBackgroundFlatOutputCache(flat, structured)).toStrictEqual({
        a: { _selectedPort: 'success' },
        b: { _selectedPort: 'true' },
      });
    });

    it.each([
      ['라우팅 표지가 없는 객체', { a: 1 }],
      ['배열', [1, 2, 3]],
      ['원시값', 42],
      ['문자열', 'hello'],
      ['false', false],
    ])(
      '구조화 항목이 있고 flat 값이 %s 이면 빈 객체 표지다',
      (_label, value) => {
        const structured = { a: structuredOf(value) } as unknown as Structured;

        expect(
          compactBackgroundFlatOutputCache({ a: value }, structured),
        ).toStrictEqual({ a: {} });
      },
    );

    // 구조화 항목이 없는 노드는 본문 표현식과 다음 노드 입력이 flat 값으로 대신 읽는다.
    it('구조화 항목이 없는 노드의 flat 값은 그대로 둔다', () => {
      const flat = { a: { rows: [1] }, legacy: { hello: 'world' } };
      const structured = {
        a: structuredOf({ rows: [1] }),
      } as unknown as Structured;

      const compacted = compactBackgroundFlatOutputCache(flat, structured);

      expect(compacted.legacy).toBe(flat.legacy);
      expect(compacted.a).toStrictEqual({});
    });

    it('구조화 캐시가 없으면 모든 flat 값을 그대로 둔다', () => {
      const flat = { a: { rows: [1] }, b: [2] };

      expect(compactBackgroundFlatOutputCache(flat, undefined)).toStrictEqual(
        flat,
      );
    });

    it('구조화 항목 값이 undefined 이면 없는 것으로 본다', () => {
      const flat = { a: { rows: [1] } };
      const structured = { a: undefined } as unknown as Structured;

      expect(compactBackgroundFlatOutputCache(flat, structured)).toStrictEqual(
        flat,
      );
    });

    // undefined 를 표지로 바꾸면 메인에서 보이지 않던 노드가 본문 `$node` 에 새로 보인다.
    it('flat 값이 undefined 나 null 이면 그대로 두고 키도 지우지 않는다', () => {
      const flat: Record<string, unknown> = { a: undefined, b: null };
      const structured = {
        a: structuredOf(1),
        b: structuredOf(null),
      } as unknown as Structured;

      const compacted = compactBackgroundFlatOutputCache(flat, structured);

      expect(Object.keys(compacted)).toEqual(['a', 'b']);
      expect(compacted.a).toBeUndefined();
      expect(compacted.b).toBeNull();
    });

    it('입력 캐시를 바꾸지 않는다', () => {
      const flat = { a: { rows: [1], _selectedPort: 'success' } };
      const structured = {
        a: structuredOf({ rows: [1] }),
      } as unknown as Structured;

      compactBackgroundFlatOutputCache(flat, structured);

      expect(flat).toStrictEqual({
        a: { rows: [1], _selectedPort: 'success' },
      });
    });

    // 작업 데이터 크기: 큰 노드 출력이 구조화 캐시에 한 번만 실린다.
    it('큰 출력이 있어도 표지로 줄인 flat 캐시는 몇 바이트다', () => {
      const big = { items: Array.from({ length: 5_000 }, (_, i) => ({ i })) };
      const flat = { a: { ...big, _selectedPort: 'success' } };
      const structured = { a: structuredOf(big) } as unknown as Structured;

      const before = JSON.stringify(flat).length;
      const after = JSON.stringify(
        compactBackgroundFlatOutputCache(flat, structured),
      ).length;

      expect(before).toBeGreaterThan(40_000);
      expect(after).toBeLessThan(40);
    });
  });
});
