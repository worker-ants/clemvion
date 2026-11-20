import {
  buildSystemContextPrefix,
  buildSystemContextPrefixFromContext,
  formatIsoWithTimezone,
  formatUtcOffsetLabel,
  normalizeSystemContextConfig,
  resolveSystemContextTimezone,
  SYSTEM_CONTEXT_DEFAULT_SECTIONS,
} from './system-context-prefix.js';
import type { ExecutionContext } from '../../core/node-handler.interface.js';
import { PRODUCT_DEFAULT_TIMEZONE } from '../../../common/utils/timezone.js';

// spec: spec/4-nodes/3-ai/0-common.md §11

describe('System Context Prefix', () => {
  const fixedNow = new Date('2026-05-18T03:45:12Z'); // == 12:45:12 KST

  describe('formatIsoWithTimezone', () => {
    it('renders +09:00 designator for Asia/Seoul', () => {
      expect(formatIsoWithTimezone(fixedNow, 'Asia/Seoul')).toBe(
        '2026-05-18T12:45:12+09:00',
      );
    });

    it('renders Z for UTC', () => {
      expect(formatIsoWithTimezone(fixedNow, 'UTC')).toBe(
        '2026-05-18T03:45:12Z',
      );
    });

    it('handles negative offsets', () => {
      expect(formatIsoWithTimezone(fixedNow, 'America/New_York')).toMatch(
        /^2026-05-1[78]T\d{2}:\d{2}:\d{2}-0[45]:00$/,
      );
    });

    it('handles half-hour offsets (e.g. Asia/Kolkata UTC+5:30)', () => {
      const iso = formatIsoWithTimezone(fixedNow, 'Asia/Kolkata');
      expect(iso).toMatch(/\+05:30$/);
    });
  });

  describe('formatUtcOffsetLabel', () => {
    it('returns UTC for zero offset', () => {
      expect(formatUtcOffsetLabel(fixedNow, 'UTC')).toBe('UTC');
    });

    it('returns UTC+9 for KST', () => {
      expect(formatUtcOffsetLabel(fixedNow, 'Asia/Seoul')).toBe('UTC+9');
    });

    it('returns UTC+5:30 for half-hour timezone', () => {
      expect(formatUtcOffsetLabel(fixedNow, 'Asia/Kolkata')).toBe('UTC+5:30');
    });

    it('returns UTC-5 or UTC-4 for New York depending on DST', () => {
      expect(formatUtcOffsetLabel(fixedNow, 'America/New_York')).toMatch(
        /^UTC-[45]$/,
      );
    });
  });

  describe('resolveSystemContextTimezone', () => {
    it('prefers workspace timezone when valid IANA', () => {
      expect(resolveSystemContextTimezone('Asia/Seoul')).toBe('Asia/Seoul');
    });

    it('falls back to PRODUCT_DEFAULT_TIMEZONE (Asia/Seoul) when workspace is empty', () => {
      expect(PRODUCT_DEFAULT_TIMEZONE).toBe('Asia/Seoul');
      expect(resolveSystemContextTimezone(undefined)).toBe('Asia/Seoul');
      expect(resolveSystemContextTimezone('')).toBe('Asia/Seoul');
    });

    it('skips invalid workspace timezone and falls back to Asia/Seoul', () => {
      expect(resolveSystemContextTimezone('Not/A_Real_Zone')).toBe(
        'Asia/Seoul',
      );
    });

    it('ignores process.env.TZ (server TZ never leaks into the prefix)', () => {
      const original = process.env.TZ;
      process.env.TZ = 'America/New_York';
      try {
        expect(resolveSystemContextTimezone(undefined)).toBe('Asia/Seoul');
        expect(resolveSystemContextTimezone('')).toBe('Asia/Seoul');
        expect(resolveSystemContextTimezone('Not/Real')).toBe('Asia/Seoul');
        expect(resolveSystemContextTimezone('Europe/London')).toBe(
          'Europe/London',
        );
      } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
      }
    });
  });

  describe('buildSystemContextPrefix', () => {
    it('returns empty for empty sections', () => {
      expect(
        buildSystemContextPrefix({
          now: fixedNow,
          timezone: 'UTC',
          sections: [],
        }),
      ).toBe('');
    });

    it('renders default sections (time + timezone) for KST workspace', () => {
      const out = buildSystemContextPrefix({
        now: fixedNow,
        timezone: 'Asia/Seoul',
        sections: SYSTEM_CONTEXT_DEFAULT_SECTIONS,
      });
      expect(out).toContain('## System Context');
      expect(out).toContain('- Current time: 2026-05-18T12:45:12+09:00');
      expect(out).toContain('- Timezone: Asia/Seoul (UTC+9)');
      expect(out.endsWith('\n\n')).toBe(true);
    });

    it('renders time+timezone for UTC', () => {
      const out = buildSystemContextPrefix({
        now: fixedNow,
        timezone: 'UTC',
        sections: SYSTEM_CONTEXT_DEFAULT_SECTIONS,
      });
      expect(out).toContain('- Current time: 2026-05-18T03:45:12Z');
      expect(out).toContain('- Timezone: UTC (UTC)');
    });

    it('renders workspace section when id provided', () => {
      const out = buildSystemContextPrefix({
        now: fixedNow,
        timezone: 'UTC',
        workspace: { id: 'ws-1', name: 'My Workspace' },
        sections: ['workspace'],
      });
      expect(out).toContain('- Workspace: My Workspace (id: ws-1)');
    });

    it('skips workspace section when id and name both missing', () => {
      const out = buildSystemContextPrefix({
        now: fixedNow,
        timezone: 'UTC',
        workspace: {},
        sections: ['workspace'],
      });
      expect(out).toBe('');
    });

    it('renders node section', () => {
      const out = buildSystemContextPrefix({
        now: fixedNow,
        timezone: 'UTC',
        node: { id: 'n-1', label: 'My AI', type: 'ai_agent' },
        sections: ['node'],
      });
      expect(out).toContain('- Node: My AI (type: ai_agent, id: n-1)');
    });

    it('dedupes sections', () => {
      const out = buildSystemContextPrefix({
        now: fixedNow,
        timezone: 'UTC',
        sections: ['time', 'time', 'timezone'],
      });
      const lines = out.split('\n').filter((l) => l.startsWith('- '));
      expect(lines).toHaveLength(2);
    });
  });

  describe('normalizeSystemContextConfig', () => {
    it('returns default-enabled when config has neither field (existing rows)', () => {
      const { enabled, sections } = normalizeSystemContextConfig({});
      expect(enabled).toBe(true);
      expect(sections).toEqual(['time', 'timezone']);
    });

    it('returns disabled when includeSystemContext is false', () => {
      const { enabled } = normalizeSystemContextConfig({
        includeSystemContext: false,
      });
      expect(enabled).toBe(false);
    });

    it('returns disabled when sections is empty array (equivalent)', () => {
      const { enabled } = normalizeSystemContextConfig({
        systemContextSections: [],
      });
      expect(enabled).toBe(false);
    });

    it('filters unknown section literals', () => {
      const { enabled, sections } = normalizeSystemContextConfig({
        systemContextSections: ['time', 'nonsense', 'workspace'],
      });
      expect(enabled).toBe(true);
      expect(sections).toEqual(['time', 'workspace']);
    });

    it('returns disabled when only unknown sections provided', () => {
      const { enabled } = normalizeSystemContextConfig({
        systemContextSections: ['nonsense'],
      });
      expect(enabled).toBe(false);
    });
  });

  describe('buildSystemContextPrefixFromContext', () => {
    function makeContext(
      overrides: Partial<ExecutionContext> = {},
    ): ExecutionContext {
      return {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        nodeId: 'node-1',
        variables: {
          __workspaceId: 'ws-1',
          __workspaceTimezone: 'Asia/Seoul',
        },
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        recursionDepth: 0,
        conversationThread: {
          id: 'default',
          nextSeq: 0,
          turns: [],
          totalChars: 0,
        },
        ...overrides,
      };
    }

    it('respects default-enabled when config has neither field', () => {
      const out = buildSystemContextPrefixFromContext({
        context: makeContext(),
        config: {},
        now: fixedNow,
      });
      expect(out).toContain('Current time: 2026-05-18T12:45:12+09:00');
      expect(out).toContain('Timezone: Asia/Seoul (UTC+9)');
    });

    it('returns empty when explicitly disabled', () => {
      const out = buildSystemContextPrefixFromContext({
        context: makeContext(),
        config: { includeSystemContext: false },
        now: fixedNow,
      });
      expect(out).toBe('');
    });

    it('falls back to Asia/Seoul when workspace timezone missing, regardless of process.env.TZ', () => {
      const original = process.env.TZ;
      process.env.TZ = 'America/New_York';
      try {
        const out = buildSystemContextPrefixFromContext({
          context: makeContext({ variables: { __workspaceId: 'ws-1' } }),
          config: {},
          now: fixedNow,
        });
        expect(out).toContain('Timezone: Asia/Seoul');
        expect(out).not.toContain('America/New_York');
        expect(out).not.toContain('Timezone: UTC');
      } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
      }
    });

    it('renders __workspaceName / nodeLabel / nodeType in workspace + node sections', () => {
      const out = buildSystemContextPrefixFromContext({
        context: makeContext({
          variables: {
            __workspaceId: 'ws-1',
            __workspaceName: 'My Workspace',
            __workspaceTimezone: 'Asia/Seoul',
          },
          nodeId: 'node-7',
          nodeLabel: 'Order Classifier',
          nodeType: 'text_classifier',
        }),
        config: {
          includeSystemContext: true,
          systemContextSections: ['workspace', 'node'],
        },
        now: fixedNow,
      });
      expect(out).toContain('- Workspace: My Workspace (id: ws-1)');
      expect(out).toContain(
        '- Node: Order Classifier (type: text_classifier, id: node-7)',
      );
      expect(out).not.toContain('(unnamed)');
      expect(out).not.toContain('(unlabeled)');
    });

    it('falls back to (unnamed) / (unlabeled) when name / label missing', () => {
      const out = buildSystemContextPrefixFromContext({
        context: makeContext({
          variables: {
            __workspaceId: 'ws-1',
            __workspaceTimezone: 'Asia/Seoul',
          },
          nodeId: 'node-7',
          nodeType: 'text_classifier',
        }),
        config: {
          includeSystemContext: true,
          systemContextSections: ['workspace', 'node'],
        },
        now: fixedNow,
      });
      expect(out).toContain('- Workspace: (unnamed) (id: ws-1)');
      expect(out).toContain(
        '- Node: (unlabeled) (type: text_classifier, id: node-7)',
      );
    });
  });
});
