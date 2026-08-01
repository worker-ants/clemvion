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
      create: jest.fn().mockResolvedValue({ id: 'sch-1' }),
      update: jest.fn().mockResolvedValue({ id: 'sch-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    controller = new SchedulesController(
      service as unknown as SchedulesService,
    );
  });

  it('create 는 workspaceId 와 userId 를 각자 자리에 전달한다', async () => {
    const dto = { workflowId: 'wf-1', name: 'S' } as CreateScheduleDto;

    await controller.create(WS, dto, USER);

    // 위치까지 고정한다 — objectContaining 으로는 스왑을 못 잡는다.
    expect(service.create).toHaveBeenCalledWith(WS, dto, USER);
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
