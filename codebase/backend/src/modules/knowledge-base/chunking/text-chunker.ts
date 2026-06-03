export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export interface ChunkMetadata {
  page?: number;
  section?: string;
}

export interface Chunk {
  content: string;
  index: number;
  tokenCount: number;
  metadata?: ChunkMetadata;
}

/**
 * Approximate token count (1 token ≈ 4 characters for English, ~2 for CJK)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/**
 * Split text into chunks using paragraph → sentence → forced split strategy.
 */
export function chunkText(text: string, options: ChunkOptions): Chunk[] {
  const { chunkSize, chunkOverlap } = options;

  if (!text.trim()) return [];

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  const chunks: Chunk[] = [];
  let currentChunk = '';
  let overlapBuffer = '';

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    if (paragraphTokens > chunkSize) {
      // Paragraph too large, split by sentences
      if (currentChunk.trim()) {
        pushChunk(chunks, currentChunk, overlapBuffer);
        overlapBuffer = getOverlapText(currentChunk, chunkOverlap);
        currentChunk = '';
      }

      const sentences = splitSentences(paragraph);
      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);
        if (sentenceTokens > chunkSize) {
          // Sentence too large, force split
          if (currentChunk.trim()) {
            pushChunk(chunks, currentChunk, overlapBuffer);
            overlapBuffer = getOverlapText(currentChunk, chunkOverlap);
            currentChunk = '';
          }
          forceSplitAndPush(chunks, sentence, chunkSize, chunkOverlap);
          overlapBuffer = '';
        } else if (estimateTokens(currentChunk + ' ' + sentence) > chunkSize) {
          pushChunk(chunks, currentChunk, overlapBuffer);
          overlapBuffer = getOverlapText(currentChunk, chunkOverlap);
          currentChunk = sentence;
        } else {
          currentChunk = currentChunk
            ? currentChunk + ' ' + sentence
            : sentence;
        }
      }
    } else if (estimateTokens(currentChunk + '\n\n' + paragraph) > chunkSize) {
      pushChunk(chunks, currentChunk, overlapBuffer);
      overlapBuffer = getOverlapText(currentChunk, chunkOverlap);
      currentChunk = paragraph;
    } else {
      currentChunk = currentChunk
        ? currentChunk + '\n\n' + paragraph
        : paragraph;
    }
  }

  if (currentChunk.trim()) {
    pushChunk(chunks, currentChunk, overlapBuffer);
  }

  return chunks;
}

function pushChunk(chunks: Chunk[], content: string, overlap: string): void {
  const text = overlap ? overlap + ' ' + content : content;
  chunks.push({
    content: text.trim(),
    index: chunks.length,
    tokenCount: estimateTokens(text),
    metadata: {},
  });
}

function getOverlapText(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0) return '';
  const chars = overlapTokens * 3;
  if (text.length <= chars) return text;
  return text.substring(text.length - chars);
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?。！？])\s+/).filter((s) => s.trim());
}

function forceSplitAndPush(
  chunks: Chunk[],
  text: string,
  chunkSize: number,
  chunkOverlap: number,
): void {
  const chars = chunkSize * 3;
  const overlapChars = chunkOverlap * 3;
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chars, text.length);
    const content = text.substring(start, end).trim();
    if (content) {
      chunks.push({
        content,
        index: chunks.length,
        tokenCount: estimateTokens(content),
        metadata: {},
      });
    }
    start = end - overlapChars;
    if (start >= text.length - overlapChars) break;
  }
  // Handle remaining
  if (start < text.length) {
    const remaining = text.substring(start).trim();
    if (remaining && remaining !== chunks[chunks.length - 1]?.content) {
      chunks.push({
        content: remaining,
        index: chunks.length,
        tokenCount: estimateTokens(remaining),
        metadata: {},
      });
    }
  }
}
