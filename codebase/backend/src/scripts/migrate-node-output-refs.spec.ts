/**
 * Unit tests for the expression-rewriter logic inside
 * `migrate-node-output-refs.ts`. The DB-touching `main()` path is exercised
 * manually (staging dry-run before prod apply); this suite only covers
 * the pure-string passes so idempotency and edge cases are locked in.
 */
import {
  rewriteExpression,
  walkAndRewrite,
  RELOCATED_FIELDS,
  META_FIELDS,
  RESULT_FIELDS,
  RENAMED_OUTPUT_FIELDS,
  RENAMED_META_FIELDS,
} from './migrate-node-output-refs';

function typeMap(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('rewriteExpression', () => {
  describe('information_extractor double-nested path', () => {
    const labels = typeMap({ IE: 'information_extractor' });

    it('rewrites output.output.extracted → output.result.extracted', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["IE"].output.output.extracted.orderNumber }}',
        labels,
      );
      expect(result).toBe(
        '{{ $node["IE"].output.result.extracted.orderNumber }}',
      );
      expect(hits).toHaveLength(1);
      expect(hits[0].reason).toMatch(/extracted/);
    });

    it('rewrites each RESULT_FIELDS entry', () => {
      for (const field of RESULT_FIELDS.information_extractor ?? []) {
        const { result } = rewriteExpression(
          `{{ $node["IE"].output.output.${field} }}`,
          labels,
        );
        expect(result).toBe(`{{ $node["IE"].output.result.${field} }}`);
      }
    });

    it('rewrites double-nested meta fields to meta.* (not output.result)', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["IE"].output.output.collectionRetryCount }}',
        labels,
      );
      expect(result).toBe('{{ $node["IE"].meta.collectionRetryCount }}');
      expect(hits[0].reason).toMatch(/meta/);
    });

    it('audits unknown double-nested fields without rewriting', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["IE"].output.output._turnDebugHistory }}',
        labels,
      );
      expect(result).toBe('{{ $node["IE"].output.output._turnDebugHistory }}');
      expect(hits[0].reason).toMatch(/manual review/);
    });

    it('is idempotent — running twice leaves a rewritten path unchanged', () => {
      const first = rewriteExpression(
        '{{ $node["IE"].output.output.extracted.foo }}',
        labels,
      );
      const second = rewriteExpression(first.result, labels);
      expect(second.result).toBe(first.result);
      expect(second.hits).toHaveLength(0);
    });
  });

  describe('relocation to config (literal fields)', () => {
    it('moves http_request.url → config.url', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["HTTP"].output.url }}',
        typeMap({ HTTP: 'http_request' }),
      );
      expect(result).toBe('{{ $node["HTTP"].config.url }}');
      expect(hits[0].reason).toMatch(/moved to config/);
    });

    it('moves send_email.subject → config.subject', () => {
      const { result } = rewriteExpression(
        '{{ $node["Email"].output.subject }}',
        typeMap({ Email: 'send_email' }),
      );
      expect(result).toBe('{{ $node["Email"].config.subject }}');
    });

    it('moves presentation literal config (carousel.layout → config.layout)', () => {
      const { result } = rewriteExpression(
        '{{ $node["C"].output.layout }}',
        typeMap({ C: 'carousel' }),
      );
      expect(result).toBe('{{ $node["C"].config.layout }}');
    });
  });

  describe('relocation to meta (execution metrics)', () => {
    it('moves http_request.statusCode → meta.statusCode', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["HTTP"].output.statusCode }}',
        typeMap({ HTTP: 'http_request' }),
      );
      expect(result).toBe('{{ $node["HTTP"].meta.statusCode }}');
      expect(hits[0].reason).toMatch(/moved to meta/);
    });

    it('moves ai_agent.inputTokens → meta.inputTokens (post Stage 5)', () => {
      const { result } = rewriteExpression(
        '{{ $node["AI"].output.inputTokens }}',
        typeMap({ AI: 'ai_agent' }),
      );
      expect(result).toBe('{{ $node["AI"].meta.inputTokens }}');
    });
  });

  describe('LLM result wrapping (output.result.*)', () => {
    it('ai_agent.response → output.result.response', () => {
      const { result } = rewriteExpression(
        '{{ $node["AI"].output.response }}',
        typeMap({ AI: 'ai_agent' }),
      );
      expect(result).toBe('{{ $node["AI"].output.result.response }}');
    });

    it('text_classifier.categories → output.result.categories', () => {
      const { result } = rewriteExpression(
        '{{ $node["TC"].output.categories }}',
        typeMap({ TC: 'text_classifier' }),
      );
      expect(result).toBe('{{ $node["TC"].output.result.categories }}');
    });
  });

  describe('intra-output renames', () => {
    it('form.output.submittedData → output.interaction.data', () => {
      const { result } = rewriteExpression(
        '{{ $node["F"].output.submittedData.email }}',
        typeMap({ F: 'form' }),
      );
      expect(result).toBe('{{ $node["F"].output.interaction.data.email }}');
    });

    it('form.output.submittedData (root, no trailing field) rewrites too', () => {
      // A user may reference the whole object: `{{ $node["F"].output.submittedData }}`
      // with no trailing accessor. Pass 4 matches the terminal field, so the
      // rename still fires.
      const { result } = rewriteExpression(
        '{{ $node["F"].output.submittedData }}',
        typeMap({ F: 'form' }),
      );
      expect(result).toBe('{{ $node["F"].output.interaction.data }}');
    });

    it('template.output.content → output.rendered', () => {
      const { result } = rewriteExpression(
        '{{ $node["T"].output.content }}',
        typeMap({ T: 'template' }),
      );
      expect(result).toBe('{{ $node["T"].output.rendered }}');
    });
  });

  describe('discriminator dropout warning', () => {
    it.each([['carousel'], ['table'], ['chart'], ['template'], ['form']])(
      'flags %s.output.type without rewriting',
      (type) => {
        const { result, hits } = rewriteExpression(
          `{{ $node["N"].output.type === "${type}" }}`,
          typeMap({ N: type }),
        );
        expect(result).toBe(`{{ $node["N"].output.type === "${type}" }}`);
        expect(
          hits.some((h) => h.reason.includes('discriminator dropped')),
        ).toBe(true);
      },
    );
  });

  describe('status literal unification', () => {
    it("replaces status === 'submitted' with 'resumed'", () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["F"].status === \'submitted\' }}',
        typeMap({ F: 'form' }),
      );
      expect(result).toContain("=== 'resumed'");
      expect(hits.some((h) => h.field === 'status')).toBe(true);
    });

    it("replaces status === 'button_click' with 'resumed'", () => {
      const { result } = rewriteExpression(
        '{{ $node["C"].status === "button_click" }}',
        typeMap({ C: 'carousel' }),
      );
      expect(result).toContain("=== 'resumed'");
    });

    it("replaces status === 'button_continue' with 'resumed'", () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["C"].status === \'button_continue\' }}',
        typeMap({ C: 'carousel' }),
      );
      expect(result).toContain("=== 'resumed'");
      expect(hits.some((h) => h.field === 'status')).toBe(true);
    });

    it('does NOT rewrite output.interaction.type == "button_click" (payload discriminator)', () => {
      // The interaction payload still carries the original click type even
      // after the status field is unified. Ensure pass 5 targets only the
      // top-level status comparison, not interaction.type.
      const { result } = rewriteExpression(
        '{{ $node["C"].output.interaction.type === "button_click" }}',
        typeMap({ C: 'carousel' }),
      );
      expect(result).toBe(
        '{{ $node["C"].output.interaction.type === "button_click" }}',
      );
    });

    it('leaves non-target status literals alone', () => {
      const { result } = rewriteExpression(
        '{{ $node["X"].status === "waiting_for_input" }}',
        typeMap({ X: 'form' }),
      );
      expect(result).toBe('{{ $node["X"].status === "waiting_for_input" }}');
    });
  });

  describe('legacy error envelope field detection (Pass 6)', () => {
    it.each([['nodeId'], ['nodeType'], ['timestamp'], ['originalInput']])(
      'flags legacy output.error.%s without rewriting',
      (field) => {
        const { result, hits } = rewriteExpression(
          `{{ $node["H"].output.error.${field} }}`,
          typeMap({ H: 'http_request' }),
        );
        expect(result).toBe(`{{ $node["H"].output.error.${field} }}`);
        expect(
          hits.some((h) => h.reason.includes(`legacy output.error.${field}`)),
        ).toBe(true);
      },
    );
  });

  describe('structural path preservation', () => {
    it('does not re-rewrite .output.result.<f>', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["AI"].output.result.response }}',
        typeMap({ AI: 'ai_agent' }),
      );
      expect(result).toBe('{{ $node["AI"].output.result.response }}');
      expect(hits).toHaveLength(0);
    });

    it('does not touch .output.config.<f> for fields already in config', () => {
      const { result } = rewriteExpression(
        '{{ $node["AI"].output.config.systemPrompt }}',
        typeMap({ AI: 'ai_agent' }),
      );
      // nested output.config.X should collapse to config.X (pass 3).
      expect(result).toBe('{{ $node["AI"].config.systemPrompt }}');
    });

    it('does not rewrite fields on unknown node types', () => {
      const { result, hits } = rewriteExpression(
        '{{ $node["Unknown"].output.weirdField }}',
        typeMap({ Unknown: 'no_such_type' }),
      );
      expect(result).toBe('{{ $node["Unknown"].output.weirdField }}');
      expect(hits).toHaveLength(0);
    });
  });

  describe('multiple rewrites in one expression', () => {
    it('composes relocation + status unification in a single pass', () => {
      const { result } = rewriteExpression(
        '{{ $node["F"].output.submittedData.x && $node["F"].status === \'submitted\' }}',
        typeMap({ F: 'form' }),
      );
      expect(result).toContain('output.interaction.data.x');
      expect(result).toContain("=== 'resumed'");
    });

    it('passes plain text / non-$node expressions through unchanged', () => {
      const { result, hits } = rewriteExpression(
        '{{ $input.user.email + " on " + $execution.startedAt }}',
        typeMap({ F: 'form' }),
      );
      expect(result).toBe(
        '{{ $input.user.email + " on " + $execution.startedAt }}',
      );
      expect(hits).toHaveLength(0);
    });
  });

  describe('smoke coverage of every RELOCATED_FIELDS entry', () => {
    it('rewrites at least one field for each known node type', () => {
      for (const [nodeType, fields] of Object.entries(RELOCATED_FIELDS)) {
        if (fields.length === 0) continue;
        const field = fields[0];
        const labels = typeMap({ N: nodeType });
        const { result } = rewriteExpression(
          `{{ $node["N"].output.${field} }}`,
          labels,
        );
        expect(result).toBe(`{{ $node["N"].config.${field} }}`);
      }
    });
  });

  describe('smoke coverage of every META_FIELDS entry', () => {
    it('rewrites at least one field for each known node type', () => {
      for (const [nodeType, fields] of Object.entries(META_FIELDS)) {
        if (fields.length === 0) continue;
        const field = fields[0];
        const labels = typeMap({ N: nodeType });
        const { result } = rewriteExpression(
          `{{ $node["N"].output.${field} }}`,
          labels,
        );
        expect(result).toBe(`{{ $node["N"].meta.${field} }}`);
      }
    });
  });

  describe('RENAMED_OUTPUT_FIELDS coverage', () => {
    it('applies every configured rename', () => {
      for (const [nodeType, renames] of Object.entries(RENAMED_OUTPUT_FIELDS)) {
        const labels = typeMap({ N: nodeType });
        for (const [from, to] of renames) {
          const { result } = rewriteExpression(
            `{{ $node["N"].output.${from} }}`,
            labels,
          );
          expect(result).toBe(`{{ $node["N"].output.${to} }}`);
        }
      }
    });
  });

  describe('RENAMED_META_FIELDS coverage (D4 — Switch meta.value alias)', () => {
    it('rewrites $node["S"].meta.value → meta.resolvedValue for switch', () => {
      const labels = typeMap({ S: 'switch' });
      const { result, hits } = rewriteExpression(
        '{{ $node["S"].meta.value }}',
        labels,
      );
      expect(result).toBe('{{ $node["S"].meta.resolvedValue }}');
      expect(hits).toHaveLength(1);
      expect(hits[0].reason).toMatch(
        /meta\.value renamed to meta\.resolvedValue/,
      );
    });

    it('does not touch meta.value on non-switch nodes', () => {
      const labels = typeMap({ X: 'http_request' });
      const before = '{{ $node["X"].meta.value }}';
      const { result, hits } = rewriteExpression(before, labels);
      expect(result).toBe(before);
      expect(hits).toHaveLength(0);
    });

    it('chains output.value → meta.value → meta.resolvedValue for legacy switch refs', () => {
      // Pass 4 (META_FIELDS.switch includes "value") rewrites
      // .output.value → .meta.value, then pass 4b applies the rename to
      // .meta.resolvedValue. End-to-end this means a workflow stuck on the
      // pre-meta-channel path also lands on the canonical name.
      const labels = typeMap({ S: 'switch' });
      const { result } = rewriteExpression(
        '{{ $node["S"].output.value }}',
        labels,
      );
      expect(result).toBe('{{ $node["S"].meta.resolvedValue }}');
    });

    it('applies every configured RENAMED_META_FIELDS entry', () => {
      for (const [nodeType, renames] of Object.entries(RENAMED_META_FIELDS)) {
        const labels = typeMap({ N: nodeType });
        for (const [from, to] of renames) {
          const { result } = rewriteExpression(
            `{{ $node["N"].meta.${from} }}`,
            labels,
          );
          expect(result).toBe(`{{ $node["N"].meta.${to} }}`);
        }
      }
    });
  });
});

describe('walkAndRewrite', () => {
  const labels = typeMap({
    IE: 'information_extractor',
    HTTP: 'http_request',
    F: 'form',
  });

  it('walks nested objects and arrays, rewriting every string leaf', () => {
    const hits: Array<{
      field: string;
      reason: string;
      before: string;
      after: string;
    }> = [];
    const input = {
      body: '{{ $node["HTTP"].output.url }}',
      nested: {
        items: [
          '{{ $node["IE"].output.output.extracted.amount }}',
          '{{ $node["F"].output.submittedData.email }}',
        ],
      },
      constant: 42,
      unchanged: '{{ $node["HTTP"].output.response.data }}',
    };

    const out = walkAndRewrite(input, labels, hits) as typeof input;
    expect(out.body).toBe('{{ $node["HTTP"].config.url }}');
    expect(out.nested.items[0]).toBe(
      '{{ $node["IE"].output.result.extracted.amount }}',
    );
    expect(out.nested.items[1]).toBe(
      '{{ $node["F"].output.interaction.data.email }}',
    );
    expect(out.constant).toBe(42);
    expect(out.unchanged).toBe('{{ $node["HTTP"].output.response.data }}');
    // At least 3 string hits (url, extracted.amount, submittedData.email).
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });

  it('returns primitives untouched', () => {
    const hits: Array<{
      field: string;
      reason: string;
      before: string;
      after: string;
    }> = [];
    expect(walkAndRewrite(null, labels, hits)).toBeNull();
    expect(walkAndRewrite(undefined, labels, hits)).toBeUndefined();
    expect(walkAndRewrite(0, labels, hits)).toBe(0);
    expect(walkAndRewrite(true, labels, hits)).toBe(true);
    expect(hits).toHaveLength(0);
  });

  it('walks arrays that contain mixed null/primitive/object/string leaves', () => {
    const hits: Array<{
      field: string;
      reason: string;
      before: string;
      after: string;
    }> = [];
    const input = [
      null,
      42,
      '{{ $node["HTTP"].output.url }}',
      { nested: ['{{ $node["F"].output.submittedData.x }}', null] },
    ];
    const out = walkAndRewrite(input, labels, hits) as unknown[];
    expect(out[0]).toBeNull();
    expect(out[1]).toBe(42);
    expect(out[2]).toBe('{{ $node["HTTP"].config.url }}');
    const nested = (out[3] as { nested: unknown[] }).nested;
    expect(nested[0]).toBe('{{ $node["F"].output.interaction.data.x }}');
    expect(nested[1]).toBeNull();
  });
});
