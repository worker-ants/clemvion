import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateMeDto, USER_THEMES } from './update-me.dto';

describe('UpdateMeDto — theme (§2.0/§2.1 System 옵션)', () => {
  it('USER_THEMES 에 system 포함 (light/dark/system)', () => {
    expect([...USER_THEMES]).toEqual(['light', 'dark', 'system']);
  });

  const validateTheme = async (theme: unknown) => {
    const dto = plainToInstance(UpdateMeDto, { theme });
    return validate(dto);
  };

  it.each(['light', 'dark', 'system'])('theme=%s 는 검증 통과', async (t) => {
    const errors = await validateTheme(t);
    expect(errors).toHaveLength(0);
  });

  it('theme=invalid 는 IsIn 위반', async () => {
    const errors = await validateTheme('solarized');
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  it('theme 미지정(optional)은 통과', async () => {
    const errors = await validateTheme(undefined);
    expect(errors).toHaveLength(0);
  });
});
