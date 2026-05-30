import { Test } from '@nestjs/testing';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';

describe('NodesController', () => {
  let controller: NodesController;
  let nodesService: {
    findByWorkflow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let componentRegistry: {
    listDefinitions: jest.Mock;
    listCategories: jest.Mock;
  };

  const WS = 'ws-1';

  beforeEach(async () => {
    nodesService = {
      findByWorkflow: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    componentRegistry = {
      listDefinitions: jest.fn(),
      listCategories: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [NodesController],
      providers: [
        { provide: NodesService, useValue: nodesService },
        { provide: NodeComponentRegistry, useValue: componentRegistry },
      ],
    }).compile();
    controller = module.get(NodesController);
  });

  // IDOR guard relies on the controller forwarding the resolved @WorkspaceId()
  // to the service on every workflow-scoped op; the service then enforces
  // cross-workspace NotFound. These assert the forwarding contract.
  describe('cross-workspace authorization forwarding', () => {
    it('findByWorkflow forwards workspaceId to the service', async () => {
      await controller.findByWorkflow('wf-1', WS);
      expect(nodesService.findByWorkflow).toHaveBeenCalledWith('wf-1', WS);
    });

    it('create forwards workspaceId to the service', async () => {
      const dto = { type: 't', category: 'logic', label: 'L' } as never;
      await controller.create('wf-1', WS, dto);
      expect(nodesService.create).toHaveBeenCalledWith('wf-1', WS, dto);
    });

    it('update forwards workspaceId to the service', async () => {
      const dto = { label: 'L2' } as never;
      await controller.update('n1', WS, dto);
      expect(nodesService.update).toHaveBeenCalledWith('n1', WS, dto);
    });

    it('remove forwards workspaceId to the service', async () => {
      await controller.remove('n1', WS);
      expect(nodesService.remove).toHaveBeenCalledWith('n1', WS);
    });
  });

  describe('listDefinitions', () => {
    it('returns definitions and categories from the registry', () => {
      const definitions = [
        {
          metadata: {
            type: 'x',
            category: 'logic',
            label: 'X',
            description: '',
            icon: 'Square',
            color: '#fff',
          },
          ports: { inputs: [], outputs: [] },
          configSchema: { type: 'object' },
        },
      ];
      const categories = [
        {
          id: 'logic',
          label: 'Logic',
          icon: 'GitBranch',
          color: '#3B82F6',
          order: 1,
        },
      ];
      componentRegistry.listDefinitions.mockReturnValue(definitions);
      componentRegistry.listCategories.mockReturnValue(categories);
      expect(controller.listDefinitions()).toEqual({ definitions, categories });
      expect(componentRegistry.listDefinitions).toHaveBeenCalledTimes(1);
      expect(componentRegistry.listCategories).toHaveBeenCalledTimes(1);
    });
  });
});
