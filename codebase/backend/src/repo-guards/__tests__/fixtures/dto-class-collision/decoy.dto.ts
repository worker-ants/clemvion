// 대조군 fixture — **정규식이었다면 속았을** 자리를 모아 둔다.
// 선언이 아닌 `export class` 출현 셋 + 진짜 선언 하나.

// export class CommentedOutDto {}

const SNIPPET = 'export class StringLiteralDto {}';

/**
 * JSDoc 예제:
 * ```ts
 * export class DocExampleDto {}
 * ```
 */
export class RealDecoyDto {
  snippet = SNIPPET;
}

class NotExportedDto {
  hidden = true;
}

export const KEEP_REFERENCED = new NotExportedDto();
