import { NotFoundException, BadRequestException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let mockRepository: Record<string, jest.Mock>;

  const mockIntegration = {
    id: 'int-1',
    workspaceId: 'ws-1',
    serviceType: 'slack',
    name: 'My Slack',
    status: 'connected',
  };

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn().mockResolvedValue(mockIntegration),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    service = new IntegrationsService(mockRepository as never);
  });

  describe('testConnection', () => {
    it('should return success for existing integration', async () => {
      const result = await service.testConnection('int-1', 'ws-1');
      expect(result).toEqual({
        success: true,
        message: 'Connection successful',
      });
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'int-1', workspaceId: 'ws-1' },
      });
    });

    it('should throw NotFoundException for non-existent integration', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.testConnection('non-existent', 'ws-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reauthorize', () => {
    it('should throw BadRequestException when OAuth client ID is missing', async () => {
      delete process.env.SLACK_CLIENT_ID;

      await expect(service.reauthorize('int-1', 'ws-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return auth URL when OAuth client ID is set', async () => {
      process.env.SLACK_CLIENT_ID = 'test-client-id';

      const result = await service.reauthorize('int-1', 'ws-1');
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.state).toHaveLength(32); // 16 bytes hex

      delete process.env.SLACK_CLIENT_ID;
    });

    it('should reset status for non-OAuth integrations', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockIntegration,
        serviceType: 'http',
        status: 'error',
      });

      const result = await service.reauthorize('int-1', 'ws-1');
      expect(result).toEqual({ authUrl: '', state: '' });
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'connected' }),
      );
    });
  });
});
