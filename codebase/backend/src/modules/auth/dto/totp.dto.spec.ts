import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Disable2faDto, Setup2faDto } from './totp.dto';

/** TOTP 설정 시작은 비밀번호를 다시 받는다(NERV CLE-ACCT-SIGNIN, CLE-T-94FTMV). 규칙은 2FA 해제의 비밀번호와 같다. */
describe('Setup2faDto', () => {
  const fieldsWithErrors = async (body: object): Promise<string[]> => {
    const errors = await validate(plainToInstance(Setup2faDto, body));
    return errors.map((e) => e.property);
  };

  it('비밀번호가 있으면 통과한다', async () => {
    expect(await fieldsWithErrors({ password: 'P@ssw0rd!1' })).toEqual([]);
  });

  it.each([{}, { password: '' }, { password: 'short' }])(
    '%j 는 password 위반으로 거부한다',
    async (body) => {
      expect(await fieldsWithErrors(body)).toEqual(['password']);
    },
  );
});

/**
 * 2FA 해제는 비밀번호와 코드를 함께 받는다(NERV CLE-ACCT-SIGNIN, CLE-T-75TDTN). 코드 형식은
 * 로그인 2단계(`LoginTotpDto.code`)와 같아 6자리 TOTP 와 복구 코드(`xxxx-xxxx-xxxx`)를 모두 받는다.
 */
describe('Disable2faDto', () => {
  const fieldsWithErrors = async (body: object): Promise<string[]> => {
    const errors = await validate(plainToInstance(Disable2faDto, body));
    return errors.map((e) => e.property);
  };

  it.each(['123456', 'abcd-efgh-ijkl'])('code=%s 는 통과한다', async (code) => {
    expect(await fieldsWithErrors({ password: 'P@ssw0rd!1', code })).toEqual(
      [],
    );
  });

  it('code 가 없으면 거부한다', async () => {
    expect(await fieldsWithErrors({ password: 'P@ssw0rd!1' })).toEqual([
      'code',
    ]);
  });

  it.each(['', '12345', 'x'.repeat(33)])(
    'code=%j 는 길이 위반으로 거부한다',
    async (code) => {
      expect(await fieldsWithErrors({ password: 'P@ssw0rd!1', code })).toEqual([
        'code',
      ]);
    },
  );

  it('password 가 없으면 거부한다', async () => {
    expect(await fieldsWithErrors({ code: '123456' })).toEqual(['password']);
  });
});
