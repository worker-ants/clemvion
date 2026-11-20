/**
 * 테스트가 바꾼 `process.env` 를 원래 값으로 되돌리는 도우미(CLE-T-F4Z845).
 *
 * 규칙은 하나다. 바꾸기 전 값을 저장하고, 끝나면 그 값으로 되돌린다. 원래 없던 변수는 빈 문자열이 아니라 키째 지운다.
 * 그래야 테스트 순서나 바깥 환경 값(CI · 개발자 셸의 `ALLOW_PRIVATE_HOST_TARGETS` 등)에 따라 결과가 바뀌지 않는다.
 *
 * - 파일이나 describe 전체에서 변수를 바꾸면 `restoreEnvAfterEach` 를 쓴다.
 * - 바깥 환경 값과 상관없이 같은 값에서 시작해야 하면 `setEnvForEach` 를 쓴다.
 * - 테스트 하나에서만 바꾸면 `withEnv` 로 감싼다.
 */

/** 바꿀 값. `undefined` 는 그 변수를 지운다는 뜻이다. */
export type EnvPatch = Readonly<Record<string, string | undefined>>;

function applyEnv(
  entries: ReadonlyArray<readonly [string, string | undefined]>,
) {
  for (const [name, value] of entries) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

/** `names` 의 지금 값을 저장하고, 그 값으로 되돌리는 함수를 돌려준다. */
export function snapshotEnv(names: readonly string[]): () => void {
  const saved = names.map((name) => [name, process.env[name]] as const);
  return () => applyEnv(saved);
}

/**
 * 테스트마다 시작할 때 `names` 를 저장하고 끝나면 되돌린다. 등록한 블록(파일 최상위면 파일 전체)의 테스트에 걸린다.
 * 같은 블록의 다른 `beforeEach` 보다 먼저 등록하면 그 훅이 바꾼 값까지 되돌린다.
 */
export function restoreEnvAfterEach(...names: string[]): void {
  let restore: (() => void) | undefined;
  beforeEach(() => {
    restore = snapshotEnv(names);
  });
  afterEach(() => {
    restore?.();
    restore = undefined;
  });
}

/**
 * 테스트마다 시작할 때 `patch` 의 변수를 저장한 뒤 `patch` 값으로 맞추고, 끝나면 되돌린다.
 * 예: `setEnvForEach({ ALLOW_PRIVATE_HOST_TARGETS: undefined })` 는 바깥에서 플래그를 켜 두었어도 가드가 켜진 상태에서 시작한다.
 */
export function setEnvForEach(patch: EnvPatch): void {
  let restore: (() => void) | undefined;
  beforeEach(() => {
    restore = snapshotEnv(Object.keys(patch));
    applyEnv(Object.entries(patch));
  });
  afterEach(() => {
    restore?.();
    restore = undefined;
  });
}

/**
 * `patch` 를 적용한 채 `fn` 을 부르고 원래 값으로 되돌린다. `fn` 이 Promise 를 돌려주면 끝날 때까지 기다린 뒤 되돌린다.
 */
export function withEnv<T>(patch: EnvPatch, fn: () => T): T {
  const restore = snapshotEnv(Object.keys(patch));
  let result: T;
  try {
    applyEnv(Object.entries(patch));
    result = fn();
  } catch (err_) {
    restore();
    throw err_;
  }
  if (result instanceof Promise) {
    return result.finally(restore) as T;
  }
  restore();
  return result;
}
