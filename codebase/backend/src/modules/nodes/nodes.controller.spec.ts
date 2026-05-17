import { Test } from '@nestjs/testing';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';

describe('NodesController', () => {
  let controller: NodesController;
  let componentRegistry: {
    listDefinitions: jest.Mock;
    listCategories: jest.Mock;
  };

  beforeEach(async () => {
    componentRegistry = {
      listDefinitions: jest.fn(),
      listCategories: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [NodesController],
      providers: [
        { provide: NodesService, useValue: {} },
        { provide: NodeComponentRegistry, useValue: componentRegistry },
      ],
    }).compile();
    controller = module.get(NodesController);
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
