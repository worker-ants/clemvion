/**
 * 로그에 남길 오류 문구. `Error` 면 `message` 를, 아니면 `String(err)` 를 준다. 스택은 담지 않는다.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
