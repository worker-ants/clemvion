/**
 * `secret://<scope>/<resourceId>/<name>` URI 파서 / 빌더.
 *
 * SoT: `spec/conventions/secret-store.md §1`.
 *
 *   scope      : lower-case kebab-case (`triggers`, `auth-configs`, ...).
 *   resourceId : UUID v4 또는 다른 spec 의 ID.
 *   name       : lower-case kebab-case + 점(`.`) 허용 (`bot-token`, `bot-token.v2`).
 */

const SECRET_URI_REGEX =
  /^secret:\/\/([a-z][a-z0-9-]*)\/([^/]+)\/([a-z0-9][a-z0-9.-]*)$/;

export interface SecretRefParts {
  scope: string;
  resourceId: string;
  name: string;
}

/** `secret://...` URI 파싱. 형식 위반 시 null. */
export function parseSecretRef(ref: string): SecretRefParts | null {
  const match = SECRET_URI_REGEX.exec(ref);
  if (!match) return null;
  return { scope: match[1], resourceId: match[2], name: match[3] };
}

/** parts → URI. application 호출자가 ref 합성 시 사용. */
export function buildSecretRef(parts: SecretRefParts): string {
  const ref = `secret://${parts.scope}/${parts.resourceId}/${parts.name}`;
  if (!SECRET_URI_REGEX.test(ref)) {
    throw new Error(
      `buildSecretRef: invalid parts (scope=${parts.scope}, resourceId=${parts.resourceId}, name=${parts.name})`,
    );
  }
  return ref;
}

/** `secret://...` 형식 여부 — DTO validation 용. */
export function isSecretRef(value: unknown): value is string {
  return typeof value === 'string' && SECRET_URI_REGEX.test(value);
}
