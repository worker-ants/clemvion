import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkflowVersionsController } from './workflow-versions.controller';
import { WorkflowVersionsService } from './workflow-versions.service';

describe('WorkflowVersionsController', () => {
  let controller: WorkflowVersionsController;
  let service: jest.Mocked<WorkflowVersionsService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkflowVersionsController],
      providers: [
        {
          provide: WorkflowVersionsService,
          useValue: {
            assertWorkspaceOwnership: jest.fn().mockResolvedValue(undefined),
            findByWorkflow: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue({ id: 'v-1' }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(WorkflowVersionsController);
    service = moduleRef.get(WorkflowVersionsService);
  });

  describe('findByWorkflow', () => {
    it('verifies workspace ownership before returning versions', async () => {
      await controller.findByWorkflow('wf-1', 'ws-1');
      expect(service.assertWorkspaceOwnership).toHaveBeenCalledWith(
        'wf-1',
        'ws-1',
      );
      expect(service.findByWorkflow).toHaveBeenCalledWith('wf-1');
    });

    it('does not call findByWorkflow when workspace check fails', async () => {
      service.assertWorkspaceOwnership.mockRejectedValueOnce(
        new NotFoundException(),
      );
      await expect(
        controller.findByWorkflow('wf-1', 'other-ws'),
      ).rejects.toThrow(NotFoundException);
      expect(service.findByWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('verifies workspace ownership before returning version detail', async () => {
      await controller.findOne('wf-1', 'v-1', 'ws-1');
      expect(service.assertWorkspaceOwnership).toHaveBeenCalledWith(
        'wf-1',
        'ws-1',
      );
      expect(service.findOne).toHaveBeenCalledWith('wf-1', 'v-1');
    });

    it('propagates NotFoundException from workspace check', async () => {
      service.assertWorkspaceOwnership.mockRejectedValueOnce(
        new NotFoundException(),
      );
      await expect(
        controller.findOne('wf-1', 'v-1', 'other-ws'),
      ).rejects.toThrow(NotFoundException);
      expect(service.findOne).not.toHaveBeenCalled();
    });
  });
});
