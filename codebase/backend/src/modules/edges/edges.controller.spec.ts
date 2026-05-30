import { Test } from '@nestjs/testing';
import { EdgesController } from './edges.controller';
import { EdgesService } from './edges.service';

describe('EdgesController', () => {
  let controller: EdgesController;
  let edgesService: {
    findByWorkflow: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };

  const WS = 'ws-1';

  beforeEach(async () => {
    edgesService = {
      findByWorkflow: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      controllers: [EdgesController],
      providers: [{ provide: EdgesService, useValue: edgesService }],
    }).compile();
    controller = module.get(EdgesController);
  });

  // IDOR guard relies on the controller forwarding the resolved @WorkspaceId()
  // to the service on every workflow-scoped op; the service then enforces
  // cross-workspace NotFound. These assert the forwarding contract.
  describe('cross-workspace authorization forwarding', () => {
    it('findByWorkflow forwards workspaceId to the service', async () => {
      await controller.findByWorkflow('wf-1', WS);
      expect(edgesService.findByWorkflow).toHaveBeenCalledWith('wf-1', WS);
    });

    it('create forwards workspaceId to the service', async () => {
      const dto = { sourceNodeId: 'a', targetNodeId: 'b' } as never;
      await controller.create('wf-1', WS, dto);
      expect(edgesService.create).toHaveBeenCalledWith('wf-1', WS, dto);
    });

    it('remove forwards workspaceId to the service', async () => {
      await controller.remove('e1', WS);
      expect(edgesService.remove).toHaveBeenCalledWith('e1', WS);
    });
  });
});
