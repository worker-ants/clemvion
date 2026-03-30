import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTriggerDto } from './create-trigger.dto';
import { UpdateTriggerDto } from './update-trigger.dto';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALIDATE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

describe('CreateTriggerDto', () => {
  const baseTrigger = {
    workflowId: VALID_UUID,
    type: 'webhook',
    name: 'Test',
  };

  describe('authConfigId transform', () => {
    it('should transform empty string to null', () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseTrigger,
        authConfigId: '',
      });
      expect(dto.authConfigId).toBeNull();
    });

    it('should keep valid UUID unchanged', () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseTrigger,
        authConfigId: VALID_UUID,
      });
      expect(dto.authConfigId).toBe(VALID_UUID);
    });

    it('should keep null as null', () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseTrigger,
        authConfigId: null,
      });
      expect(dto.authConfigId).toBeNull();
    });
  });

  describe('validation', () => {
    it('should pass when authConfigId is null after empty string transform', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseTrigger,
        authConfigId: '',
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      const authError = errors.find((e) => e.property === 'authConfigId');
      expect(authError).toBeUndefined();
    });

    it('should fail when authConfigId is an invalid non-empty string', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseTrigger,
        authConfigId: 'not-a-uuid',
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'authConfigId')).toBeDefined();
    });
  });
});

describe('UpdateTriggerDto', () => {
  describe('authConfigId transform', () => {
    it('should transform empty string to null', () => {
      const dto = plainToInstance(UpdateTriggerDto, { authConfigId: '' });
      expect(dto.authConfigId).toBeNull();
    });
  });

  describe('validation', () => {
    it('should pass when authConfigId is null after empty string transform', async () => {
      const dto = plainToInstance(UpdateTriggerDto, { authConfigId: '' });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.length).toBe(0);
    });
  });
});
