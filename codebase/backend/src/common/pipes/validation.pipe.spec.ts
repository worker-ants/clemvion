import { BadRequestException } from '@nestjs/common';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomValidationPipe } from './validation.pipe';

class InnerDto {
  @IsString()
  @IsIn(['apple', 'banana'])
  fruit: string;
}

class OuterDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InnerDto)
  items: InnerDto[];
}

describe('CustomValidationPipe', () => {
  const pipe = new CustomValidationPipe();
  const meta = { metatype: OuterDto, type: 'body' as const };

  it('returns the transformed instance when validation passes', async () => {
    const result = await pipe.transform(
      { name: 'ok', items: [{ fruit: 'apple' }] },
      meta,
    );
    expect(result).toBeInstanceOf(OuterDto);
  });

  it('emits path-qualified details for nested array errors', async () => {
    try {
      await pipe.transform(
        { name: 'ok', items: [{ fruit: 'apple' }, { fruit: 'cherry' }] },
        meta,
      );
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        code: string;
        details: { field: string; message: string; code: string }[];
      };
      expect(body.code).toBe('VALIDATION_ERROR');
      const leaf = body.details.find((d) => d.field.includes('items[1].fruit'));
      expect(leaf).toBeDefined();
      expect(leaf!.message).not.toBe('');
      expect(leaf!.message).toMatch(/must be one of/i);
      expect(leaf!.code).toBe('INVALID_FIELD');
    }
  });

  it('emits details for a top-level field error', async () => {
    try {
      await pipe.transform({ name: 123, items: [{ fruit: 'apple' }] }, meta);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        details: { field: string; message: string }[];
      };
      const detail = body.details.find((d) => d.field === 'name');
      expect(detail).toBeDefined();
      expect(detail!.message).not.toBe('');
    }
  });
});

/**
 * `forbidNonWhitelisted` — unknown keys are REJECTED, not silently stripped.
 *
 * The pipe runs with `whitelist: true` + `forbidNonWhitelisted: true`, so a key that the
 * DTO does not declare produces a 400 rather than being quietly dropped. Nothing asserted
 * that axis before.
 *
 * What it lets slip without this: the fact that **removing a field from a DTO is itself a
 * public contract change.** `QueryExecutionDto.workflowId` (a dead parameter) was removed
 * on 2026-09-04, and from that moment a request carrying `?workflowId=…` went from `200`
 * (ignored) to `400`. No automated test pinned that behaviour.
 *
 * Tracking: `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속.
 */
describe('CustomValidationPipe — forbidNonWhitelisted', () => {
  const pipe = new CustomValidationPipe();

  class NarrowDto {
    @IsString()
    known: string;
  }

  const narrowMeta = { metatype: NarrowDto, type: 'query' as const };

  it('rejects a key the DTO does not declare', async () => {
    try {
      await pipe.transform(
        { known: 'ok', removedParam: 'anything' },
        narrowMeta,
      );
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        code: string;
      };
      expect(body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('accepts declared keys only — proves the assertion above is not vacuous', async () => {
    const result = await pipe.transform({ known: 'ok' }, narrowMeta);
    expect(result).toBeInstanceOf(NarrowDto);
  });
});
