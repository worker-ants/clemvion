import type { Chunk, ChunkOptions } from './text-chunker';
import { estimateTokens } from './text-chunker';

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
 *
 * estimateTokens 는 text-chunker 에서 단일 소스로 import 한다 (SUMMARY#W6 — 수동
 * 동기화 제거).
 *
 * 토큰 집계는 `currentTokenCount` 변수로 점진적 추적 — 매 반복마다 배열을 join 해
 * estimateTokens 를 재호출하던 O(n·k) 오버헤드 제거 (SUMMARY#W12).
 */
export function chunkCsv(text: string, options: ChunkOptions): Chunk[] {
  const { chunkSize } = options;

  if (!text.trim()) return [];

  const rows = text.split('\n').filter((row) => row.trim());

  const chunks: Chunk[] = [];
  let current: string[] = [];
  // 현재 버퍼의 누적 토큰 수. 행 추가 시 `estimateTokens(row)` 만 더하고,
  // 행 사이 '\n' 구분자(1 byte ≈ 0 tokens, ceil 오차 내)는 무시한다.
  // 실제 content 의 estimateTokens 와 ±rows.length 토큰 차이가 생기지만
  // chunkSize 의 용도가 "근사 상한"이므로 허용 범위다.
  let currentTokenCount = 0;

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
    currentTokenCount = 0;
  };

  for (const row of rows) {
    const rowTokens = estimateTokens(row);
    if (current.length === 0) {
      current.push(row);
      currentTokenCount = rowTokens;
      continue;
    }
    // 현재 행을 추가했을 때 한도를 초과하면 flush 후 새 청크로 시작.
    if (currentTokenCount + rowTokens > chunkSize) {
      flush();
      current.push(row);
      currentTokenCount = rowTokens;
    } else {
      current.push(row);
      currentTokenCount += rowTokens;
    }
  }
  flush();

  return chunks;
}
