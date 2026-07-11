import {
  SURFACE_ALLOWED_COMMANDS,
  coalesceInteractionType,
  isCommandAllowedOnSurface,
  readPersistedInteractionType,
  resolveWaitingSurface,
  type WaitingSurface,
  type WaitingSurfaceCommand,
} from './waiting-surface-guard';
import { buildParkEntryRegistry } from './park-entry-dispatch';

// ────────────────────────────────────────────────────────────────────────────
// publisher 사전 검증(§7.5.1)의 순수 결정 로직.
//
// 불변식 두 가지를 가드한다:
//  (1) 표면 판정이 `parkEntryRegistry` / `resumeTurnRegistry` 의 selects 술어와
//      **동일**하다 — publisher 는 worker 가 고를 처리기를 정확히 예측해야 한다.
//  (2) form / buttons 는 자기 명령만, ai_conversation 은 4종 모두 허용한다
//      (Presentation §10.9 graceful degradation + AI Agent §6.2 step 2.c 보존).
// ────────────────────────────────────────────────────────────────────────────

const ALL_COMMANDS: readonly WaitingSurfaceCommand[] = [
  'form_submitted',
  'button_click',
  'ai_message',
  'ai_end_conversation',
];

describe('waiting-surface-guard', () => {
  describe('resolveWaitingSurface', () => {
    it('form — 정적 blockingInteraction 으로 판정 (persisted meta 없어도)', () => {
      expect(
        resolveWaitingSurface({
          blockingInteraction: 'form',
          interactionType: undefined,
        }),
      ).toBe('form');
    });

    it('buttons — persisted interactionType 으로 판정', () => {
      expect(
        resolveWaitingSurface({
          blockingInteraction: undefined,
          interactionType: 'buttons',
        }),
      ).toBe('buttons');
    });

    it('ai_conversation — persisted interactionType 으로 판정', () => {
      expect(
        resolveWaitingSurface({
          blockingInteraction: undefined,
          interactionType: 'ai_conversation',
        }),
      ).toBe('ai_conversation');
    });

    it('ai_form_render — ai_conversation 표면으로 흡수 (별도 표면 아님)', () => {
      expect(
        resolveWaitingSurface({
          blockingInteraction: undefined,
          interactionType: 'ai_form_render',
        }),
      ).toBe('ai_conversation');
    });

    it('form 이 buttons/ai 보다 우선 (registry first-match-wins 와 동일 순서)', () => {
      expect(
        resolveWaitingSurface({
          blockingInteraction: 'form',
          interactionType: 'ai_conversation',
        }),
      ).toBe('form');
    });

    it('판정 불가 → undefined (호출측이 fail-closed 로 거부)', () => {
      expect(
        resolveWaitingSurface({
          blockingInteraction: undefined,
          interactionType: undefined,
        }),
      ).toBeUndefined();
      expect(
        resolveWaitingSurface({
          blockingInteraction: undefined,
          interactionType: 'something_new',
        }),
      ).toBeUndefined();
    });
  });

  // 불변식 (1) — park-entry registry 의 selects 와 표면 판정이 어긋나면
  // publisher 가 worker 의 처리기 선택을 잘못 예측한다. 신규 blocking 타입 추가 시
  // 한쪽만 갱신하는 drift 를 여기서 hard fail 시킨다.
  describe('registry 대칭 — parkEntryRegistry.selects 와 동일 판정', () => {
    const registry = buildParkEntryRegistry({
      handleForm: jest.fn(),
      handleButtons: jest.fn(),
      handleAiConversation: jest.fn(),
    });

    const SELECTORS = [
      { blockingInteraction: 'form', interactionType: 'form' },
      { blockingInteraction: 'form', interactionType: undefined },
      { blockingInteraction: undefined, interactionType: 'buttons' },
      { blockingInteraction: undefined, interactionType: 'ai_conversation' },
      { blockingInteraction: undefined, interactionType: 'ai_form_render' },
      { blockingInteraction: undefined, interactionType: undefined },
    ] as const;

    it.each(SELECTORS)(
      'selector %j → registry 첫 매칭 kind 와 resolveWaitingSurface 가 일치',
      (sel) => {
        const registryKind = registry.find((e) =>
          e.selects({ node: {} as never, ...sel }),
        )?.kind;
        expect(resolveWaitingSurface(sel)).toBe(registryKind);
      },
    );
  });

  // 불변식 (2) — 매트릭스.
  describe('SURFACE_ALLOWED_COMMANDS', () => {
    it('form 대기 — submit_form(form_submitted) 만 허용', () => {
      expect(isCommandAllowedOnSurface('form', 'form_submitted')).toBe(true);
      expect(isCommandAllowedOnSurface('form', 'button_click')).toBe(false);
      expect(isCommandAllowedOnSurface('form', 'ai_message')).toBe(false);
      // 재현된 결함 — form 대기 중 end_conversation 이 빈 폼 제출로 침묵 처리됐다.
      expect(isCommandAllowedOnSurface('form', 'ai_end_conversation')).toBe(
        false,
      );
    });

    it('buttons 대기 — click_button 만 허용', () => {
      expect(isCommandAllowedOnSurface('buttons', 'button_click')).toBe(true);
      expect(isCommandAllowedOnSurface('buttons', 'form_submitted')).toBe(
        false,
      );
      expect(isCommandAllowedOnSurface('buttons', 'ai_message')).toBe(false);
      // resolveButtonInteraction (d) fallback 이 엉뚱한 'continue' 포트로 분기시켰다.
      expect(isCommandAllowedOnSurface('buttons', 'ai_end_conversation')).toBe(
        false,
      );
    });

    it('ai_conversation 대기 — 4종 모두 허용 (기존 defensive 관용 보존)', () => {
      for (const cmd of ALL_COMMANDS) {
        expect(isCommandAllowedOnSurface('ai_conversation', cmd)).toBe(true);
      }
    });

    it('모든 표면이 매트릭스에 등재 + 알려진 명령만 나열', () => {
      const surfaces: WaitingSurface[] = ['form', 'buttons', 'ai_conversation'];
      expect(Object.keys(SURFACE_ALLOWED_COMMANDS).sort()).toEqual(
        [...surfaces].sort(),
      );
      for (const cmds of Object.values(SURFACE_ALLOWED_COMMANDS)) {
        expect(cmds.length).toBeGreaterThan(0);
        for (const c of cmds) expect(ALL_COMMANDS).toContain(c);
      }
    });
  });

  // precedence·string-guard 규칙의 단일 SoT — publisher chokepoint 의 SQL 은 두 raw
  // 값만 뽑아 이 함수로 결합한다 (규칙 자체는 SQL 이 아니라 여기).
  describe('coalesceInteractionType', () => {
    it('meta 우선 (둘 다 있으면 meta)', () => {
      expect(coalesceInteractionType('buttons', 'form')).toBe('buttons');
    });

    it('meta 부재 → flat fallback', () => {
      expect(coalesceInteractionType(null, 'buttons')).toBe('buttons');
      expect(coalesceInteractionType(undefined, 'buttons')).toBe('buttons');
    });

    it('둘 다 부재 → undefined', () => {
      expect(coalesceInteractionType(null, null)).toBeUndefined();
      expect(coalesceInteractionType(undefined, undefined)).toBeUndefined();
    });

    it('비-문자열은 무시 (string-guard)', () => {
      expect(coalesceInteractionType(7, 'buttons')).toBe('buttons');
      expect(coalesceInteractionType({}, null)).toBeUndefined();
    });
  });

  describe('readPersistedInteractionType', () => {
    it('structured envelope 의 meta.interactionType 우선', () => {
      expect(
        readPersistedInteractionType({
          meta: { interactionType: 'buttons' },
          interactionType: 'form',
        }),
      ).toBe('buttons');
    });

    it('legacy flat root fallback', () => {
      expect(readPersistedInteractionType({ interactionType: 'buttons' })).toBe(
        'buttons',
      );
    });

    it('null / 비객체 / 부재 → undefined', () => {
      expect(readPersistedInteractionType(null)).toBeUndefined();
      expect(readPersistedInteractionType(undefined)).toBeUndefined();
      expect(readPersistedInteractionType('form')).toBeUndefined();
      expect(readPersistedInteractionType({})).toBeUndefined();
      expect(readPersistedInteractionType({ meta: null })).toBeUndefined();
      expect(
        readPersistedInteractionType({ meta: { interactionType: 7 } }),
      ).toBeUndefined();
    });
  });
});
