/**
 * generate-golden-set.ts 순수 함수 단위 테스트 — W3 (SUMMARY#3 코드 리뷰 지적 사항).
 *
 * 대상: stableEntryId, parseQuestions, loadExisting(reviewed 보존 머지).
 * LlmService / NestFactory 는 관여하지 않음 — 순수 함수만 커버.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// jest mock fs 모듈 없이 임시 디렉터리 사용
import {
  GeneratedQuestion,
  loadExisting,
  parseQuestions,
  stableEntryId,
} from './generate-golden-set';

// ─────────────────────────────────────────────────────────
// stableEntryId
// ─────────────────────────────────────────────────────────
describe('stableEntryId', () => {
  it('동일 입력은 항상 동일 id 반환 (안정성)', () => {
    const id1 = stableEntryId('kb-1', 'chunk-1', 'What is RAG?');
    const id2 = stableEntryId('kb-1', 'chunk-1', 'What is RAG?');
    expect(id1).toBe(id2);
  });

  it('서로 다른 질문은 서로 다른 id 반환', () => {
    const id1 = stableEntryId('kb-1', 'chunk-1', 'Question A');
    const id2 = stableEntryId('kb-1', 'chunk-1', 'Question B');
    expect(id1).not.toBe(id2);
  });

  it('질문 공백 정규화 — 앞뒤 공백·중복 공백은 같은 id', () => {
    const id1 = stableEntryId('kb-1', 'c1', 'What  is   RAG?');
    const id2 = stableEntryId('kb-1', 'c1', 'What is RAG?');
    expect(id1).toBe(id2);
  });

  it('16자 hex 문자열 반환', () => {
    const id = stableEntryId('kb-1', 'c1', 'test question');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('kbId 가 다르면 다른 id', () => {
    const id1 = stableEntryId('kb-A', 'c1', 'q');
    const id2 = stableEntryId('kb-B', 'c1', 'q');
    expect(id1).not.toBe(id2);
  });
});

// ─────────────────────────────────────────────────────────
// parseQuestions
// ─────────────────────────────────────────────────────────
describe('parseQuestions', () => {
  it('유효한 JSON 에서 질문 목록 파싱', () => {
    const raw = JSON.stringify({
      questions: [
        { question: 'What is A?', answer: 'A is ...' },
        { question: 'What is B?', answer: 'B is ...' },
      ],
    });
    const result: GeneratedQuestion[] = parseQuestions(raw);
    expect(result).toHaveLength(2);
    expect(result[0].question).toBe('What is A?');
    expect(result[1].answer).toBe('B is ...');
  });

  it('null 입력은 빈 배열 반환', () => {
    expect(parseQuestions(null)).toEqual([]);
  });

  it('잘못된 JSON 은 빈 배열 반환', () => {
    expect(parseQuestions('not-json')).toEqual([]);
  });

  it('questions 배열 없는 JSON 은 빈 배열 반환', () => {
    expect(parseQuestions(JSON.stringify({ other: [] }))).toEqual([]);
  });

  it('빈 question 문자열은 필터링', () => {
    const raw = JSON.stringify({
      questions: [
        { question: '  ', answer: 'a' },
        { question: 'Valid?', answer: 'yes' },
      ],
    });
    const result = parseQuestions(raw);
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('Valid?');
  });

  it('answer 미존재 시 빈 문자열로 보정', () => {
    const raw = JSON.stringify({
      questions: [{ question: 'Q?', answer: null }],
    });
    const result = parseQuestions(raw);
    expect(result[0].answer).toBe('');
  });
});

// ─────────────────────────────────────────────────────────
// loadExisting — reviewed:true 보존 머지
// ─────────────────────────────────────────────────────────
describe('loadExisting', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-eval-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('파일 없으면 빈 GoldenSet 반환', () => {
    const result = loadExisting(path.join(tmpDir, 'nonexistent.json'));
    expect(result).toEqual({ meta: { version: 1 }, entries: [] });
  });

  it('유효한 골든셋 JSON 파일에서 entries 로드', () => {
    const golden = {
      meta: { version: 1, description: 'test' },
      entries: [
        {
          id: 'abc',
          query: 'q',
          language: 'ko',
          knowledgeBaseId: 'kb1',
          goldChunkIds: ['c1'],
          shouldRetrieve: true,
          source: 'synthetic',
          reviewed: true,
          difficulty: 'single',
        },
      ],
    };
    const filePath = path.join(tmpDir, 'golden.json');
    fs.writeFileSync(filePath, JSON.stringify(golden), 'utf8');

    const result = loadExisting(filePath);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].reviewed).toBe(true);
    // description 보존 확인
    expect((result.meta as { description?: string }).description).toBe('test');
  });

  it('파손된 JSON 은 빈 GoldenSet 반환', () => {
    const filePath = path.join(tmpDir, 'corrupt.json');
    fs.writeFileSync(filePath, '{ broken json', 'utf8');
    const result = loadExisting(filePath);
    expect(result).toEqual({ meta: { version: 1 }, entries: [] });
  });

  it('entries 필드 없는 JSON 은 빈 entries 반환', () => {
    const filePath = path.join(tmpDir, 'noentries.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({ meta: { version: 1 } }),
      'utf8',
    );
    const result = loadExisting(filePath);
    expect(result.entries).toEqual([]);
  });
});
