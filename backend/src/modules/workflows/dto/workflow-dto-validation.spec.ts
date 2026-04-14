import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateWorkflowDto } from './create-workflow.dto';
import { UpdateWorkflowDto } from './update-workflow.dto';
import { SaveCanvasDto } from './save-canvas.dto';
import { NodeCategory } from '../../nodes/entities/node.entity';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALIDATE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

describe('CreateWorkflowDto', () => {
  describe('folderId transform', () => {
    it('should transform empty string to null', () => {
      const dto = plainToInstance(CreateWorkflowDto, {
        name: 'Test',
        folderId: '',
      });
      expect(dto.folderId).toBeNull();
    });

    it('should keep valid UUID unchanged', () => {
      const dto = plainToInstance(CreateWorkflowDto, {
        name: 'Test',
        folderId: VALID_UUID,
      });
      expect(dto.folderId).toBe(VALID_UUID);
    });

    it('should keep undefined as undefined', () => {
      const dto = plainToInstance(CreateWorkflowDto, { name: 'Test' });
      expect(dto.folderId).toBeUndefined();
    });

    it('should keep null as null', () => {
      const dto = plainToInstance(CreateWorkflowDto, {
        name: 'Test',
        folderId: null,
      });
      expect(dto.folderId).toBeNull();
    });
  });

  describe('validation', () => {
    it('should pass when folderId is null after empty string transform', async () => {
      const dto = plainToInstance(CreateWorkflowDto, {
        name: 'Test',
        folderId: '',
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.length).toBe(0);
    });

    it('should pass when folderId is a valid UUID', async () => {
      const dto = plainToInstance(CreateWorkflowDto, {
        name: 'Test',
        folderId: VALID_UUID,
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.length).toBe(0);
    });

    it('should fail when folderId is an invalid non-empty string', async () => {
      const dto = plainToInstance(CreateWorkflowDto, {
        name: 'Test',
        folderId: 'not-a-uuid',
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('folderId');
    });

    it('should pass when folderId is omitted', async () => {
      const dto = plainToInstance(CreateWorkflowDto, { name: 'Test' });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.length).toBe(0);
    });
  });
});

describe('UpdateWorkflowDto', () => {
  describe('folderId transform', () => {
    it('should transform empty string to null', () => {
      const dto = plainToInstance(UpdateWorkflowDto, { folderId: '' });
      expect(dto.folderId).toBeNull();
    });

    it('should keep valid UUID unchanged', () => {
      const dto = plainToInstance(UpdateWorkflowDto, { folderId: VALID_UUID });
      expect(dto.folderId).toBe(VALID_UUID);
    });
  });

  describe('validation', () => {
    it('should pass when folderId is null after empty string transform', async () => {
      const dto = plainToInstance(UpdateWorkflowDto, { folderId: '' });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.length).toBe(0);
    });
  });
});

describe('SaveCanvasDto.changeSummary', () => {
  const baseNode = {
    id: 'node-1',
    type: 'manual_trigger',
    category: NodeCategory.TRIGGER,
    label: 'Manual Trigger',
    positionX: 0,
    positionY: 0,
  };

  it('should accept omitted changeSummary', async () => {
    const dto = plainToInstance(SaveCanvasDto, {
      nodes: [baseNode],
      edges: [],
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.length).toBe(0);
  });

  it('should accept changeSummary up to 500 chars', async () => {
    const dto = plainToInstance(SaveCanvasDto, {
      nodes: [baseNode],
      edges: [],
      changeSummary: 'a'.repeat(500),
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.length).toBe(0);
  });

  it('should reject changeSummary over 500 chars', async () => {
    const dto = plainToInstance(SaveCanvasDto, {
      nodes: [baseNode],
      edges: [],
      changeSummary: 'a'.repeat(501),
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.some((e) => e.property === 'changeSummary')).toBe(true);
  });
});
