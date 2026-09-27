import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateNodeDto } from './create-node.dto';
import { UpdateNodeDto } from './update-node.dto';
import { contractForDto } from '../../../shared/testing/response-contract';

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

/**
 * `description` 는 null 을 받는다 — 선언과 동작 둘 다. swagger 가드(`swagger-dto-contract.spec.ts`)는 데코레이터와 TS 타입 중
 * **하나만** 되돌리면 잡지만, 둘을 함께 되돌리면 원래의 과소 광고(런타임은 null 을 받는데 OpenAPI 는 모른다)로 조용히 돌아간다.
 * 그 회귀를 여기서 잡는다. 동작(null 이 값을 지운다)은 `test/patch-partial-body.e2e-spec.ts` E 가 본다.
 */
describe('UpdateNodeDto.description — null 을 받는다', () => {
  it('검증기가 null 을 통과시킨다', async () => {
    const dto = plainToInstance(UpdateNodeDto, { description: null });
    expect(await validate(dto, VALIDATE_OPTIONS)).toHaveLength(0);
    expect(dto.description).toBeNull();
  });

  it('OpenAPI 가 nullable 로 광고한다', async () => {
    const { schema } = await contractForDto(UpdateNodeDto);
    expect(schema.properties?.description).toHaveProperty('nullable', true);
  });
});
