import { resolveTriggerParametersRejectingMasked } from './reject-masked-resubmission';
import {
  TriggerParameterDefinition,
  TriggerParameterValidationException,
} from '../types/trigger-parameter.types';
import {
  VALUE_MASK_MARKER,
  KEY_MASK_MARKER,
  DEPTH_MASK_MARKER,
  MAX_REDACT_DEPTH,
  deepRedactSecrets,
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

/** 마커 사유로 거부된 필드 목록. 통과하면 빈 배열. */
function rejectedFields(
  schema: TriggerParameterDefinition[],
  raw: unknown,
): string[] {
  try {
    resolveTriggerParametersRejectingMasked(schema, raw);
    return [];
  } catch (err_: unknown) {
    if (err_ instanceof TriggerParameterValidationException) {
      return err_.errors
        .filter((e) => e.reason === 'masked_value_resubmitted')
        .map((e) => e.field);
    }
    throw err_;
  }
}

describe('resolveTriggerParametersRejectingMasked', () => {
  it.each([VALUE_MASK_MARKER, KEY_MASK_MARKER, DEPTH_MASK_MARKER])(
    '스칼라 마커 `%s` 를 거부한다',
    (marker) => {
      expect(
        rejectedFields([{ name: 'apiKey', type: 'string' }], {
          apiKey: marker,
        }),
      ).toEqual(['apiKey']);
    },
  );

  /**
   * **타입별 우회** — 초판이 resolve **결과만** 검사해 뚫린 자리다(`00_03_57` CRITICAL).
   *
   * `coerceToType('***', 'boolean')` 은 `Boolean('***')` → `true` 라, 검사 시점엔 원본
   * 문자열이 이미 사라져 있었다. `number` 는 `coerce_failed` 가 먼저 throw 돼 사용자가
   * *"타입 오류"* 를 봤다 — 안내 자체가 틀린다.
   */
  it('[캐너리] boolean 필드의 마커도 거부한다 — coerce 가 문자열을 지우기 전에 본다', () => {
    expect(
      rejectedFields([{ name: 'flag', type: 'boolean' }], {
        flag: VALUE_MASK_MARKER,
      }),
    ).toEqual(['flag']);
  });

  it('[캐너리] number 필드는 coerce_failed 가 아니라 마커 사유로 거부한다', () => {
    expect(
      rejectedFields([{ name: 'n', type: 'number' }], { n: VALUE_MASK_MARKER }),
    ).toEqual(['n']);
  });

  /**
   * **object/array 를 JSON 문자열로 보내는 경로** — raw 만 보면 그 문자열은 마커와 정확히
   * 일치하지 않아 통과한다. 마커는 파싱 뒤에야 leaf 로 드러나므로 resolve 후에도 본다.
   */
  it('[캐너리] object 를 JSON 문자열로 보내도 파싱 후 마커를 잡는다', () => {
    expect(
      rejectedFields([{ name: 'headers', type: 'object' }], {
        headers: `{"apiKey":"${VALUE_MASK_MARKER}"}`,
      }),
    ).toEqual(['headers']);
  });

  it('중첩 마커를 잡는다 — 스칼라만 보면 #1188 의 CRITICAL 이 서버에 남는다', () => {
    expect(
      rejectedFields([{ name: 'headers', type: 'object' }], {
        headers: { apiKey: VALUE_MASK_MARKER },
      }),
    ).toEqual(['headers']);
    expect(
      rejectedFields([{ name: 'list', type: 'array' }], {
        list: [1, [2, [KEY_MASK_MARKER]]],
      }),
    ).toEqual(['list']);
  });

  it('여러 필드가 걸리면 전부 돌려준다 (details[] 가 필드별이므로)', () => {
    expect(
      rejectedFields(
        [
          { name: 'a', type: 'string' },
          { name: 'ok', type: 'string' },
          { name: 'b', type: 'object' },
        ],
        { a: VALUE_MASK_MARKER, ok: 'real', b: { deep: KEY_MASK_MARKER } },
      ).sort(),
    ).toEqual(['a', 'b']);
  });

  /**
   * **과잉 차단 방지** — `defaultValue` 로 채워진 필드는 **사용자가 보낸 값이 아니다**.
   * resolve 결과만 보면 그것도 걸려 매 실행이 400 이 된다(`00_03_57` W2). 대상 키 집합을
   * 언제나 raw 기준으로 잡아 막는다.
   */
  it('[캐너리] defaultValue 가 마커여도 손대지 않은 필드는 막지 않는다', () => {
    expect(
      rejectedFields(
        [{ name: 'd', type: 'string', defaultValue: VALUE_MASK_MARKER }],
        {},
      ),
    ).toEqual([]);
  });

  it('마커가 없으면 통과하고 resolve 결과를 돌려준다', () => {
    const out = resolveTriggerParametersRejectingMasked(
      [
        { name: 'name', type: 'string' },
        { name: 'count', type: 'number' },
      ],
      { name: 'Alice', count: '5' },
    );
    expect(out).toEqual({ name: 'Alice', count: 5 });
  });

  it('스키마가 없거나 비면 통과한다 (pass-through 호환)', () => {
    expect(
      resolveTriggerParametersRejectingMasked(undefined, {
        x: VALUE_MASK_MARKER,
      }),
    ).toEqual({});
    expect(rejectedFields([], { x: VALUE_MASK_MARKER })).toEqual([]);
  });

  /**
   * **정확 일치 경계** — 프런트 `isMaskedMarker` 와 같아야 한다. 부분 포함으로 넓히면
   * `a***b` 같은 정상 값을 막아 가드가 정상 워크플로를 망가뜨린다.
   */
  it('[캐너리] 마커를 포함만 하는 값은 통과 — substring 으로 넓히면 RED', () => {
    expect(
      rejectedFields(
        [
          { name: 'note', type: 'string' },
          { name: 'md', type: 'string' },
          { name: 'dsn', type: 'string' },
        ],
        { note: 'a***b', md: '***bold***', dsn: 'postgres://***@db/prod' },
      ),
    ).toEqual([]);
  });

  /**
   * **깊이 상한 경계**. 마스커는 `depth >= MAX_REDACT_DEPTH` 에서 서브트리를 마커로
   * **치환**하므로 마커가 놓일 수 있는 가장 깊은 자리가 그 깊이다. `k` 번 감싸면 마커는
   * depth `k` 에 놓이고, 값 검사가 깊이 검사보다 **먼저**라 `k === MAX_REDACT_DEPTH` 까지
   * 검사된다 — 순서를 뒤집으면 그 자리를 놓친다(off-by-one = fail-open).
   */
  it('[경계] 상한 깊이의 마커는 잡는다 — 마스커 치환 지점', () => {
    expect(
      rejectedFields([{ name: 'p', type: 'object' }], {
        p: nestObj(MAX_REDACT_DEPTH, VALUE_MASK_MARKER),
      }),
    ).toEqual(['p']);
  });

  it('[경계] 상한보다 깊으면 보지 않는다 — 상한이 실재한다', () => {
    expect(
      rejectedFields([{ name: 'p', type: 'object' }], {
        p: nestObj(MAX_REDACT_DEPTH + 1, VALUE_MASK_MARKER),
      }),
    ).toEqual([]);
  });

  it('[경계] 배열 분기도 같은 보폭 — 과다/과소 계수면 RED', () => {
    expect(
      rejectedFields([{ name: 'p', type: 'array' }], {
        p: nestArr(MAX_REDACT_DEPTH, VALUE_MASK_MARKER),
      }),
    ).toEqual(['p']);
    expect(
      rejectedFields([{ name: 'p', type: 'array' }], {
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
    expect(() =>
      rejectedFields([{ name: 'p', type: 'array' }], { p: deep }),
    ).not.toThrow();
  });

  /**
   * **왕복 통합 — 실제 마스커를 태운다** (`00_03_57` architecture W3 / testing W9).
   *
   * 위 경계 테스트들은 `nestObj`/`nestArr` 라는 **내 모델**을 쓴다. 마스커
   * (`deepRedactSecrets`)와 판정기(`hasMaskedLeaf`)는 `MAX_REDACT_DEPTH` 상수만 공유하고
   * **재귀 구현은 각자**라, 모델이 맞아도 실제 산출물과 어긋날 수 있다.
   *
   * 이 테스트는 그 사이를 기계가 잇는다 — 마스커가 실제로 만든 값을 판정기에 그대로
   * 먹인다. 마스커의 캡 처리나 마커 문자열이 바뀌면 여기가 RED 다.
   */
  it('[통합] 실제 마스커가 만든 값을 판정기가 잡는다 (왕복)', () => {
    // 자격증명 키 이름이라 마스커가 값을 통째로 치환한다.
    const masked = deepRedactSecrets({
      apiKey: 'sk-live-abc123',
      nested: { password: 'hunter2' },
      keep: 'plain text',
    }) as Record<string, unknown>;

    // 전제 확인 — 마스커가 실제로 마커를 남겼다(안 남기면 아래가 vacuous 하다).
    expect(JSON.stringify(masked)).toContain(VALUE_MASK_MARKER);
    expect(masked.keep).toBe('plain text');

    // 그 산출물을 사용자가 그대로 되보낸 상황.
    expect(
      rejectedFields(
        [
          { name: 'apiKey', type: 'string' },
          { name: 'nested', type: 'object' },
          { name: 'keep', type: 'string' },
        ],
        masked,
      ).sort(),
    ).toEqual(['apiKey', 'nested']);
  });

  it('null·비객체 raw 를 안전하게 지나간다', () => {
    expect(rejectedFields([{ name: 'a', type: 'string' }], null)).toEqual([]);
    expect(rejectedFields([{ name: 'a', type: 'string' }], 'nope')).toEqual([]);
  });
});
