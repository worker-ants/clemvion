import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PreviewLlmModelsDto } from './preview-llm-models.dto';

async function expectValidationError(
  payload: Record<string, unknown>,
  field: string,
) {
  const dto = plainToInstance(PreviewLlmModelsDto, payload);
  const errors = await validate(dto);
  const match = errors.find((e) => e.property === field);
  expect(match).toBeDefined();
}

async function expectNoErrors(payload: Record<string, unknown>) {
  const dto = plainToInstance(PreviewLlmModelsDto, payload);
  const errors = await validate(dto);
  expect(errors).toHaveLength(0);
}

describe('PreviewLlmModelsDto', () => {
  it('accepts minimal openai payload', async () => {
    await expectNoErrors({ provider: 'openai', apiKey: 'sk-xxx' });
  });

  it('accepts local provider with empty apiKey and baseUrl', async () => {
    await expectNoErrors({
      provider: 'local',
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
    });
  });

  it('rejects unknown provider', async () => {
    await expectValidationError(
      { provider: 'mystery', apiKey: 'k' },
      'provider',
    );
  });

  it('rejects missing provider', async () => {
    await expectValidationError({ apiKey: 'k' }, 'provider');
  });

  it('rejects missing apiKey field', async () => {
    await expectValidationError({ provider: 'openai' }, 'apiKey');
  });

  it('rejects baseUrl with a non-http(s) scheme (SSRF guard)', async () => {
    await expectValidationError(
      {
        provider: 'openai',
        apiKey: 'k',
        baseUrl: 'file:///etc/passwd',
      },
      'baseUrl',
    );
  });

  it('rejects baseUrl that is not a URL at all', async () => {
    await expectValidationError(
      { provider: 'openai', apiKey: 'k', baseUrl: 'not a url' },
      'baseUrl',
    );
  });

  it('rejects apiKey exceeding max length', async () => {
    await expectValidationError(
      { provider: 'openai', apiKey: 'x'.repeat(501) },
      'apiKey',
    );
  });

  it('rejects baseUrl exceeding max length', async () => {
    await expectValidationError(
      {
        provider: 'local',
        apiKey: '',
        baseUrl: 'http://' + 'a'.repeat(500),
      },
      'baseUrl',
    );
  });

  it('accepts openai with baseUrl override', async () => {
    await expectNoErrors({
      provider: 'openai',
      apiKey: 'sk-xxx',
      baseUrl: 'https://proxy.example.com/v1',
    });
  });

  it('requires baseUrl for azure provider', async () => {
    await expectValidationError({ provider: 'azure', apiKey: 'k' }, 'baseUrl');
  });

  it('requires baseUrl for local provider (even though apiKey is optional)', async () => {
    await expectValidationError({ provider: 'local', apiKey: '' }, 'baseUrl');
  });

  it('rejects empty-string baseUrl for azure provider', async () => {
    await expectValidationError(
      { provider: 'azure', apiKey: 'k', baseUrl: '' },
      'baseUrl',
    );
  });

  it('does not require baseUrl for openai/anthropic/google', async () => {
    await expectNoErrors({ provider: 'openai', apiKey: 'sk-xxx' });
    await expectNoErrors({ provider: 'anthropic', apiKey: 'sk-xxx' });
    await expectNoErrors({ provider: 'google', apiKey: 'sk-xxx' });
  });
});
