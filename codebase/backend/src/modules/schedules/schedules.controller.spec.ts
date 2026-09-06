import { SchedulesController } from './schedules.controller';
import type { SchedulesService } from './schedules.service';
import type { CreateScheduleDto } from './dto/create-schedule.dto';
import type { UpdateScheduleDto } from './dto/update-schedule.dto';
import { expectNarrowedScheduleTriggerRef } from '../../shared/testing/schedule-trigger-ref';

/**
 * 컨트롤러 → 서비스 **행위자(userId) 배선** 검증.
 *
 * 왜 필요한가 — `create(workspaceId, dto, userId)` 는 1·3번째 인자가 **둘 다 string** 이라
 * 스왑해도 컴파일이 통과한다(실측: 스왑 후 `tsc --noEmit` 오류 0건). 스왑되면 감사 로그의
 * workspace 와 actor 가 통째로 뒤바뀌는데, 그 상태로도 감사 행은 정상적으로 쌓여 **조용히
 * 틀린 감사**가 된다. 서비스 레벨 테스트는 서비스에 이미 들어온 값을 볼 뿐이라 이 스왑을
 * 못 잡는다 — 경계에서 단언해야 한다.
 *
 * 이 파일은 리뷰가 4라운드 연속 지적한 갭이다. 그동안 "타입이 강제한다" 를 유예 근거로
 * 삼았는데 위 실측이 그 전제를 반증했다.
 */
/**
 * 서비스가 실제로 돌려주는 형태의 스케줄 — **조인된 트리거 엔티티가 통째로** 붙어 있다.
 *
 * 비밀 컬럼을 일부러 채운다. 응답 경계(`toResponse`)가 참조 4필드로 좁히지 않으면 그대로
 * wire 로 나가고, 그 회귀를 이 mock 이 잡는다.
 */
function scheduleWithSecretTrigger(): Record<string, unknown> {
  return {
    id: 'sch-1',
    trigger: {
      id: 'trg-1',
      name: 'nightly',
      workflowId: 'wf-1',
      notificationSecretV2: 'wsk_should_not_leak',
      chatChannelTokenV2: 'secret://triggers/trg-1/bot-token.v2',
    },
  };
}

describe('SchedulesController — 행위자(userId) 배선', () => {
  let controller: SchedulesController;
  let service: {
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const WS = 'ws-1';
  const USER = 'user-1';

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(scheduleWithSecretTrigger()),
      update: jest.fn().mockResolvedValue(scheduleWithSecretTrigger()),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    controller = new SchedulesController(
      service as unknown as SchedulesService,
    );
  });

  it('create 는 workspaceId 와 userId 를 각자 자리에 전달한다', async () => {
    const dto = { workflowId: 'wf-1', name: 'S' } as CreateScheduleDto;

    const res = (await controller.create(WS, dto, USER)) as {
      trigger: Record<string, unknown>;
    };

    // 위치까지 고정한다 — objectContaining 으로는 스왑을 못 잡는다.
    expect(service.create).toHaveBeenCalledWith(WS, dto, USER);

    // 응답 경계가 조인된 트리거를 **참조 필드로 좁히는가** — 이 컨트롤러의 보안 경계다.
    // 종전 mock 은 `{ id: 'sch-1' }` 이라 `trigger` 가 아예 없어, `toResponse` 가 무엇을
    // 하든 이 테스트는 통과했다 (`review/code/2026/09/05/21_40_37` W3).
    //
    // mock 의 트리거에 `workflow` 관계가 없으므로 `withWorkflow: false` 다.
    expectNarrowedScheduleTriggerRef(res.trigger, { withWorkflow: false });
  });

  it('update 는 id·workspaceId·dto·userId 순서를 지킨다', async () => {
    const dto = { name: 'S2' } as UpdateScheduleDto;

    const res = (await controller.update('sch-1', WS, dto, USER)) as {
      trigger: Record<string, unknown>;
    };

    expect(service.update).toHaveBeenCalledWith('sch-1', WS, dto, USER);

    // `create` 와 **같은 단언** — mock 은 비밀을 채워 두는데 반환값을 안 보면 비대칭이다
    // (`review/code/2026/09/05/22_24_58` INFO#15). 두 경로가 같은 경계를 지나므로 둘 다 문다.
    expectNarrowedScheduleTriggerRef(res.trigger, { withWorkflow: false });
  });

  /**
   * **불변식 위반은 던지되, 진단은 새지 않는다.**
   *
   * `trigger` 가 없는 행이 응답 경계에 오면 던진다 — 키를 생략하면 `ScheduleDto.trigger`
   * 의 §5.4 기본형 선언(`@ApiProperty`)을 깨기 때문이다. 다만 `GlobalExceptionFilter` 는
   * `HttpException` 의 `message` 를 **응답 바디로 그대로 흘리므로**, 진단 문구를 예외
   * 인자로 넘기면 `schedule.id` 와 내부 쿼리 구조가 500 바디에 실린다(CWE-209).
   *
   * 첫 판이 정확히 그렇게 했고 `review/consistency/2026/09/06/00_48_52` W1 이 잡았다.
   * 여기서 **두 가지를 함께** 문다 — 던지는가, 그리고 무엇을 말하지 **않는가**.
   */
  it('trigger 미로드 행은 던지되 응답에 진단을 싣지 않는다', async () => {
    service.update.mockResolvedValue({ id: 'sch-leak-probe' });

    await expect(
      controller.update('sch-leak-probe', WS, {} as UpdateScheduleDto, USER),
    ).rejects.toMatchObject({
      response: {
        code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
    });

    // 예외가 실어 나르는 문자열 전체에 식별자·내부 구조가 없어야 한다. `message` 만 보면
    // 다른 필드로 새는 변형을 놓친다 — 직렬화 전체를 본다.
    let thrown: unknown;
    await controller
      .update('sch-leak-probe', WS, {} as UpdateScheduleDto, USER)
      .catch((err: unknown) => {
        thrown = err;
      });
    const serialized = JSON.stringify(
      (thrown as { response?: unknown }).response,
    );
    expect(serialized).not.toContain('sch-leak-probe');
    expect(serialized).not.toContain('trigger_id');
    expect(serialized).not.toContain('join');
  });

  it('remove 는 id·workspaceId·userId 순서를 지킨다', async () => {
    await controller.remove('sch-2', WS, USER);

    expect(service.remove).toHaveBeenCalledWith('sch-2', WS, USER);
  });
});
