import { SchedulesController } from './schedules.controller';
import type { SchedulesService } from './schedules.service';
import type { CreateScheduleDto } from './dto/create-schedule.dto';
import type { UpdateScheduleDto } from './dto/update-schedule.dto';

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
    expect(Object.keys(res.trigger).sort()).toEqual([
      'id',
      'name',
      'workflowId',
    ]);
    expect(res.trigger).not.toHaveProperty('notificationSecretV2');
    expect(res.trigger).not.toHaveProperty('chatChannelTokenV2');
  });

  it('update 는 id·workspaceId·dto·userId 순서를 지킨다', async () => {
    const dto = { name: 'S2' } as UpdateScheduleDto;

    await controller.update('sch-1', WS, dto, USER);

    expect(service.update).toHaveBeenCalledWith('sch-1', WS, dto, USER);
  });

  it('remove 는 id·workspaceId·userId 순서를 지킨다', async () => {
    await controller.remove('sch-2', WS, USER);

    expect(service.remove).toHaveBeenCalledWith('sch-2', WS, USER);
  });
});
