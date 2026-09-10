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
 *
 * > **케이스 순서는 헬퍼의 가드 실행 순서를 따른다 — 명시 규약이다.** 가드는 **11개**다:
 * > ① `dto` not-null → ② 비밀 컬럼 → ③ `present:false` → ④ `present:true` →
 * > ⑤ `workflow` not-null → ⑥ 키셋 → ⑦ `id` 타입 → ⑧ `id` UUID → ⑨ `name` 타입 →
 * > ⑩ `name` 길이 → ⑪ `expectedWorkflowId`. 헬퍼를 위에서 아래로 읽으며 대응 테스트를 찾을 수
 * > 있게 하는 것이 목적이다. **이 규약은 원래 암묵적이었고 내가 신규 4건을 파일 뒤에 뭉텅이로
 * > 붙이며 두 지점에서 깼다** (`review/code/2026/09/10/15_52_06` maintainability W3) — 그래서
 * > 여기 글로 못박는다. 새 가드를 추가하면 그 가드의 자리에 테스트도 넣을 것.
 * >
 * > **처음 이 목록을 10개로 적어 ⑤ 를 빠뜨렸다.** 누락을 막으려고 신설한 목록이 그 자체로
 * > 불완전했던 것이다 — `review/code/2026/09/10/16_26_57` documentation W1 이 잡았다.
 * >
 * > **⑤ 는 이 규약의 유일한 예외다 — 독립 판별이 원리적으로 불가능하다.** 그 줄을 지운 뮤턴트에서
 * > self-spec 이 **12/12 GREEN 을 유지**한다(같은 라운드 testing W1 이 실측). 다음 줄
 * > `workflow ?? {}` 가 `null` 을 `{}` 로 바꾸므로 키셋 검사(⑥)가 항상 대신 던지기 때문이고,
 * > `workflow: null` 이면서 키셋을 통과하는 값은 만들 수 없다. **그럼에도 남겨 둔다** — 이 헬퍼의
 * > 존재 이유 절반이 `null` 과 부재를 가르는 것인데, ⑤ 가 없으면 실패 메시지가
 * > *"keys [] ≠ ['id','name']"* 이 되어 **`null` 인지 `{}` 인지 말해 주지 않는다.** 즉 ⑤ 의
 * > 가치는 검출이 아니라 **진단 품질**이다. 아래 ⑤ 케이스가 무는 것은 ③ 쪽 분기다.
 *
 * > **비밀 컬럼 이름을 여기 다시 적는 것은 일부러다.** 헬퍼의 `TRIGGER_SECRET_COLUMNS` 를
 * > import 해 순회하면, 누가 그 목록을 줄여도 이 스펙이 **그대로 통과**한다 — 대조군이 사라져
 * > vacuous 가 된다. 헬퍼↔프로덕션 중복은 드리프트 위험이지만(헬퍼 docstring 참조) 스펙↔헬퍼
 * > 중복은 **독립 대조군**이다. 장래 DRY 정리 대상으로 오인하지 말 것.
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

  // ── 가드 1: 최상위 `dto` ──
  it('최상위 `dto` 가 `null` 이면 두 판정 모두에서 실패한다', () => {
    expect(() => expectTriggerWorkflowRef(null, { present: false })).toThrow();
    expect(() => expectTriggerWorkflowRef(null, { present: true })).toThrow();
  });

  // ── 가드 2: 비밀 컬럼 ──
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

  // ── 가드 3·4: `present` 판정 양방향 ──
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
   * ## 가드 ③·⑤ — `null` 은 부재가 아니다
   *
   * §5.4 는 **키 생략**과 `null`(키 present)을 **다른 표현**으로 규정한다. 부재를 `null` 로
   * 바꾸는 회귀는 계약 검증자가 안 잡으므로 여기서 갈라야 한다 — 이 헬퍼의 존재 이유 절반이 이것.
   *
   * **이 케이스가 실제로 무는 것은 ③ 쪽뿐이다.** `present: true` 갈래는 ⑤(`workflow` not-null)를
   * 노리지만 다음 줄 `workflow ?? {}` 때문에 ⑥ 키셋 검사가 먼저 던진다 — 헤더 docstring 의 ⑤
   * 예외 항목 참조. 라벨이 이 하나만 비어 있어 *"가드가 10개"* 로 오인될 수 있다는 지적을 받아
   * 번호를 붙였다 (`review/code/2026/09/10/16_26_57` testing INFO).
   */
  it('`null` 은 부재가 아니다 — 양쪽 판정 모두에서 실패한다', () => {
    const nulled = { ...WITHOUT_WORKFLOW, workflow: null };
    expect(() =>
      expectTriggerWorkflowRef(nulled, { present: false }),
    ).toThrow();
    expect(() => expectTriggerWorkflowRef(nulled, { present: true })).toThrow();
  });

  // ── 가드 6: 참조 키셋 ──
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

  /**
   * ## 가드 7: `id` **타입** — fixture 가 `isUuidShaped` 와 축이 겹치지 않아야 한다
   *
   * **처음 이 케이스를 `id: 42` 로 썼고 그것은 vacuous 였다.** `expect(typeof ref.id)` 를 지운
   * 뮤턴트에서 self-spec 이 **12/12 GREEN 을 유지**했다 — 다음 줄 `isUuidShaped(String(42))` 가
   * `'42'` 를 거부해 `.toThrow()` 를 어차피 만족시키기 때문이다. 즉 그 fixture 는 타입 단언이
   * 아니라 **기존 「`id` 가 UUID 가 아니면」 테스트와 같은 축**을 재검증할 뿐이었다
   * (`review/code/2026/09/10/15_52_06` testing W1 이 뮤테이션으로 실증).
   *
   * 판별 fixture 는 **`String()` 변환이 UUID 모양이면서 `typeof` 는 문자열이 아닌** 값이다.
   * 이 값에서만 두 가드가 갈린다 — 타입 단언이 있으면 거부, 없으면 조용히 통과.
   *
   * *vacuous 를 고치려 넣은 케이스가 그 자체로 vacuous 했다* — 대조군 없는 단언은 값을 넣어
   * 실제로 갈라 보기 전까지 판별력을 주장할 수 없다.
   */
  it('`id` 가 문자열이 아니면 실패한다 — `String()` 이 UUID 모양인 값으로만 갈린다', () => {
    expect(() =>
      expectTriggerWorkflowRef(
        {
          ...WITHOUT_WORKFLOW,
          workflow: { id: { toString: () => WF_ID }, name: 'W' },
        },
        { present: true },
      ),
    ).toThrow();
  });

  // ── 가드 8: `id` UUID 형태 ──
  it('`id` 가 UUID 가 아니면 실패한다', () => {
    expect(() =>
      expectTriggerWorkflowRef(
        { ...WITHOUT_WORKFLOW, workflow: { id: 'not-a-uuid', name: 'W' } },
        { present: true },
      ),
    ).toThrow();
  });

  /**
   * ## 가드 9: `name` 타입 — 뮤테이션이 증명한 사각지대였다
   *
   * 헬퍼의 `expect(typeof ref.name).toBe('string')` 을 지워도 이 스펙이 **8/8 GREEN 을 유지**했다
   * (`review/code/2026/09/10/14_34_18` testing W3) — 빈 문자열 케이스는
   * `String(ref.name).length` 쪽만 물고 타입 단언은 아무도 물지 않았다.
   *
   * `id` 쪽은 `isUuidShaped` 가 간접 방어하지만 `name` 에는 그런 이차 방어가 **없다** — 그래서
   * 여기는 평범한 non-string 값(숫자·불리언·객체·배열)으로도 갈린다. 위 가드 7 이 특수한 fixture
   * 를 써야 하는 것과 **이유가 다르다.**
   */
  it('`name` 이 문자열이 아니면 실패한다 — 타입 단언의 대조군', () => {
    for (const bad of [42, true, {}, []]) {
      expect(() =>
        expectTriggerWorkflowRef(
          { ...WITHOUT_WORKFLOW, workflow: { id: WF_ID, name: bad } },
          { present: true },
        ),
      ).toThrow();
    }
  });

  // ── 가드 10: `name` 길이 ──
  it('`name` 이 빈 문자열이면 실패한다 — 좁히기가 값을 잃은 형태', () => {
    expect(() =>
      expectTriggerWorkflowRef(
        { ...WITHOUT_WORKFLOW, workflow: { id: WF_ID, name: '' } },
        { present: true },
      ),
    ).toThrow();
  });

  // ── 가드 11: identity ──
  it('`expectedWorkflowId` 가 다르면 실패한다 — shape 만 맞는 엉뚱한 relation 을 잡는다', () => {
    const other = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expectTriggerWorkflowRef(WITH_WORKFLOW, {
      present: true,
      expectedWorkflowId: WF_ID,
    });
    expect(() =>
      expectTriggerWorkflowRef(WITH_WORKFLOW, {
        present: true,
        expectedWorkflowId: other,
      }),
    ).toThrow();
  });
});
