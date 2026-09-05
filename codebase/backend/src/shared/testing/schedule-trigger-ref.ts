/**
 * `ScheduleDto.trigger` 가 **참조 수준으로 좁혀졌는지** 확인하는 공용 단언.
 *
 * ## 왜 헬퍼인가
 *
 * 같은 키 목록 단언이 e2e 3곳 + 컨트롤러 unit 2곳, 도합 **다섯 자리**에 글자 그대로
 * 반복돼 있었다 (`review/code/2026/09/06/00_48_51` W3). `ScheduleTriggerRefDto` 의 필드
 * 구성이 바뀌면 다섯 곳을 각각 찾아 고쳐야 하고, **하나를 놓치면 그 자리만 조용히 낡은
 * 형태를 계속 단언한다** — 그것이 정확히 이 브랜치가 반복해서 밟은 함정이다.
 *
 * ## 왜 `assertMatchesContract` 로 충분하지 않은가
 *
 * `trigger.workflow` 는 §5.4 **키 생략형**이라 계약 검증자는 **부재를 위반으로 보지
 * 않는다.** 좁히기 로직이 통째로 사라져 `workflow` 가 안 실려도 계약 대조는 통과한다.
 * 그래서 **무엇이 남아야 하는가**를 양성으로 고정하는 이 단언이 따로 필요하다.
 */

/**
 * 응답에 **절대 실려서는 안 되는** 트리거 비밀 컬럼.
 *
 * 아래 키 목록 등가 단언이 이미 이들을 배제하지만, 이름을 남겨 실패 메시지가 *무엇이*
 * 샜는지 바로 말하게 한다 (`TRIGGER_RESPONSE_STRIP_COLUMNS` 와 같은 목록).
 */
const TRIGGER_SECRET_COLUMNS = [
  'notificationSecretV2',
  'chatChannelTokenV2',
] as const;

/** `workflow` 관계가 로드된 경우와 아닌 경우의 기대 키 집합. */
const REF_KEYS_WITHOUT_WORKFLOW = ['id', 'name', 'workflowId'];
const REF_KEYS_WITH_WORKFLOW = [...REF_KEYS_WITHOUT_WORKFLOW, 'workflow'];

/**
 * @param trigger 응답 바디의 `data.trigger`.
 * @param opts `withWorkflow` — 이 경로가 `trigger.workflow` 를 채우는가. **생성 응답만
 *   `false`** 다 (방금 저장한 엔티티라 관계 미로드). 조회·목록·수정은 `findById` 를 타므로
 *   채워진다.
 */
export function expectNarrowedScheduleTriggerRef(
  trigger: unknown,
  opts: { withWorkflow: boolean },
): void {
  expect(trigger).toBeDefined();
  const record = (trigger ?? {}) as Record<string, unknown>;
  const expected = opts.withWorkflow
    ? REF_KEYS_WITH_WORKFLOW
    : REF_KEYS_WITHOUT_WORKFLOW;
  expect(Object.keys(record).sort()).toEqual([...expected].sort());
  for (const column of TRIGGER_SECRET_COLUMNS) {
    expect(record).not.toHaveProperty(column);
  }
}
