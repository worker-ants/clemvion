import { isUuidShaped } from '../../common/utils/uuid';

// ─── 이 파일이 `test/helpers/` 가 아니라 `src/shared/testing/` 에 있는 이유 (파일 스코프) ───
//
// `PROJECT.md` 문면은 신규 e2e 헬퍼를 `test/helpers/` 로 보낸다. 그 자리에 두면 **이 파일의
// self-spec 이 어느 러너에도 안 걸린다** — unit jest 는 `rootDir: 'src'` 라 `test/` 를 스캔하지
// 않고, `test/jest-e2e.json` 은 `testRegex: '.e2e-spec.ts$'` 라 평범한 `*.spec.ts` 를 안 잡는다.
// 즉 `test/helpers/*.spec.ts` 는 **존재하지만 영구히 돌지 않는다.** `src/shared/testing/**` 는
// unit jest 안이라 self-spec 이 실제로 돈다.
//
// 이 판단의 전제는 세 설정 파일(`jest.config.ts` · `test/jest-e2e.json` · `tsconfig.build.json`)의
// 현재 상태다. 그중 하나가 바뀌면 이 註가 조용히 낡고, 최악의 경우 self-spec 이 CI 리포트에 안
// 잡히는 상태가 된다 — 이 파일이 막으려는 dead-test 위험을 이 註 자신도 안고 있다.
//
// **production 빌드 유출은 처음 단정적으로 적었는데 그것 역시 과장이었다.**
// `tsconfig.build.json` 이 `src/shared/testing/**` 를 exclude 하는 것은 사실이지만, `exclude` 는
// **root 파일 후보만** 거른다 — exclude 되지 않은 프로덕션 파일이 이 경로를 `import` 하면 tsc 는
// 그 파일을 프로그램에 편입시켜 **`dist/` 로 emit 한다**(실제 `tsc --listFiles` + `dist/` 산출로
// 재현 확인, `review/code/2026/09/10/14_34_18` side_effect W1). 게다가 `@types/jest` 가 ambient 라
// 프로덕션이 실수로 import 해도 **컴파일 에러가 나지 않고**, 이 함수가 호출될 때만 `ReferenceError`
// 가 난다. 현재는 `shared/testing/**` 를 import 하는 프로덕션 파일이 **0건**이라 안전하다 —
// 그 회귀를 감지할 가드는 아직 없다(후속 등재).
//
// 이 절을 `/** */` 가 아니라 `//` 로 적는 것은 일부러다 — 파일 스코프 서술을 doc comment 로 쓰면
// 어떤 선언에도 붙지 않는 **고아 JSDoc** 이 되고, 그 형태를 이 저장소가 이미 **네 번** 겪었다.
// 앞선 세 번은 2026-09-06 시점 집계이고, **네 번째가 바로 이 파일이다** — 이 註가 인용하는
// `review/code/2026/09/10/15_52_06` maintainability W1 자체가 그 네 번째 발견이다.
// (처음 여기 "세 번" 이라 적었다. 같은 커밋이 몇 줄 아래에서는 `/api/` 오기를 "네 번째" 로
// 맞게 세면서 이 줄만 안 고쳤다 — `review/code/2026/09/10/16_26_57` requirement W1.)

/**
 * 응답에 **절대 실려서는 안 되는** 트리거 비밀 컬럼.
 *
 * 이름을 남겨 실패 메시지가 *무엇이* 샜는지 바로 말하게 한다.
 *
 * > **이 목록은 정본의 세 번째 독립 사본이다 — 드리프트 위험이 있다.**
 * > 정본은 `modules/triggers/triggers.service.ts` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 이고
 * > 자매 `./schedule-trigger-ref.ts` 에 두 번째 사본이 있다. 값·순서가 현재 완전히 일치함을
 * > 실측 확인했지만 **결속 장치가 없다** — 정본이 네 번째 비밀 컬럼을 추가해도 두 헬퍼는 조용히
 * > 통과한다. 정본이 `export` 되지 않아 여기서 import 할 수 없고, 그 서비스 모듈을 테스트 헬퍼로
 * > 끌어오는 것은 의존 그래프상 과하다. **repo-guard 로 세 목록 동일성을 강제하는 것이 처방이고
 * > 후속으로 등재했다** — `CREATOR_PROJECTION` 선례(동일 리터럴 4중 복사가 실제 Critical 로 터진
 * > 뒤 단일 상수로 통합)가 이 형태의 가까운 이력이다.
 */
const TRIGGER_SECRET_COLUMNS = [
  'notificationSecretV2',
  'chatChannelTokenV2',
] as const;

/** `TriggerWorkflowRefDto` 의 전 필드. 이보다 많아도 적어도 실패다. */
const WORKFLOW_REF_KEYS = ['id', 'name'] as const;

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
 * **왜 계약 검증자로 안 되나 — 처음 이 자리에 과장해 적었다.** `assertMatchesContract` 는 무능하지
 * 않다: `response-contract.ts` 의 `visit()` 은 optional-non-nullable 필드에 `null` 이 오면
 * `kind:'null'` 로 **잡는다**. 정확한 사실은 **이 chatChannel 재조회 분기에 그 검증자를 거는 기존
 * 호출이 하나도 없다**는 것이다(부재 자체는 §5.4 키 생략형이라 위반이 아니므로 그 축으로는 애초에
 * 안 걸린다). 그래서 이 양성 단언이 필요하다 — "검증자가 못 잡는다" 가 아니라 "이 분기가 어디에도
 * 안 걸려 있다" 가 근거다.
 *
 * ## 자매 헬퍼와 성격이 다르다 — 그리고 오용의 결과가 비대칭이다
 *
 * `expectNarrowedScheduleTriggerRef`(`./schedule-trigger-ref.ts`)는 `ScheduleDto.trigger` 라는
 * **참조 객체 전체의 키셋**을 등가 비교한다 — 그 객체가 좁혀졌는지가 관심사다. 여기서는 응답이
 * `TriggerDto` **전체**라 키셋 등가 비교가 성립하지 않는다. 고정할 것은 `workflow` **유무**와
 * 그 참조의 **shape** 다. 그래서 옵션 이름도 다르다 — 자매는 `withWorkflow`("이 경로가 관계를
 * 채우는가", 도메인 조건), 여기는 `present`("그 키가 있는가", §5.4 판정 그 자체이며
 * `response-contract.ts` 가 같은 뜻으로 이미 쓰는 어휘다). 옵션 객체를 서로 바꿔 넘기면 구조적
 * 타이핑이 컴파일 타임에 잡는다.
 *
 * **그러나 함수를 잘못 고르는 오용은 방향에 따라 결과가 다르다.** 자매를 `TriggerDto` 전체에 쓰면
 * 여분 키 때문에 **시끄럽게** 실패한다. 반대로 **이 헬퍼를 `ScheduleDto.trigger` 에 쓰면 바깥
 * 키셋을 안 보므로 "참조가 실제로 좁혀졌는지" 를 조용히 검증하지 못한 채 통과한다** — 자매가
 * 막으려는 결함 클래스(넓은 참조가 새는 것)를 놓치는 방향이다. 좁힌 참조에는 반드시 자매를 쓸 것.
 *
 * ## 장래 명명 규칙 — 접두어-only 충돌을 미리 막는다
 *
 * 이 이름은 `TriggerWorkflowRefDto` 에서 딴 것이다. 장래 스케줄 쪽 **nested** workflow shape
 * 검증이 필요해져 같은 관례를 쓰면 `expectScheduleTriggerWorkflowRef` 가 되고, 그러면 이 함수와
 * **접두어 하나만 다른** 이름이 된다 — `TriggerWorkflowRefDto`/`ScheduleTriggerWorkflowRefDto`
 * 두 DTO 가 *"한쪽을 다른 쪽으로 갈아 끼우지 말 것"* 이라 경고하는 그 패턴이 함수명으로 전이된다.
 * 그때는 `Narrowed` 를 유지해 `expectNarrowedScheduleTriggerWorkflowRef` 로 지을 것.
 *
 * @param dto 응답 바디의 트리거 객체 (`data`, 또는 목록의 한 항목).
 * @param opts `present` — 이 응답 경로가 `workflow` 관계를 채우는가.
 *   **생성 응답만 `false`** 다: `create()` 는 방금 저장한 엔티티를 반환하고, 그 안의 chatChannel
 *   재조회 분기도 `relations` 를 싣지 않는다. 목록(`findAll` join)·단건(`findOneDetail` →
 *   `findById` relations)·수정(`findById` 로 시작, chatChannel 분기는 `relations` 재조회)은 채운다.
 * @param opts `expectedWorkflowId` — `present: true` 일 때 **어느 워크플로우여야 하는가**.
 *   shape 만 보면 *엉뚱한 relation 에서 채워진 그럴듯한 UUID+이름* 이 통과한다
 *   (`review/code/2026/09/10/14_34_18` testing W1). 호출부가 아는 값을 넘겨 identity 를 고정한다.
 */
export function expectTriggerWorkflowRef(
  dto: unknown,
  opts: { present: boolean; expectedWorkflowId?: string },
): void {
  // `toBeDefined()` 는 `null` 을 거르지 않는다 — 최상위가 `null` 인 채 부재 판정을 통과하던
  // 구멍을 닫는다 (`review/code/2026/09/10/14_34_18` testing W2).
  expect(dto).not.toBeNull();
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
  // 손으로 적은 정규식 대신 정본을 실행한다 — `isUuidShaped` 가 "Postgres `uuid` 컬럼이 파싱할
  // 수 있는 형태인가" 를 이미 소유한다(`workflow.id` 가 바로 그 컬럼이다).
  expect(isUuidShaped(String(ref.id))).toBe(true);
  expect(typeof ref.name).toBe('string');
  expect(String(ref.name).length).toBeGreaterThan(0);

  if (opts.expectedWorkflowId !== undefined) {
    expect(ref.id).toBe(opts.expectedWorkflowId);
  }
}
