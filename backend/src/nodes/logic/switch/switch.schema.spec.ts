import { evaluateWarnings } from '@workflow/node-summary';
import {
  caseDefSchema,
  switchNodeConfigSchema,
  switchNodeMetadata,
  switchNodeOutputSchema,
  switchNodePorts,
  validateSwitchConfig,
} from './switch.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('Switch node schema', () => {
  describe('caseDefSchema', () => {
    it('id 는 optional — 생략 가능 (resolver 가 case_${i} fallback)', () => {
      const parsed = caseDefSchema.parse({ label: 'A' });
      expect(parsed.id).toBeUndefined();
      expect(parsed.label).toBe('A');
    });

    it('id 는 slug 형식 (a-z A-Z 0-9 _ -) 만 허용', () => {
      expect(
        caseDefSchema.safeParse({ id: 'my_case-1', label: 'A' }).success,
      ).toBe(true);
      expect(caseDefSchema.safeParse({ id: 'case1', label: 'A' }).success).toBe(
        true,
      );
      expect(
        caseDefSchema.safeParse({ id: 'CASE_X', label: 'A' }).success,
      ).toBe(true);
    });

    it('id 에 공백·특수문자·엔티티가 포함되면 거부 (포트 라우팅 키 안전)', () => {
      expect(caseDefSchema.safeParse({ id: 'my case' }).success).toBe(false);
      expect(caseDefSchema.safeParse({ id: '<script>' }).success).toBe(false);
      expect(caseDefSchema.safeParse({ id: 'case.1' }).success).toBe(false);
      expect(caseDefSchema.safeParse({ id: 'case/1' }).success).toBe(false);
      expect(caseDefSchema.safeParse({ id: '한글' }).success).toBe(false);
    });

    it('id 길이 상한 64 — 65자 이상은 거부', () => {
      const ok = 'a'.repeat(64);
      const tooLong = 'a'.repeat(65);
      expect(caseDefSchema.safeParse({ id: ok }).success).toBe(true);
      expect(caseDefSchema.safeParse({ id: tooLong }).success).toBe(false);
    });

    it('label 기본값은 빈 문자열', () => {
      const parsed = caseDefSchema.parse({});
      expect(parsed.label).toBe('');
    });

    it('value 는 any 타입 허용 (mode=value 시 사용)', () => {
      expect(caseDefSchema.parse({ value: 42 }).value).toBe(42);
      expect(caseDefSchema.parse({ value: 'str' }).value).toBe('str');
      expect(caseDefSchema.parse({ value: null }).value).toBeNull();
    });

    // 스키마(optional) ↔ resolver(fallback 으로 채움) ↔ handler(validate 에서
    // runtime-required) 3 계층 불일치 고정. 스키마를 required 로 바꾸면 legacy
    // config 가 깨지므로 의도된 설계 — 변경 시 resolver 와 handler 가 모두
    // 영향 받으므로 함께 본다.
    it('id optional 은 의도적 — resolver 가 case_${i} fallback, handler.validate 는 runtime-required 체크', () => {
      // schema parse 는 통과, 실제 실행 단계에서 handler.validate 가 거부.
      expect(caseDefSchema.safeParse({ label: 'A' }).success).toBe(true);
    });
  });

  describe('switchNodeConfigSchema', () => {
    it('빈 config 는 기본값 세트로 채워짐', () => {
      const parsed = switchNodeConfigSchema.parse({});
      expect(parsed.mode).toBe('value');
      expect(parsed.switchValue).toBe('');
      expect(parsed.cases).toEqual([]);
      expect(parsed.hasDefault).toBe(false);
      expect(parsed.strictComparison).toBe(false);
    });

    it('mode 는 value / expression 만 허용', () => {
      expect(switchNodeConfigSchema.safeParse({ mode: 'value' }).success).toBe(
        true,
      );
      expect(
        switchNodeConfigSchema.safeParse({ mode: 'expression' }).success,
      ).toBe(true);
      expect(switchNodeConfigSchema.safeParse({ mode: 'regex' }).success).toBe(
        false,
      );
    });

    it('cases 배열에 유효한 case 를 전달하면 그대로 유지', () => {
      const parsed = switchNodeConfigSchema.parse({
        cases: [
          { id: 'yes', label: 'Yes', value: true },
          { id: 'no', label: 'No', value: false },
        ],
      });
      expect(parsed.cases).toHaveLength(2);
      expect(parsed.cases[0].id).toBe('yes');
    });

    it('cases 에 잘못된 id 가 있으면 전체 parse 실패', () => {
      const result = switchNodeConfigSchema.safeParse({
        cases: [{ id: 'has space' }],
      });
      expect(result.success).toBe(false);
    });

    it('passthrough: 알 수 없는 키는 통과', () => {
      const parsed = switchNodeConfigSchema.parse({
        mode: 'value',
        futureField: 'x',
      });
      expect((parsed as Record<string, unknown>).futureField).toBe('x');
    });
  });

  describe('switchNodeOutputSchema', () => {
    it('성공 shape 수용 (port=case id)', () => {
      const result = switchNodeOutputSchema.safeParse({
        config: { cases: [{ id: 'yes' }] },
        output: { value: 1 },
        meta: { matchedCase: 'yes' },
        port: 'yes',
      });
      expect(result.success).toBe(true);
    });

    it('default 분기 shape 수용 (port=default)', () => {
      const result = switchNodeOutputSchema.safeParse({
        meta: { matchedCase: 'default' },
        port: 'default',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('static metadata', () => {
    it('ports: inputs=[in], outputs=[default] — dynamic cases 는 resolver 가 합성', () => {
      expect(switchNodePorts.inputs).toEqual([
        { id: 'in', label: 'Input', type: 'data' },
      ]);
      expect(switchNodePorts.outputs).toEqual([
        { id: 'default', label: 'Default', type: 'data' },
      ]);
    });

    it('metadata: dynamicPorts.kind = switch-cases, isDynamicPorts = true', () => {
      expect(switchNodeMetadata.type).toBe('switch');
      expect(switchNodeMetadata.isDynamicPorts).toBe(true);
      expect(switchNodeMetadata.dynamicPorts).toEqual({ kind: 'switch-cases' });
    });
  });

  describe('warningRules', () => {
    const firedIds = (config: unknown) =>
      evaluateWarnings(
        config as Record<string, unknown>,
        switchNodeMetadata.warningRules,
      ).map((w) => w.id);

    describe('switch:value-mode-needs-switch-value', () => {
      it('fires for default mode (no mode set) when switchValue is missing', () => {
        expect(firedIds({ cases: [{ id: 'a' }] })).toContain(
          'switch:value-mode-needs-switch-value',
        );
      });

      it('fires for explicit mode=value when switchValue is missing', () => {
        expect(firedIds({ mode: 'value', cases: [{ id: 'a' }] })).toContain(
          'switch:value-mode-needs-switch-value',
        );
      });

      it('does NOT fire when mode=expression', () => {
        expect(
          firedIds({ mode: 'expression', cases: [{ id: 'a' }] }),
        ).not.toContain('switch:value-mode-needs-switch-value');
      });

      it('does NOT fire when switchValue is set', () => {
        expect(
          firedIds({
            mode: 'value',
            switchValue: '{{ $input.kind }}',
            cases: [{ id: 'a' }],
          }),
        ).not.toContain('switch:value-mode-needs-switch-value');
      });
    });

    describe('switch:no-cases', () => {
      it('fires when cases is empty', () => {
        expect(firedIds({ cases: [] })).toContain('switch:no-cases');
      });

      it('fires when cases is missing entirely', () => {
        expect(firedIds({})).toContain('switch:no-cases');
      });

      it('does NOT fire when at least one case is defined', () => {
        expect(firedIds({ cases: [{ id: 'a' }] })).not.toContain(
          'switch:no-cases',
        );
      });
    });
  });

  describe('validateSwitchConfig (imperative)', () => {
    it('returns [] for a valid value-mode config', () => {
      expect(
        validateSwitchConfig({
          mode: 'value',
          switchValue: 'x',
          cases: [{ id: 'yes', value: true }],
        }),
      ).toEqual([]);
    });

    it('rejects duplicate case ids', () => {
      const errors = validateSwitchConfig({
        cases: [{ id: 'dup' }, { id: 'dup' }],
      });
      expect(errors).toContain("cases[1].id 'dup' is duplicated");
    });

    it('rejects unknown valueType', () => {
      const errors = validateSwitchConfig({
        cases: [{ id: 'a', valueType: 'date' }],
      });
      expect(errors).toContain(
        'cases[0].valueType must be one of: string, number, boolean',
      );
    });

    it('expression mode requires per-case condition', () => {
      const errors = validateSwitchConfig({
        mode: 'expression',
        cases: [{ id: 'a' }],
      });
      expect(errors).toContain(
        'cases[0].condition is required when mode is "expression"',
      );
    });

    it.each(['default', 'out', 'error'])(
      'rejects reserved case id "%s" — would collide with engine port (D7)',
      (reserved) => {
        const errors = validateSwitchConfig({
          cases: [{ id: reserved }],
        });
        expect(errors).toContain(
          `cases[0].id '${reserved}' is a reserved port name (default / out / error)`,
        );
      },
    );

    it('does NOT reject reserved id substrings (e.g. "default_admin")', () => {
      // The reserved set is a strict whole-token match, not a substring
      // check — case ids that merely contain "default" / "out" / "error"
      // remain valid (e.g. user-defined `default_role`, `outbound`).
      expect(
        validateSwitchConfig({
          cases: [
            { id: 'default_admin' },
            { id: 'outbound' },
            { id: 'error_recovery' },
          ],
        }),
      ).toEqual([]);
    });
  });

  describe('evaluateMetadataBlockingErrors integration (switch)', () => {
    it('emits both Korean warnings on a freshly-created node', () => {
      const errors = evaluateMetadataBlockingErrors(switchNodeMetadata, {});
      expect(errors).toContain(
        'Value 모드에서는 Switch Value 를 입력해야 합니다.',
      );
      expect(errors).toContain('최소 1개 이상의 case 를 추가해야 합니다.');
    });

    it('returns [] when fully configured (value mode)', () => {
      expect(
        evaluateMetadataBlockingErrors(switchNodeMetadata, {
          mode: 'value',
          switchValue: '{{ $input.kind }}',
          cases: [{ id: 'a', value: true }],
        }),
      ).toEqual([]);
    });
  });
});
