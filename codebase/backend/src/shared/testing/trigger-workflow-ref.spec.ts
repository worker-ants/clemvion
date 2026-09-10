import { describe, it, expect } from '@jest/globals';

import { expectTriggerWorkflowRef } from './trigger-workflow-ref';

/**
 * **단언 헬퍼 자신의 회귀 가드.**
 *
 * 이 헬퍼는 `trigger-workflow-ref.e2e-spec.ts` 다섯 자리에서 `TriggerDto.workflow` 가 그 경로가
 * 채워야 하는 대로 실렸는지 확인하는 **유일한 양성 수단**이다. 헬퍼가 무르게 바뀌면 다섯 자리가
 * **동시에** 조용히 통과한다 — 자매 헬퍼가 같은 이유로 self-spec 을 갖게 된 이력이 있다
 * (`review/code/2026/09/06/01_13_50` W6).
 *
 * 그래서 통과 경로만 보지 않고 **실패해야 하는 경로**를 각각 문다.
 */
describe('expectTriggerWorkflowRef', () => {
  const WF_ID = '3f1c2b8a-5d4e-4a7b-9c0d-1e2f3a4b5c6d';

  const WITH_WORKFLOW = {
    id: 'trg-1',
    name: 'hook',
    workflowId: WF_ID,
    workflow: { id: WF_ID, name: 'W' },
  };
  const WITHOUT_WORKFLOW = {
    id: 'trg-1',
    name: 'hook',
    workflowId: WF_ID,
  };

  it('두 형태 각각 통과한다', () => {
    expectTriggerWorkflowRef(WITH_WORKFLOW, { present: true });
    expectTriggerWorkflowRef(WITHOUT_WORKFLOW, { present: false });
  });

  it('`present: false` 인데 키가 있으면 실패한다', () => {
    expect(() =>
      expectTriggerWorkflowRef(WITH_WORKFLOW, { present: false }),
    ).toThrow();
  });

  it('`present: true` 인데 키가 없으면 실패한다', () => {
    expect(() =>
      expectTriggerWorkflowRef(WITHOUT_WORKFLOW, { present: true }),
    ).toThrow();
  });

  /**
   * §5.4 는 **키 생략**과 `null`(키 present)을 **다른 표현**으로 규정한다. 부재를 `null` 로
   * 바꾸는 회귀는 계약 검증자가 안 잡으므로 여기서 갈라야 한다 — 이 헬퍼의 존재 이유 절반이 이것.
   */
  it('`null` 은 부재가 아니다 — 양쪽 판정 모두에서 실패한다', () => {
    const nulled = { ...WITHOUT_WORKFLOW, workflow: null };
    expect(() =>
      expectTriggerWorkflowRef(nulled, { present: false }),
    ).toThrow();
    expect(() => expectTriggerWorkflowRef(nulled, { present: true })).toThrow();
  });

  it('workflow shape 이 어긋나면 실패한다 — 여분 키·누락 키 각각', () => {
    expect(() =>
      expectTriggerWorkflowRef(
        { ...WITHOUT_WORKFLOW, workflow: { id: WF_ID, name: 'W', slug: 'w' } },
        { present: true },
      ),
    ).toThrow();
    expect(() =>
      expectTriggerWorkflowRef(
        { ...WITHOUT_WORKFLOW, workflow: { name: 'W' } },
        { present: true },
      ),
    ).toThrow();
  });

  it('`id` 가 UUID 가 아니면 실패한다', () => {
    expect(() =>
      expectTriggerWorkflowRef(
        { ...WITHOUT_WORKFLOW, workflow: { id: 'not-a-uuid', name: 'W' } },
        { present: true },
      ),
    ).toThrow();
  });

  it('`name` 이 빈 문자열이면 실패한다 — 좁히기가 값을 잃은 형태', () => {
    expect(() =>
      expectTriggerWorkflowRef(
        { ...WITHOUT_WORKFLOW, workflow: { id: WF_ID, name: '' } },
        { present: true },
      ),
    ).toThrow();
  });

  it('비밀 컬럼이 섞여 들어오면 실패한다 — 두 판정 모두에서', () => {
    for (const secret of ['notificationSecretV2', 'chatChannelTokenV2']) {
      expect(() =>
        expectTriggerWorkflowRef(
          { ...WITH_WORKFLOW, [secret]: 'leaked' },
          { present: true },
        ),
      ).toThrow();
      expect(() =>
        expectTriggerWorkflowRef(
          { ...WITHOUT_WORKFLOW, [secret]: 'leaked' },
          { present: false },
        ),
      ).toThrow();
    }
  });
});
