import {
  buildParkEntryRegistry,
  ParkEntryContext,
  ParkEntrySelector,
} from './park-entry-dispatch';
import { PARK_RELEASED } from '../../shared/execution-resume/process-turn-result';

/**
 * M-4 — park 진입 dispatch registry 의 선택 우선순위(form → buttons → ai)와
 * selector 술어, handle 위임을 격리 검증한다. registry 동작 통합(실제 park/resume)은
 * execution-engine e2e 가 커버하고, 여기서는 추출 전 if/else 가 보존됐는지를
 * 순수 factory 단위로 고정한다(회귀 net).
 */
function sel(partial: Partial<ParkEntrySelector>): ParkEntrySelector {
  return {
    node: { type: 'x' } as never,
    blockingInteraction: undefined,
    interactionType: undefined,
    ...partial,
  };
}

describe('buildParkEntryRegistry', () => {
  const deps = {
    handleForm: jest.fn().mockResolvedValue(undefined),
    handleButtons: jest.fn().mockResolvedValue(undefined),
    handleAiConversation: jest.fn().mockResolvedValue(undefined),
  };
  beforeEach(() => jest.clearAllMocks());

  it('orders entries form → buttons → ai_conversation (first-match-wins priority)', () => {
    const registry = buildParkEntryRegistry(deps);
    expect(registry.map((h) => h.kind)).toEqual([
      'form',
      'buttons',
      'ai_conversation',
    ]);
  });

  it('selects form by static blockingInteraction metadata (not runtime interactionType)', () => {
    const [form] = buildParkEntryRegistry(deps);
    expect(form.selects(sel({ blockingInteraction: 'form' }))).toBe(true);
    // 런타임 interactionType 만으로는 form 이 매칭되지 않는다.
    expect(form.selects(sel({ interactionType: 'form' }))).toBe(false);
    expect(form.selects(sel({ interactionType: 'buttons' }))).toBe(false);
  });

  it('selects buttons by runtime interactionType', () => {
    const buttons = buildParkEntryRegistry(deps)[1];
    expect(buttons.selects(sel({ interactionType: 'buttons' }))).toBe(true);
    expect(buttons.selects(sel({ blockingInteraction: 'form' }))).toBe(false);
  });

  it('ai_conversation entry matches both ai_conversation and ai_form_render', () => {
    const ai = buildParkEntryRegistry(deps)[2];
    expect(ai.selects(sel({ interactionType: 'ai_conversation' }))).toBe(true);
    // ai_form_render 는 별도 항목이 아니라 ai_conversation 항목이 함께 매칭한다.
    expect(ai.selects(sel({ interactionType: 'ai_form_render' }))).toBe(true);
    expect(ai.selects(sel({ interactionType: 'buttons' }))).toBe(false);
  });

  it('first-match-wins keeps form ahead of a carousel-style node that is also buttons', () => {
    // form 노드는 정적 metadata(blockingInteraction)로, carousel(버튼)은 런타임
    // interactionType 로 매칭 — 둘은 disjoint 하지만 순서 계약을 고정한다.
    const registry = buildParkEntryRegistry(deps);
    const formish = sel({ blockingInteraction: 'form' });
    const first = registry.find((h) => h.selects(formish));
    expect(first?.kind).toBe('form');
  });

  it('handle delegates to the injected waitForX and returns its ProcessTurnResult', async () => {
    deps.handleButtons.mockResolvedValueOnce(PARK_RELEASED);
    const buttons = buildParkEntryRegistry(deps)[1];
    const ctx = { node: { type: 'x' } } as unknown as ParkEntryContext;
    const result = await buttons.handle(ctx);
    expect(deps.handleButtons).toHaveBeenCalledWith(ctx);
    expect(result).toBe(PARK_RELEASED);
  });

  it('no entry matches an unknown/blank interaction (dispatch returns undefined = no park branch)', () => {
    const registry = buildParkEntryRegistry(deps);
    const match = registry.find((h) =>
      h.selects(sel({ interactionType: 'something_else' })),
    );
    expect(match).toBeUndefined();
  });
});
