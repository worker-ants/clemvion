import { validate, ValidationArguments } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAuthConfigDto } from './create-auth-config.dto';
import { UpdateAuthConfigDto } from './update-auth-config.dto';
import { IsIpOrCidrConstraint, isIpOrCidr } from './is-ip-or-cidr.validator';

/**
 * ip_whitelist 저장 시점 형식 검증 (spec/1-data-model.md §2.17,
 * spec/5-system/12-webhook.md WH-SC-09). 단일 IP(IPv4/IPv6) 또는 CIDR 만 허용하며
 * 무효 항목은 400 으로 거부 — 런타임 ip_whitelist 평가(AuthConfigsService.parseIp)와
 * 동일한 ip-address 수용 기준.
 */
describe('isIpOrCidr (저수준 검증 함수)', () => {
  it.each([
    '10.0.0.42',
    '203.0.113.42',
    '2001:db8::1',
    '::1',
    '10.0.0.0/8',
    '192.168.0.0/16',
    '0.0.0.0/0', // 전체 허용 CIDR (프론트엔드 검증과 동일 수용)
    '2001:db8::/32',
    '2001:db8::/128', // IPv6 호스트 CIDR 경계
    '::ffff:192.0.2.1', // IPv4-mapped IPv6
  ])('유효: %s → true', (value) => {
    expect(isIpOrCidr(value)).toBe(true);
  });

  it.each([
    'invalid',
    '999.999.999.999',
    '192.0.2.0/33', // IPv4 prefix 범위 초과
    '2001:db8::/129', // IPv6 prefix 범위 초과
    '10.0.0.1 ', // 후행 공백
    ' 10.0.0.1',
    '',
    'example.com',
  ])('무효: %s → false', (value) => {
    expect(isIpOrCidr(value)).toBe(false);
  });

  it.each([null, undefined, 42, {}, []])('비-문자열 %s → false', (value) => {
    expect(isIpOrCidr(value)).toBe(false);
  });
});

describe('CreateAuthConfigDto — ipWhitelist @IsIpOrCidr', () => {
  const base = { name: 'wh', type: 'api_key' as const };
  const validateWhitelist = async (ipWhitelist: unknown) =>
    validate(plainToInstance(CreateAuthConfigDto, { ...base, ipWhitelist }));

  it('유효한 단일 IP·CIDR·IPv6 혼합 → 통과', async () => {
    const errors = await validateWhitelist([
      '10.0.0.0/8',
      '203.0.113.42',
      '2001:db8::/32',
    ]);
    expect(errors).toHaveLength(0);
  });

  it('무효 IP 항목 포함 → isIpOrCidr 위반', async () => {
    const errors = await validateWhitelist(['10.0.0.1', '999.999.999.999']);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('ipWhitelist');
    expect(errors[0].constraints).toHaveProperty('isIpOrCidr');
  });

  it('CIDR prefix 범위 초과 → 위반', async () => {
    const errors = await validateWhitelist(['192.0.2.0/33']);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isIpOrCidr');
  });

  it('ipWhitelist 미지정(optional) → 통과', async () => {
    const errors = await validateWhitelist(undefined);
    expect(errors).toHaveLength(0);
  });

  it('빈 배열 → 통과 (each 검증 대상 없음)', async () => {
    const errors = await validateWhitelist([]);
    expect(errors).toHaveLength(0);
  });

  it('배열 대신 단일 문자열 → @IsArray 위반', async () => {
    const errors = await validateWhitelist('10.0.0.1');
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('ipWhitelist');
    expect(errors[0].constraints).toHaveProperty('isArray');
  });
});

describe('IsIpOrCidrConstraint.defaultMessage', () => {
  it('위반 항목명을 포함한 메시지를 반환', () => {
    const c = new IsIpOrCidrConstraint();
    const msg = c.defaultMessage({
      property: 'ipWhitelist',
    } as unknown as ValidationArguments);
    expect(msg).toContain('ipWhitelist');
  });
});

describe('UpdateAuthConfigDto — ipWhitelist @IsIpOrCidr', () => {
  const validateWhitelist = async (ipWhitelist: unknown) =>
    validate(plainToInstance(UpdateAuthConfigDto, { ipWhitelist }));

  it('유효한 IP/CIDR → 통과', async () => {
    const errors = await validateWhitelist(['10.0.0.0/8', '2001:db8::1']);
    expect(errors).toHaveLength(0);
  });

  it('무효 항목 → isIpOrCidr 위반', async () => {
    const errors = await validateWhitelist(['not-an-ip']);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isIpOrCidr');
  });

  it('빈 배열(전체 삭제 의도) → 통과', async () => {
    const errors = await validateWhitelist([]);
    expect(errors).toHaveLength(0);
  });
});
