import { findMaskedResubmissions } from './reject-masked-resubmission';
import {
  VALUE_MASK_MARKER,
  KEY_MASK_MARKER,
  DEPTH_MASK_MARKER,
  MAX_REDACT_DEPTH,
} from '../../../shared/utils/sanitize-error-message';

/** 객체로 `depth` 단계 감싼다. leaf 는 정확히 `depth` 자리에 놓인다. */
function nestObj(depth: number, leaf: unknown): unknown {
  let v = leaf;
  for (let i = 0; i < depth; i++) v = { n: v };
  return v;
}

/** 같은 깊이를 **배열로** 쌓는다 — 두 분기가 같은 보폭으로 세는지 본다. */
function nestArr(depth: number, leaf: unknown): unknown {
  let v = leaf;
  for (let i = 0; i < depth; i++) v = [v];
  return v;
}

describe('findMaskedResubmissions', () => {
  it.each([VALUE_MASK_MARKER, KEY_MASK_MARKER, DEPTH_MASK_MARKER])(
    '스칼라 마커 `%s` 를 잡는다',
    (marker) => {
      expect(findMaskedResubmissions({ apiKey: marker })).toEqual([
        { field: 'apiKey', reason: 'masked_value_resubmitted' },
      ]);
    },
  );

  it('중첩 마커도 잡는다 — 스칼라만 보면 같은 구멍이 서버에 남는다', () => {
    expect(
      findMaskedResubmissions({ headers: { apiKey: VALUE_MASK_MARKER } }),
    ).toEqual([{ field: 'headers', reason: 'masked_value_resubmitted' }]);
    expect(
      findMaskedResubmissions({ list: [1, [2, [KEY_MASK_MARKER]]] }),
    ).toEqual([{ field: 'list', reason: 'masked_value_resubmitted' }]);
  });

  it('여러 필드가 걸리면 전부 돌려준다 (details[] 가 필드별이므로)', () => {
    const out = findMaskedResubmissions({
      a: VALUE_MASK_MARKER,
      ok: 'real',
      b: { deep: KEY_MASK_MARKER },
    });
    expect(out.map((e) => e.field).sort()).toEqual(['a', 'b']);
  });

  it('마커가 없으면 빈 배열', () => {
    expect(
      findMaskedResubmissions({ name: 'Alice', count: 3, flag: false }),
    ).toEqual([]);
    expect(findMaskedResubmissions({})).toEqual([]);
  });

  /**
   * **정확 일치 경계** — 프런트 `isMaskedMarker` 와 같아야 한다. 부분 포함으로 넓히면
   * `a***b` 같은 정상 값을 막아 가드가 정상 워크플로를 망가뜨린다. 두 층이 다른 경계를
   * 쓰면 한쪽만 통과하는 값이 생긴다.
   */
  it('[캐너리] 마커를 포함만 하는 값은 통과 — substring 으로 넓히면 RED', () => {
    expect(
      findMaskedResubmissions({
        note: 'a***b',
        md: '***bold***',
        dsn: 'postgres://***@db/prod',
      }),
    ).toEqual([]);
  });

  /**
   * **깊이 상한 경계** (EIA §R17 / #1188 에서 off-by-one = fail-open 으로 확인).
   *
   * 마스커는 `depth >= MAX_REDACT_DEPTH` 에서 서브트리를 마커로 **치환**하므로, 마스킹된
   * 값에서 마커가 놓일 수 있는 **가장 깊은 자리가 정확히 그 깊이**다. 값 검사가 깊이
   * 검사보다 먼저여야 그 자리를 본다 — 순서를 뒤집으면 검사도 않고 지나친다.
   */
  it('[경계] 상한 깊이의 마커는 잡는다 — 마스커 치환 지점', () => {
    // `k` 번 감싸면 마커는 depth `k` 에 놓인다. 값 검사가 깊이 검사보다 **먼저**라
    // depth === MAX_REDACT_DEPTH 자리까지 검사된다 — 마스커가 치환한 마커가 바로 거기 있다.
    const atCap = nestObj(MAX_REDACT_DEPTH, VALUE_MASK_MARKER);
    expect(findMaskedResubmissions({ p: atCap })).toHaveLength(1);
  });

  it('[경계] 상한보다 깊으면 보지 않는다 — 상한이 실재한다', () => {
    const past = nestObj(MAX_REDACT_DEPTH + 1, VALUE_MASK_MARKER);
    expect(findMaskedResubmissions({ p: past })).toEqual([]);
  });

  it('[경계] 배열 분기도 같은 보폭 — 과다/과소 계수면 RED', () => {
    expect(
      findMaskedResubmissions({
        p: nestArr(MAX_REDACT_DEPTH, VALUE_MASK_MARKER),
      }),
    ).toHaveLength(1);
    expect(
      findMaskedResubmissions({
        p: nestArr(MAX_REDACT_DEPTH + 1, VALUE_MASK_MARKER),
      }),
    ).toEqual([]);
  });

  /**
   * **스택 회귀** — 상한이 없으면 `RangeError`. 크기는 상한 없는 구현이 **실제로 터지는
   * 값**으로 골랐다(#1188 실측: `JSON.parse` 는 depth 100,000 을 통과시키는데 재귀는
   * 5,000 에서 터진다). 1,000 으로 잡으면 상한 없는 구현도 통과해 vacuous 하다.
   */
  it('[회귀] 매우 깊은 입력에서도 던지지 않는다', () => {
    const deep = JSON.parse(
      '['.repeat(5000) + '0' + ']'.repeat(5000),
    ) as unknown;
    expect(() => findMaskedResubmissions({ p: deep })).not.toThrow();
  });

  it('null·undefined·비객체를 안전하게 지나간다', () => {
    expect(
      findMaskedResubmissions({ a: null, b: undefined, c: 0, d: '' }),
    ).toEqual([]);
  });
});
