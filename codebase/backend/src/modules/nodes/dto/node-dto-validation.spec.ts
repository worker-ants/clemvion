import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateNodeDto } from './create-node.dto';
import { UpdateNodeDto } from './update-node.dto';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALIDATE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };
const BASE_NODE = { type: 'test', category: 'trigger', label: 'Test' };

describe('CreateNodeDto', () => {
  describe('containerId transform', () => {
    it('should transform empty string to null', () => {
      const dto = plainToInstance(CreateNodeDto, {
        ...BASE_NODE,
        containerId: '',
      });
      expect(dto.containerId).toBeNull();
    });

    it('should keep valid UUID unchanged', () => {
      const dto = plainToInstance(CreateNodeDto, {
        ...BASE_NODE,
        containerId: VALID_UUID,
      });
      expect(dto.containerId).toBe(VALID_UUID);
    });
  });

  describe('toolOwnerId transform', () => {
    it('should transform empty string to null', () => {
      const dto = plainToInstance(CreateNodeDto, {
        ...BASE_NODE,
        toolOwnerId: '',
      });
      expect(dto.toolOwnerId).toBeNull();
    });

    it('should keep valid UUID unchanged', () => {
      const dto = plainToInstance(CreateNodeDto, {
        ...BASE_NODE,
        toolOwnerId: VALID_UUID,
      });
      expect(dto.toolOwnerId).toBe(VALID_UUID);
    });
  });

  describe('validation', () => {
    it('should pass when containerId is null after empty string transform', async () => {
      const dto = plainToInstance(CreateNodeDto, {
        ...BASE_NODE,
        containerId: '',
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      const containerError = errors.find((e) => e.property === 'containerId');
      expect(containerError).toBeUndefined();
    });

    it('should fail when containerId is an invalid non-empty string', async () => {
      const dto = plainToInstance(CreateNodeDto, {
        ...BASE_NODE,
        containerId: 'not-a-uuid',
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'containerId')).toBeDefined();
    });
  });
});

describe('UpdateNodeDto', () => {
  describe('containerId transform', () => {
    it('should transform empty string to null', () => {
      const dto = plainToInstance(UpdateNodeDto, { containerId: '' });
      expect(dto.containerId).toBeNull();
    });
  });

  describe('toolOwnerId transform', () => {
    it('should transform empty string to null', () => {
      const dto = plainToInstance(UpdateNodeDto, { toolOwnerId: '' });
      expect(dto.toolOwnerId).toBeNull();
    });
  });

  describe('validation', () => {
    it('should pass when both IDs are null after empty string transform', async () => {
      const dto = plainToInstance(UpdateNodeDto, {
        containerId: '',
        toolOwnerId: '',
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.length).toBe(0);
    });
  });
});
