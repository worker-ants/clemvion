import { describe, it, expect } from '@jest/globals';

import { expectNarrowedScheduleTriggerRef } from './schedule-trigger-ref';

/**
 * **단언 헬퍼 자신의 회귀 가드.**
 *
 * 이 헬퍼는 e2e 4곳 + 컨트롤러 unit 2곳, 도합 여섯 자리에서 `ScheduleDto.trigger` 가 실제로
 * 좁혀졌는지를 확인하는 **유일한 양성 수단**이다. 그런데 자매 헬퍼(`response-contract.ts` ·
 * `swagger-probe.ts`)와 달리 자기 자신을 검증하는 스펙이 없었다
 * (`review/code/2026/09/06/01_13_50` W6) — 헬퍼가 무르게 바뀌면 여섯 자리가 **동시에**
 * 조용히 통과하게 된다.
 *
 * 그래서 통과 경로만 보지 않고 **실패해야 하는 경로**를 각각 문다.
 */
describe('expectNarrowedScheduleTriggerRef', () => {
  const NARROWED_WITH_WORKFLOW = {
    id: 'trg-1',
    name: 'nightly',
    workflowId: 'wf-1',
    workflow: { name: 'W' },
  };
  const NARROWED_WITHOUT_WORKFLOW = {
    id: 'trg-1',
    name: 'nightly',
    workflowId: 'wf-1',
  };

  it('정확한 키셋은 통과한다 — 두 형태 각각', () => {
    expectNarrowedScheduleTriggerRef(NARROWED_WITH_WORKFLOW, {
      withWorkflow: true,
    });
    expectNarrowedScheduleTriggerRef(NARROWED_WITHOUT_WORKFLOW, {
      withWorkflow: false,
    });
  });

  it('여분의 키가 하나라도 있으면 실패한다', () => {
    expect(() =>
      expectNarrowedScheduleTriggerRef(
        { ...NARROWED_WITH_WORKFLOW, type: 'schedule' },
        { withWorkflow: true },
      ),
    ).toThrow();
  });

  it('비밀 컬럼이 섞여 들어오면 실패한다 — 이 헬퍼의 존재 이유', () => {
    for (const secret of ['notificationSecretV2', 'chatChannelTokenV2']) {
      expect(() =>
        expectNarrowedScheduleTriggerRef(
          { ...NARROWED_WITH_WORKFLOW, [secret]: 'leaked' },
          { withWorkflow: true },
        ),
      ).toThrow();
    }
  });

  it('기대한 키가 빠지면 실패한다', () => {
    expect(() =>
      expectNarrowedScheduleTriggerRef(
        { id: 'trg-1', name: 'nightly' },
        { withWorkflow: false },
      ),
    ).toThrow();
  });

  /**
   * `withWorkflow` 를 **양방향으로** 문다. 한 방향만 두면 옵션을 무시하고 늘 같은 키셋을
   * 기대하는 구현이 절반의 호출부에서 통과한다.
   */
  it('withWorkflow 가 두 형태를 실제로 갈라낸다', () => {
    expect(() =>
      expectNarrowedScheduleTriggerRef(NARROWED_WITH_WORKFLOW, {
        withWorkflow: false,
      }),
    ).toThrow();
    expect(() =>
      expectNarrowedScheduleTriggerRef(NARROWED_WITHOUT_WORKFLOW, {
        withWorkflow: true,
      }),
    ).toThrow();
  });

  it('참조 자체가 없으면 실패한다 — 좁히기가 통째로 사라진 경우', () => {
    expect(() =>
      expectNarrowedScheduleTriggerRef(undefined, { withWorkflow: true }),
    ).toThrow();
  });
});
