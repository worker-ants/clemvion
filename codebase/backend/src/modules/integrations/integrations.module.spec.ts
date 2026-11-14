import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';

/**
 * e2e 전용 훅 컨트롤러는 `isE2eTestHooksEnabled()` 가 참일 때만 모듈에 등록한다(CLE-T-184JJD). 판정은 모듈을 불러올 때
 * 한 번 하므로 환경 변수를 바꾼 뒤 모듈을 새로 불러와 컨트롤러 목록을 본다.
 */
describe('IntegrationsModule 컨트롤러 등록', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  function controllerNamesWith(env: Record<string, string | undefined>) {
    process.env = { ...savedEnv };
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    let names: string[] = [];
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { IntegrationsModule } = require('./integrations.module') as {
        IntegrationsModule: object;
      };
      const controllers = (Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        IntegrationsModule,
      ) ?? []) as Array<{ name: string }>;
      names = controllers.map((c) => c.name);
    });
    return names;
  }

  it('NODE_ENV=test · E2E_TEST_HOOKS=1 이면 훅 컨트롤러를 등록한다', () => {
    expect(
      controllerNamesWith({ NODE_ENV: 'test', E2E_TEST_HOOKS: '1' }),
    ).toContain('IntegrationsTestHooksController');
  });

  it.each([
    [
      'NODE_ENV 가 production 이면',
      { NODE_ENV: 'production', E2E_TEST_HOOKS: '1' },
    ],
    [
      'E2E_TEST_HOOKS 가 없으면',
      { NODE_ENV: 'test', E2E_TEST_HOOKS: undefined },
    ],
  ])('%s 훅 컨트롤러가 없고 일반 컨트롤러는 그대로다', (_label, env) => {
    const names = controllerNamesWith(env);
    expect(names).not.toContain('IntegrationsTestHooksController');
    expect(names).toEqual(
      expect.arrayContaining([
        'IntegrationsController',
        'ThirdPartyOAuthController',
      ]),
    );
  });
});
