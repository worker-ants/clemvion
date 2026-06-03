import type { Chunk, ChunkOptions } from './text-chunker';

/**
 * Approximate token count (1 token ≈ 3 characters).
 * Kept in sync with text-chunker's estimateTokens.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/**
 * CSV row-aware chunker (spec/5-system/8-embedding-pipeline.md §4.3).
 *
 * `csv.parser.ts` 가 각 행을 `"name: …, age: …"` 텍스트로 변환한 뒤 `\n` 으로
 * join 한 단일 문자열을 반환한다. 공통 `chunkText()` 는 `\n\n+`(단락) 기준 분할이라
 * 행 중간에서 잘릴 수 있다. 본 청커는 `\n` 으로 행을 복원해 행을 **통째로** chunk_size
 * 한도까지 결합하며, 절대 행 중간에서 분할하지 않는다.
 *
 * - 행 단위로 청크 구성
 * - chunk_size 내에서 여러 행을 하나의 청크로 결합
 * - 행 중간에서 분할하지 않음 (한 행이 chunk_size 를 초과해도 그 행 단독으로 한 청크)
 */
export function chunkCsv(text: string, options: ChunkOptions): Chunk[] {
  const { chunkSize } = options;

  if (!text.trim()) return [];

  const rows = text.split('\n').filter((row) => row.trim());

  const chunks: Chunk[] = [];
  let current: string[] = [];

  const flush = (): void => {
    if (current.length === 0) return;
    const content = current.join('\n');
    chunks.push({
      content,
      index: chunks.length,
      tokenCount: estimateTokens(content),
      metadata: {},
    });
    current = [];
  };

  for (const row of rows) {
    if (current.length === 0) {
      current.push(row);
      continue;
    }
    const candidate = [...current, row].join('\n');
    if (estimateTokens(candidate) > chunkSize) {
      // 현재 행을 더하면 한도를 넘는다 → 지금까지의 행을 한 청크로 확정하고 새 청크 시작.
      flush();
      current.push(row);
    } else {
      current.push(row);
    }
  }
  flush();

  return chunks;
}
