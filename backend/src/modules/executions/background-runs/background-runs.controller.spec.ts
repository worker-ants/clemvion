import { BackgroundRunsController } from './background-runs.controller';
import { BackgroundRunsService } from './background-runs.service';

describe('BackgroundRunsController', () => {
  let controller: BackgroundRunsController;
  let service: { getBackgroundRun: jest.Mock };

  beforeEach(() => {
    service = { getBackgroundRun: jest.fn() };
    controller = new BackgroundRunsController(
      service as unknown as BackgroundRunsService,
    );
  });

  it('forwards path params, query and workspaceId to the service', async () => {
    const fakeResponse = { backgroundRunId: 'bg-run-id' };
    service.getBackgroundRun.mockResolvedValue(fakeResponse);

    const result = await controller.findOne(
      'exec-1',
      'bg-run-id',
      { limit: 25, cursor: undefined },
      'ws-1',
    );

    expect(service.getBackgroundRun).toHaveBeenCalledWith(
      'exec-1',
      'bg-run-id',
      { limit: 25, cursor: undefined },
      'ws-1',
    );
    expect(result).toBe(fakeResponse);
  });

  it('passes cursor through unmodified', async () => {
    service.getBackgroundRun.mockResolvedValue({});

    await controller.findOne(
      'exec-1',
      'bg-run-id',
      { limit: 50, cursor: 'opaque-token-here' },
      'ws-1',
    );

    expect(service.getBackgroundRun).toHaveBeenCalledWith(
      'exec-1',
      'bg-run-id',
      { limit: 50, cursor: 'opaque-token-here' },
      'ws-1',
    );
  });
});
