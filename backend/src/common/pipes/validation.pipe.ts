import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

interface ValidationDetail {
  field: string;
  message: string;
  code: 'INVALID_FIELD';
}

@Injectable()
export class CustomValidationPipe implements PipeTransform<unknown> {
  async transform(
    value: unknown,
    { metatype }: ArgumentMetadata,
  ): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(
      metatype,
      value as Record<string, unknown>,
    ) as object;
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      const details = this.flattenErrors(errors);
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details,
      });
    }
    return object;
  }

  /**
   * Recursively walks `ValidateNested` error trees and returns one entry per
   * leaf constraint. Path segments keep array indices (`nodes[3].type`) so the
   * caller can identify exactly which item failed.
   */
  private flattenErrors(
    errors: ValidationError[],
    parentPath = '',
  ): ValidationDetail[] {
    const out: ValidationDetail[] = [];
    for (const error of errors) {
      const segment = this.joinPath(parentPath, error.property);
      if (error.constraints) {
        for (const message of Object.values(error.constraints)) {
          out.push({ field: segment, message, code: 'INVALID_FIELD' });
        }
      }
      if (error.children && error.children.length > 0) {
        out.push(...this.flattenErrors(error.children, segment));
      }
    }
    return out;
  }

  private joinPath(parent: string, property: string): string {
    if (!parent) return property;
    return /^\d+$/.test(property)
      ? `${parent}[${property}]`
      : `${parent}.${property}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private toValidate(metatype: Function): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
