import { Test } from '@nestjs/testing';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';

describe('NodesController', () => {
  let controller: NodesController;
  let componentRegistry: { listDefinitions: jest.Mock };

  beforeEach(async () => {
    componentRegistry = { listDefinitions: jest.fn() };
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
    it('delegates to NodeComponentRegistry.listDefinitions', () => {
      const fixture = [
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
      componentRegistry.listDefinitions.mockReturnValue(fixture);
      expect(controller.listDefinitions()).toBe(fixture);
      expect(componentRegistry.listDefinitions).toHaveBeenCalledTimes(1);
    });
  });
});
