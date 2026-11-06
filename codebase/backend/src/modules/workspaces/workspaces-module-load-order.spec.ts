import 'reflect-metadata';

/**
 * 워크스페이스 · 사용자 · 인증 모듈의 import 순환이 파일 로드 순서와 상관없이 풀리는지 본다(CLE-T-KG01YT).
 *
 * WorkspacesModule 은 직접 추가 · 초대가 `UsersService.lookupByEmail` 을 쓰도록 UsersModule 을 import 한다.
 * 그래서 WorkspacesModule → UsersModule → AuthModule → { WorkspacesModule, WebAuthnModule → UsersModule } 로
 * 순환한다. 순환을 닫는 `imports` 자리가 `forwardRef` 가 아니면 먼저 로드된 파일이 아직 내보내지 않은 클래스를
 * 읽어 그 자리가 `undefined` 가 되고 Nest 부팅이 실패한다. 앱은 지금 AuthModule 을 먼저 로드해서 드러나지 않지만
 * import 순서 하나로 깨지므로 여기서 고정한다.
 */
const MODULE_FILES: Record<string, string> = {
  workspaces: './workspaces.module',
  users: '../users/users.module',
  auth: '../auth/auth.module',
};

/** 다른 파일을 먼저 로드한 뒤에 확인하는 모듈. WebAuthnModule 은 AuthModule 만 import 하므로 시작점에서 뺀다. */
const CHECKED_FILES: Record<string, string> = {
  ...MODULE_FILES,
  webauthn: '../auth/webauthn/webauthn.module',
};

function moduleClass(exports: Record<string, unknown>): object {
  const found = Object.values(exports).find(
    (value) =>
      typeof value === 'function' &&
      Reflect.getMetadata('imports', value) !== undefined,
  );
  if (!found) throw new Error('module class not found');
  return found as object;
}

describe('워크스페이스 · 사용자 · 인증 모듈 순환은 로드 순서와 상관없이 풀린다', () => {
  it.each(Object.keys(MODULE_FILES))(
    '%s 모듈 파일을 먼저 로드해도 imports 에 undefined 가 없다',
    (first) => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require(MODULE_FILES[first]);
        for (const [name, path] of Object.entries(CHECKED_FILES)) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const exports = require(path) as Record<string, unknown>;
          const imports = Reflect.getMetadata(
            'imports',
            moduleClass(exports),
          ) as unknown[];
          expect({ name, undefinedAt: imports.indexOf(undefined) }).toEqual({
            name,
            undefinedAt: -1,
          });
        }
      });
    },
  );
});
