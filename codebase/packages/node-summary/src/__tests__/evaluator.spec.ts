import {
  evaluateWarnings,
  evaluateWhen,
  renderSummaryTemplate,
  renderTemplate,
} from '../evaluator';
import { WarningRule } from '../types';

describe('evaluateWhen — atom forms', () => {
  it('returns false on empty / non-string input', () => {
    expect(evaluateWhen('', {})).toBe(false);
    expect(evaluateWhen('   ', {})).toBe(false);
    // @ts-expect-error — intentional bad input
    expect(evaluateWhen(undefined, {})).toBe(false);
  });

  it('"!path" matches falsy values (undefined, null, "", [], 0, false)', () => {
    expect(evaluateWhen('!missing', {})).toBe(true);
    expect(evaluateWhen('!emptyStr', { emptyStr: '' })).toBe(true);
    expect(evaluateWhen('!emptyArr', { emptyArr: [] })).toBe(true);
    expect(evaluateWhen('!zero', { zero: 0 })).toBe(true);
    expect(evaluateWhen('!off', { off: false })).toBe(true);
    expect(evaluateWhen('!present', { present: 'x' })).toBe(false);
  });

  it('plain "path" matches truthy values', () => {
    expect(evaluateWhen('value', { value: 'present' })).toBe(true);
    expect(evaluateWhen('value', { value: '' })).toBe(false);
    expect(evaluateWhen('value', { value: [] })).toBe(false);
  });

  it('"path == value" / "path != value" via stringified equality', () => {
    expect(evaluateWhen('mode == dynamic', { mode: 'dynamic' })).toBe(true);
    expect(evaluateWhen('mode == static', { mode: 'dynamic' })).toBe(false);
    expect(evaluateWhen('mode != static', { mode: 'dynamic' })).toBe(true);
    expect(evaluateWhen('count == 3', { count: 3 })).toBe(true);
    expect(evaluateWhen('flag == true', { flag: true })).toBe(true);
  });

  it('numeric comparisons (>, <, >=, <=)', () => {
    expect(evaluateWhen('count > 3', { count: 5 })).toBe(true);
    expect(evaluateWhen('count > 3', { count: 3 })).toBe(false);
    expect(evaluateWhen('count >= 3', { count: 3 })).toBe(true);
    expect(evaluateWhen('count < 10', { count: 5 })).toBe(true);
    expect(evaluateWhen('count <= 5', { count: 5 })).toBe(true);
    // non-numeric LHS coerces to NaN → comparison is false (no rule fires).
    expect(evaluateWhen('label > 3', { label: 'hi' })).toBe(false);
  });

  it('length(path) call returns array / string length, 0 for missing', () => {
    expect(evaluateWhen('length(buttons) > 10', { buttons: new Array(11) })).toBe(
      true,
    );
    expect(evaluateWhen('length(buttons) > 10', { buttons: new Array(10) })).toBe(
      false,
    );
    expect(evaluateWhen('length(missing) > 0', {})).toBe(false);
    expect(evaluateWhen('length(name) >= 3', { name: 'abc' })).toBe(true);
    // legacy `path.length` form still works (mirrors old interpreter)
    expect(evaluateWhen('!buttons.length', { buttons: [] })).toBe(true);
  });
});

describe('evaluateWhen — combinators', () => {
  it('"&&" requires all atoms', () => {
    const config = { mode: 'dynamic' };
    expect(evaluateWhen('mode == dynamic && !titleField', config)).toBe(true);
    expect(
      evaluateWhen('mode == dynamic && !titleField', {
        ...config,
        titleField: 'name',
      }),
    ).toBe(false);
  });

  it('"||" matches if any atom is true', () => {
    expect(evaluateWhen('!titleField || !items', { items: [{ a: 1 }] })).toBe(
      true,
    );
    expect(
      evaluateWhen('!titleField || !items', {
        titleField: 'x',
        items: [{ a: 1 }],
      }),
    ).toBe(false);
  });

  it('mix: "A && B || C" — AND binds tighter via split order', () => {
    // mode==static && !items   →  false (mode is dynamic)
    // ||
    // !titleField              →  true (titleField missing)
    // overall: true
    expect(
      evaluateWhen('mode == static && !items || !titleField', {
        mode: 'dynamic',
      }),
    ).toBe(true);
  });

  it('returns false (does NOT throw) on malformed input', () => {
    // Operators with empty operands shouldn't crash — schema authors get a
    // chance to catch the typo via their own unit test, but runtime keeps
    // rendering.
    expect(evaluateWhen('==', {})).toBe(false);
    expect(evaluateWhen('length() > 0', {})).toBe(false);
  });
});

describe('evaluateWarnings', () => {
  const carouselRules: WarningRule[] = [
    {
      id: 'carousel:dynamic-needs-title',
      when: 'mode == dynamic && !titleField',
      message: '동적 모드에는 titleField 가 필요해요.',
    },
    {
      id: 'carousel:static-needs-items',
      when: 'mode == static && length(items) < 1',
      message: '정적 모드에는 최소 1개 슬라이드가 필요해요.',
    },
    {
      id: 'carousel:max-buttons',
      when: 'length(buttons) > 10',
      message: 'Carousel 한 노드의 버튼은 최대 10개입니다.',
      severity: 'advisory',
    },
  ];

  it('returns empty for nullish config / nullish rules / empty rules', () => {
    expect(evaluateWarnings(null, carouselRules)).toEqual([]);
    expect(evaluateWarnings({}, undefined)).toEqual([]);
    expect(evaluateWarnings({}, [])).toEqual([]);
  });

  it('fires only the rules whose `when` matches; preserves rule order', () => {
    const result = evaluateWarnings(
      {
        mode: 'static',
        items: [],
        buttons: new Array(11),
      },
      carouselRules,
    );
    expect(result.map((r) => r.id)).toEqual([
      'carousel:static-needs-items',
      'carousel:max-buttons',
    ]);
  });

  it('defaults severity to "blocking"; respects explicit "advisory"', () => {
    const result = evaluateWarnings(
      { mode: 'dynamic', buttons: new Array(11) },
      carouselRules,
    );
    const byId = new Map(result.map((r) => [r.id, r]));
    expect(byId.get('carousel:dynamic-needs-title')?.severity).toBe(
      'blocking',
    );
    expect(byId.get('carousel:max-buttons')?.severity).toBe('advisory');
  });
});

describe('renderTemplate', () => {
  it('substitutes {{ path }} and supports filters', () => {
    expect(renderTemplate('{{ method }} {{ url }}', { method: 'GET', url: '/x' }))
      .toBe('GET /x');
    expect(renderTemplate('{{ method | default:GET }}', {})).toBe('GET');
    expect(renderTemplate('{{ name | upper }}', { name: 'foo' })).toBe('FOO');
    expect(renderTemplate('{{ name | lower }}', { name: 'BAR' })).toBe('bar');
  });

  describe('fallback: filter (resolves arg as a config path, not a literal)', () => {
    it('uses the primary value when present', () => {
      expect(
        renderTemplate('{{ workflowName | fallback:workflowId }}', {
          workflowName: 'Checkout',
          workflowId: 'wf-1',
        }),
      ).toBe('Checkout');
    });

    it('falls back to the other field value when primary is empty', () => {
      expect(
        renderTemplate('{{ workflowName | fallback:workflowId }}', {
          workflowName: '',
          workflowId: 'wf-1',
        }),
      ).toBe('wf-1');
    });

    it('falls back when primary is missing entirely', () => {
      expect(
        renderTemplate('{{ workflowName | fallback:workflowId }}', {
          workflowId: 'wf-1',
        }),
      ).toBe('wf-1');
    });

    it('renders empty when both are absent', () => {
      expect(
        renderTemplate('{{ workflowName | fallback:workflowId }}', {}),
      ).toBe('');
    });

    it('differs from default: which would emit the literal path name', () => {
      // Guard the exact reason `default:workflowId` is wrong for fallback.
      expect(
        renderTemplate('{{ workflowName | default:workflowId }}', {
          workflowId: 'wf-1',
        }),
      ).toBe('workflowId');
    });

    it('chained filter: fallback result is passed through subsequent filters (e.g. upper)', () => {
      // Primary is absent → fallback resolves workflowId → upper applies to it.
      expect(
        renderTemplate(
          '{{ workflowName | fallback:workflowId | upper }}',
          { workflowId: 'wf-1' },
        ),
      ).toBe('WF-1');
      // Primary present → upper applies to the primary value.
      expect(
        renderTemplate(
          '{{ workflowName | fallback:workflowId | upper }}',
          { workflowName: 'checkout', workflowId: 'wf-1' },
        ),
      ).toBe('CHECKOUT');
    });

    it('dot-path arg: resolves nested config field as fallback', () => {
      expect(
        renderTemplate('{{ name | fallback:meta.id }}', { meta: { id: 'x' } }),
      ).toBe('x');
      // Primary present → dot-path arg is never consulted.
      expect(
        renderTemplate('{{ name | fallback:meta.id }}', {
          name: 'Alice',
          meta: { id: 'x' },
        }),
      ).toBe('Alice');
    });

    it('empty arg (fallback:): resolves getPath(config, "") → undefined → renders empty string', () => {
      // When the arg after the colon is blank, getPath gets '' as path.
      // The empty-string path segment produces undefined, which stringify()
      // converts to '' — making the overall output an empty string.
      expect(renderTemplate('{{ name | fallback: }}', {})).toBe('');
    });
  });
});

describe('renderSummaryTemplate', () => {
  it('returns null for missing spec', () => {
    expect(renderSummaryTemplate(undefined, {})).toBeNull();
    expect(renderSummaryTemplate(null, {})).toBeNull();
  });

  it('plain string spec → no warning, plain template render', () => {
    expect(renderSummaryTemplate('hello {{ x }}', { x: 'world' })).toEqual({
      text: 'hello world',
      isWarning: false,
    });
  });

  it('object spec without warnWhen → plain render', () => {
    expect(
      renderSummaryTemplate(
        { template: '{{ method | default:GET }} {{ url }}' },
        { url: '/x' },
      ),
    ).toEqual({ text: 'GET /x', isWarning: false });
  });

  it('object spec with warnWhen firing → ⚠ + warnMessage', () => {
    expect(
      renderSummaryTemplate(
        {
          template: '{{ method }} {{ url }}',
          warnWhen: '!url',
          warnMessage: 'URL 미설정',
        },
        { method: 'GET' },
      ),
    ).toEqual({ text: '⚠ URL 미설정', isWarning: true });
  });

  it('warnWhen firing without warnMessage → falls back to rendered template', () => {
    expect(
      renderSummaryTemplate(
        {
          template: 'GET {{ url | default:??? }}',
          warnWhen: '!url',
        },
        {},
      ),
    ).toEqual({ text: '⚠ GET ???', isWarning: true });
  });
});
