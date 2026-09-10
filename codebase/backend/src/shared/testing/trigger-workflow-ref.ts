/**
 * `TriggerDto.workflow` 가 **그 응답 경로가 채워야 하는 대로** 실렸는지 확인하는 공용 단언.
 *
 * ## 왜 필요한가 — 이 축은 보장이 한 번 깨졌고 아무도 못 잡았다
 *
 * `triggers.service.ts` 의 `update()` 는 PATCH 바디에 `chatChannel` 이 있으면 `setupChatChannel`
 * 뒤에 트리거를 **재조회해 결과를 통째로 갈아치운다.** 그 재조회가 한때 `relations` 를 빼고
 * 읽어, **`chatChannel` 을 포함한 PATCH 응답에서만** `workflow` 가 사라졌다
 * (`review/code/2026/09/06/01_13_50` W4). `TriggerDto.workflow` JSDoc 은 *"생성 응답에만 없다"* 고
 * 보장하는데 그 보장이 구현보다 넓었던 것이다.
 *
 * 부재가 `spec/5-system/2-api-convention.md §5.4` 의 **키 생략형**이라 `assertMatchesContract` 는
 * 그 자리를 물지 못한다 — 키가 없어도 계약 위반이 아니기 때문이다.
 * **무엇이 있어야 하는가를 양성으로 고정하는 이 단언이 유일한 방어다.**
 *
 * ## 자매 헬퍼와 성격이 다르다
 *
 * `expectNarrowedScheduleTriggerRef`(`./schedule-trigger-ref.ts`)는 `ScheduleDto.trigger` 라는
 * **참조 객체 전체의 키셋**을 등가 비교한다 — 그 객체가 좁혀졌는지가 관심사다. 여기서는 응답이
 * `TriggerDto` **전체**라 키셋 등가 비교가 성립하지 않는다. 고정할 것은 `workflow` **유무**와
 * 그 참조의 **shape** 다. 그래서 옵션 이름도 다르다 — 자매는 `withWorkflow`("이 경로가 관계를
 * 채우는가", 도메인 조건), 여기는 `present`("그 키가 있는가", §5.4 판정 그 자체. `response-contract.ts`
 * 가 같은 뜻으로 이미 쓰는 어휘다).
 *
 * ## 장래 명명 규칙 — 접두어-only 충돌을 미리 막는다
 *
 * 이 이름은 `TriggerWorkflowRefDto` 에서 딴 것이다. 장래 스케줄 쪽 **nested** workflow shape
 * 검증이 필요해져 같은 관례를 쓰면 `expectScheduleTriggerWorkflowRef` 가 되고, 그러면 이 함수와
 * **접두어 하나만 다른** 이름이 된다 — `TriggerWorkflowRefDto`/`ScheduleTriggerWorkflowRefDto`
 * 두 DTO 가 *"한쪽을 다른 쪽으로 갈아 끼우지 말 것"* 이라 경고하는 그 패턴이 함수명으로 전이된다.
 * 그때는 `Narrowed` 를 유지해 `expectNarrowedScheduleTriggerWorkflowRef` 로 지을 것.
 *
 * ## 왜 `test/helpers/` 가 아니라 여기인가
 *
 * `PROJECT.md` 문면은 신규 e2e 헬퍼를 `test/helpers/` 로 보낸다. 그 자리에 두면 **이 파일의
 * self-spec 이 어느 러너에도 안 걸린다** — unit jest 는 `rootDir: 'src'` 라 `test/` 를 스캔하지
 * 않고, `test/jest-e2e.json` 은 `testRegex: '.e2e-spec.ts$'` 라 평범한 `*.spec.ts` 를 안 잡는다.
 * `src/shared/testing/**` 는 unit jest 안이라 self-spec 이 실제로 돌고, `tsconfig.build.json` 이
 * 이 디렉터리를 통째로 exclude 해 production 빌드 오염도 없다.
 */

/**
 * 응답에 **절대 실려서는 안 되는** 트리거 비밀 컬럼.
 *
 * 이름을 남겨 실패 메시지가 *무엇이* 샜는지 바로 말하게 한다
 * (`schedule-trigger-ref.ts` 의 같은 목록과 동일한 이유).
 */
const TRIGGER_SECRET_COLUMNS = [
  'notificationSecretV2',
  'chatChannelTokenV2',
] as const;

/** `TriggerWorkflowRefDto` 의 전 필드. 이보다 많아도 적어도 실패다. */
const WORKFLOW_REF_KEYS = ['id', 'name'] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param dto 응답 바디의 트리거 객체 (`data`, 또는 목록의 한 항목).
 * @param opts `present` — 이 응답 경로가 `workflow` 관계를 채우는가.
 *   **생성 응답만 `false`** 다: `create()` 는 방금 저장한 엔티티를 반환하고, 그 안의 chatChannel
 *   재조회 분기도 `relations` 를 싣지 않는다. 목록(`findAll` join)·단건(`findOneDetail` →
 *   `findById` relations)·수정(`findById` 로 시작, chatChannel 분기는 `relations` 재조회)은 채운다.
 */
export function expectTriggerWorkflowRef(
  dto: unknown,
  opts: { present: boolean },
): void {
  expect(dto).toBeDefined();
  const record = (dto ?? {}) as Record<string, unknown>;

  for (const column of TRIGGER_SECRET_COLUMNS) {
    expect(record).not.toHaveProperty(column);
  }

  if (!opts.present) {
    // §5.4 키 생략형 — **키 자체가 없어야** 한다. `null` 은 "상시 존재하며 지금 값이 없다" 는
    // 다른 표현이고, 그 둘을 가르는 것이 이 단언의 존재 이유다.
    expect(Object.hasOwn(record, 'workflow')).toBe(false);
    return;
  }

  expect(Object.hasOwn(record, 'workflow')).toBe(true);
  const workflow = record.workflow as Record<string, unknown> | null;
  expect(workflow).not.toBeNull();

  const ref = (workflow ?? {}) as { id?: unknown; name?: unknown };
  expect(Object.keys(ref).sort()).toEqual([...WORKFLOW_REF_KEYS].sort());
  expect(typeof ref.id).toBe('string');
  expect(String(ref.id)).toMatch(UUID_PATTERN);
  expect(typeof ref.name).toBe('string');
  expect(String(ref.name).length).toBeGreaterThan(0);
}
