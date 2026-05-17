import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { Folder } from './entities/folder.entity';

describe('FoldersService', () => {
  let service: FoldersService;

  const mockFolder: Partial<Folder> = {
    id: 'folder-uuid-1',
    workspaceId: 'ws-uuid-1',
    name: 'Test Folder',
    parentId: null as unknown as string,
    sortOrder: 0,
  };

  const mockRepository = {
    find: jest.fn().mockResolvedValue([mockFolder]),
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((data) => data),
    save: jest
      .fn()
      .mockImplementation((data) => Promise.resolve({ id: 'new-id', ...data })),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoldersService,
        { provide: getRepositoryToken(Folder), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<FoldersService>(FoldersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return folders', async () => {
      const result = await service.findAll('ws-uuid-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return a folder', async () => {
      mockRepository.findOne.mockResolvedValue(mockFolder);
      const result = await service.findById('folder-uuid-1', 'ws-uuid-1');
      expect(result.name).toBe('Test Folder');
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(
        service.findById('nonexistent', 'ws-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a folder at root level', async () => {
      const result = await service.create('ws-uuid-1', { name: 'New Folder' });
      expect(result.name).toBe('New Folder');
    });

    it('should enforce max nesting depth', async () => {
      // Build a chain of 5 parents
      let callCount = 0;
      mockRepository.findOne.mockImplementation(() => {
        callCount++;
        if (callCount <= 5) {
          return Promise.resolve({
            id: `parent-${callCount}`,
            parentId: callCount < 5 ? `parent-${callCount + 1}` : null,
            workspaceId: 'ws-uuid-1',
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.create('ws-uuid-1', {
          name: 'Deep Folder',
          parentId: 'parent-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
