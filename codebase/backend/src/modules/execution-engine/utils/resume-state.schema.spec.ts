import {
  resumeCheckpointSchema,
  retryStateSchema,
  resumeStateSchema,
  CREDENTIAL_CONTEXT_FIELDS,
} from './resume-state.schema';

/**
 * resume-state 스키마 = credential-strip allow-list (impl-prep I-5) 와 라이프사이클
 * 구분(I-8)의 executable SoT. 본 스펙은 스키마 자체가 그 불변식을 인코딩하는지
 * 검증한다 — 런타임 경계에서 parse 하지 않는 대신(§7.5 graceful-reset semantics
 * 보존), 스키마의 allow-list drift(특히 credential 유입)를 여기서 잡는다.
 *
 * `buildResumeCheckpoint` 실제 산출물과의 정합(builder↔schema drift)은
 * `execution-engine.service.spec.ts` 의 실 checkpoint 경로에서
 * `resumeCheckpointSchema.safeParse(realCheckpoint)` + credential 부재 단언으로
 * 별도 검증한다.
 */
describe('resume-state.schema', () => {
  /** buildResumeCheckpoint 산출 키를 미러하는 well-formed checkpoint. */
  const wellFormedCheckpoint = {
    schemaVersion: 1,
    messages: [{ role: 'user', content: 'hi' }],
    turnCount: 2,
    totalInputTokens: 10,
    totalOutputTokens: 20,
    totalThinkingTokens: 0,
    toolCalls: 1,
    model: 'claude-x',
    temperature: 0.7,
    maxTokens: 1024,
    knowledgeBases: [],
    ragTopK: 5,
    ragThreshold: 0.5,
    ragSources: [],
    mcpServers: [],
    partialResult: { name: 'Bob' },
    collectionRetryCount: 1,
  };

  describe('resumeCheckpointSchema (I-5 credential allow-list)', () => {
    it('well-formed checkpoint 를 통과시킨다', () => {
      expect(
        resumeCheckpointSchema.safeParse(wellFormedCheckpoint).success,
      ).toBe(true);
    });

    it('pendingFormToolCall 는 optional — 부재/존재 모두 허용', () => {
      expect(
        resumeCheckpointSchema.safeParse(wellFormedCheckpoint).success,
      ).toBe(true);
      expect(
        resumeCheckpointSchema.safeParse({
          ...wellFormedCheckpoint,
          pendingFormToolCall: { toolCallId: 't1' },
        }).success,
      ).toBe(true);
    });

    it('credential 필드가 섞이면 strict 파싱이 거부한다 (allow-list 강제)', () => {
      // 재개 시 node.config 재유도 대상 — checkpoint 에 영속되면 안 되는 필드.
      for (const cred of CREDENTIAL_CONTEXT_FIELDS) {
        const leaked = { ...wellFormedCheckpoint, [cred]: 'leaked-value' };
        expect(resumeCheckpointSchema.strict().safeParse(leaked).success).toBe(
          false,
        );
      }
    });

    it('스키마 shape 에 credential/context-binding 필드가 없다 (schema drift 가드)', () => {
      const shapeKeys = Object.keys(resumeCheckpointSchema.shape);
      for (const cred of CREDENTIAL_CONTEXT_FIELDS) {
        expect(shapeKeys).not.toContain(cred);
      }
    });

    it('IE 고유 runtime state (partialResult / collectionRetryCount) 를 포함한다 (§1.3 합집합)', () => {
      const shapeKeys = Object.keys(resumeCheckpointSchema.shape);
      expect(shapeKeys).toContain('partialResult');
      expect(shapeKeys).toContain('collectionRetryCount');
    });

    it('TTL / replay 필드(expiresAt / lastUserMessage) 를 포함하지 않는다 (I-8: checkpoint ≠ retryState)', () => {
      const shapeKeys = Object.keys(resumeCheckpointSchema.shape);
      expect(shapeKeys).not.toContain('expiresAt');
      expect(shapeKeys).not.toContain('lastUserMessage');
    });
  });

  describe('retryStateSchema (I-8: subset + TTL + replay)', () => {
    it('checkpoint 부분집합 + expiresAt / lastUserMessage 를 허용한다', () => {
      const retry = {
        messages: [],
        turnCount: 1,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        toolCalls: 0,
        collectionRetryCount: 0,
        expiresAt: '2026-07-02T00:00:00.000Z',
        retryAfterSec: 30,
        lastUserMessage: 'retry me',
        lastUserMessageSource: 'ai_message' as const,
      };
      expect(retryStateSchema.safeParse(retry).success).toBe(true);
    });

    it('모든 필드 optional — DB 방어적 읽기 (부분 손상 허용)', () => {
      expect(retryStateSchema.safeParse({}).success).toBe(true);
      expect(
        retryStateSchema.safeParse({ expiresAt: '2026-07-02T00:00:00.000Z' })
          .success,
      ).toBe(true);
    });

    it('catchall — 알 수 없는 키를 보존한다 (재구성기에 그대로 전달)', () => {
      const parsed = retryStateSchema.parse({ unknownRuntimeField: 42 });
      expect(parsed.unknownRuntimeField).toBe(42);
    });
  });

  describe('resumeStateSchema (I-8: in-memory superset)', () => {
    it('credential / context-binding 필드를 허용한다 (checkpoint 와 대비되는 superset)', () => {
      const state = {
        messages: [],
        turnCount: 0,
        llmConfigId: 'cfg-1',
        workspaceId: 'ws-1',
        conditions: [],
        rawConfig: { some: 'config' },
        conversationThreadRef: { id: 'thread-1' },
      };
      expect(resumeStateSchema.safeParse(state).success).toBe(true);
    });

    it('빈 객체를 허용한다 — `(x as ResumeState) ?? {}` fallback 이 유효', () => {
      expect(resumeStateSchema.safeParse({}).success).toBe(true);
    });
  });
});
