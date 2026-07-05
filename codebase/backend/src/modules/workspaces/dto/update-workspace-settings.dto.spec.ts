import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateWorkspaceSettingsDto } from './update-workspace-settings.dto';

/**
 * 전역 CustomValidationPipe(whitelist)가 실제로 실행하는 class-validator 검증을 DTO 단위로 재현.
 * frontend 의 partial-patch(예: WorkspaceTimezoneCard 가 `{ timezone }` 만 전송)가 통과해야 함을 고정한다.
 */
describe('UpdateWorkspaceSettingsDto validation', () => {
  it('§2.2 timezone 단독 payload 는 검증을 통과한다 (interactionAllowedOrigins 는 optional)', async () => {
    const dto = plainToInstance(UpdateWorkspaceSettingsDto, {
      timezone: 'Asia/Seoul',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('interactionAllowedOrigins 단독 payload 도 통과한다', async () => {
    const dto = plainToInstance(UpdateWorkspaceSettingsDto, {
      interactionAllowedOrigins: ['https://example.com'],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('빈 payload({}) 도 통과한다 (모든 키 optional)', async () => {
    const dto = plainToInstance(UpdateWorkspaceSettingsDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('잘못된 origin 형식(path 포함)은 여전히 거부된다', async () => {
    const dto = plainToInstance(UpdateWorkspaceSettingsDto, {
      interactionAllowedOrigins: ['https://example.com/path'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
