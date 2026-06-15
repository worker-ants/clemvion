import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Address4, Address6 } from 'ip-address';

/**
 * 단일 IP(IPv4/IPv6) 또는 CIDR 표기 문자열인지 검증한다.
 *
 * class-validator 의 `@IsIP` 는 CIDR(`10.0.0.0/8`, `2001:db8::/32`)을 거부하므로
 * ip_whitelist 형식(단일 IP 또는 CIDR — spec/1-data-model.md §2.17,
 * spec/5-system/12-webhook.md WH-SC-09)을 그대로 검증할 수 없다. 본 validator 는
 * `AuthConfigsService.parseIp` 와 **동일한 ip-address 수용 기준**(`Address4.isValid`
 * `|| Address6.isValid`)을 사용해, 저장 시점 검증과 런타임 ip_whitelist 평가 사이의
 * drift 를 제거한다 (DTO 가 통과시킨 값은 런타임이 항상 파싱 가능).
 */
export function isIpOrCidr(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    return Address4.isValid(value) || Address6.isValid(value);
  } catch {
    return false;
  }
}

/** `@IsIpOrCidr` 데코레이터의 검증 제약 — 항목이 단일 IP 또는 CIDR 인지 판정. */
@ValidatorConstraint({ name: 'isIpOrCidr', async: false })
export class IsIpOrCidrConstraint implements ValidatorConstraintInterface {
  // Stateless — instance field 회피 (class-validator singleton 패턴의 race 회피).
  validate(value: unknown): boolean {
    // `{ each: true }` 시 class-validator 가 배열 항목별로 본 메서드를 호출한다.
    return isIpOrCidr(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} 의 각 항목은 유효한 IP 주소 또는 CIDR 표기여야 합니다`;
  }
}

/**
 * 단일 IP 또는 CIDR 표기를 검증하는 property 데코레이터.
 * 배열 필드에는 `@IsIpOrCidr({ each: true })` 로 항목별 검증한다.
 */
export function IsIpOrCidr(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIpOrCidr',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsIpOrCidrConstraint,
    });
  };
}
