import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MAX_PASSWORD_RECHECK_INPUT_LENGTH,
  MIN_ACCOUNT_PASSWORD_LENGTH,
} from '../../../common/utils/password.util';
import { PasswordRecheckDto } from './password-recheck.dto';

/** 재확인 본문의 공개 계약: 문자열이고 길이는 8~128 자다(NERV Task `CLE-T-CJ7HB1`). */
describe('PasswordRecheckDto', () => {
  const errorsFor = (password: unknown) =>
    validate(plainToInstance(PasswordRecheckDto, { password }));

  it.each([
    ['최소 길이', 'a'.repeat(MIN_ACCOUNT_PASSWORD_LENGTH)],
    ['최대 길이', 'a'.repeat(MAX_PASSWORD_RECHECK_INPUT_LENGTH)],
  ])('%s 는 통과한다', async (_label, password) => {
    await expect(errorsFor(password)).resolves.toHaveLength(0);
  });

  it.each([
    ['최소보다 1자 짧으면', 'a'.repeat(MIN_ACCOUNT_PASSWORD_LENGTH - 1)],
    ['최대보다 1자 길면', 'a'.repeat(MAX_PASSWORD_RECHECK_INPUT_LENGTH + 1)],
    ['문자열이 아니면', 12345678],
    ['없으면', undefined],
  ])('%s 거부한다', async (_label, password) => {
    await expect(errorsFor(password)).resolves.not.toHaveLength(0);
  });
});
