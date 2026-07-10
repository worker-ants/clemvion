import type { ContinuationPayload } from './queues/continuation-execution.queue';

/**
 * 대기 노드가 노출한 **인터랙션 표면**. `resumeTurnRegistry` / `parkEntryRegistry` 의
 * `kind` 와 같은 어휘를 쓴다 (form → buttons → ai_conversation).
 *
 * `ai_form_render` 는 별도 표면이 아니라 `ai_conversation` 에 흡수된다 — 두 registry 와
 * 동일 정책 ([interaction-type-registry §1.2](../../../../../spec/conventions/interaction-type-registry.md)).
 */
export type WaitingSurface = 'form' | 'buttons' | 'ai_conversation';

/**
 * 대기 노드를 재개시키는 continuation 명령 4종. `cancel` / `retry_last_turn` 은
 * 대기 표면과 무관하므로(전자는 execution 전체 중단, 후자는 spawn 된 RUNNING row)
 * 본 가드의 대상이 아니다.
 *
 * {@link ContinuationPayload} 에서 derive 해 wire type 과의 이중 정의를 막는다.
 */
export type WaitingSurfaceCommand = Extract<
  ContinuationPayload['type'],
  'form_submitted' | 'button_click' | 'ai_message' | 'ai_end_conversation'
>;

/**
 * 표면별 허용 명령 매트릭스 — **publisher 사전 검증의 SoT**
 * (spec/5-system/4-execution-engine.md §7.5.1).
 *
 * `form` / `buttons` 는 단일 목적 표면이라 자기 명령만 받는다. 두 표면의 resume
 * 처리기는 도착 payload 의 `type` 을 보지 않고 노드 표면으로만 선택되므로
 * (`dispatchResumeTurn`), 이종 명령이 통과하면 **조용히 오처리**된다:
 *   - form  — sentinel 불일치 폴백으로 payload 를 formData 로 취급 → 빈 폼 제출
 *   - buttons — `resolveButtonInteraction` (d) fallback → 엉뚱한 `continue` 포트 분기
 *
 * `ai_conversation` 은 반대로 **의도적으로 관대**하다. `processAiResumeTurn` 이
 * 4종을 모두 정상 처리하도록 이미 설계돼 있다:
 *   - `ai_message` / `ai_end_conversation` — 대화 turn·종료
 *   - `form_submitted` — `render_form` 도구 응답 (AI Agent §6.1.d.ii / §6.2 step 2.c)
 *   - `button_click` — stale inline_keyboard 등, 상태 변경 없이 graceful re-park
 *     (Presentation §10.9 의 "도달 시 graceful degradation" invariant)
 * 여기서 4종을 좁히면 그 두 invariant 를 깨뜨린다.
 */
export const SURFACE_ALLOWED_COMMANDS: Readonly<
  Record<WaitingSurface, readonly WaitingSurfaceCommand[]>
> = {
  form: ['form_submitted'],
  buttons: ['button_click'],
  ai_conversation: [
    'form_submitted',
    'button_click',
    'ai_message',
    'ai_end_conversation',
  ],
};

/** {@link resolveWaitingSurface} 가 읽는 대기-노드 식별 신호. */
export interface WaitingSurfaceSelector {
  /**
   * blocking 핸들러 metadata 의 `interaction` (handler kind 가 'blocking' 일 때만).
   * `form` 판정에 쓴다 — 정적 `node.type` 기반이라 persisted meta 가 없어도 결정된다.
   */
  readonly blockingInteraction: string | undefined;
  /**
   * 대기 NodeExecution 에 영속된 `outputData` 의 interactionType
   * (`meta.interactionType` 우선, legacy flat root fallback).
   * `buttons` / `ai_conversation` / `ai_form_render` 판정에 쓴다.
   */
  readonly interactionType: string | undefined;
}

/**
 * 대기 노드의 표면을 판정한다. **선택 우선순위·술어는 `resumeTurnRegistry` /
 * `parkEntryRegistry` 와 동일**하다 (form → buttons → ai, first-match-wins) —
 * publisher 가 "worker 가 실제로 고를 처리기" 를 정확히 예측해야 하기 때문이다.
 *
 * @returns 판정 불가 시 `undefined`. 이 경우 `dispatchResumeTurn` 도 매칭 처리기를
 *          찾지 못해 `RESUME_CHECKPOINT_MISSING` 으로 실패하므로, 호출측은 publish
 *          전에 동기 거부하는 편이 낫다 (execution 이 waiting 으로 보존됨).
 */
export function resolveWaitingSurface(
  sel: WaitingSurfaceSelector,
): WaitingSurface | undefined {
  if (sel.blockingInteraction === 'form') return 'form';
  if (sel.interactionType === 'buttons') return 'buttons';
  if (
    sel.interactionType === 'ai_conversation' ||
    sel.interactionType === 'ai_form_render'
  ) {
    return 'ai_conversation';
  }
  return undefined;
}

/** 도착 명령이 해당 표면에서 허용되는가. */
export function isCommandAllowedOnSurface(
  surface: WaitingSurface,
  command: WaitingSurfaceCommand,
): boolean {
  return SURFACE_ALLOWED_COMMANDS[surface].includes(command);
}

/**
 * 영속된 `NodeExecution.outputData` 에서 interactionType 을 읽는다.
 * structured envelope 의 `meta.interactionType` 우선, legacy flat root fallback —
 * 엔진의 in-memory `getInteractionType` (structured cache → flat cache) 와 동형이며
 * §7.5 rehydration 의 `persistedInteractionType` 계산과 정확히 같은 규칙이다.
 */
export function readPersistedInteractionType(
  outputData: unknown,
): string | undefined {
  if (outputData === null || typeof outputData !== 'object') return undefined;
  const out = outputData as Record<string, unknown>;
  const meta = out.meta;
  if (meta !== null && typeof meta === 'object') {
    const metaType = (meta as Record<string, unknown>).interactionType;
    if (typeof metaType === 'string') return metaType;
  }
  return typeof out.interactionType === 'string'
    ? out.interactionType
    : undefined;
}
