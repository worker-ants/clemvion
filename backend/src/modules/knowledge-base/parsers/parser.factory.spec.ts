// Mock pdf-parse to avoid SIGSEGV from native module loading
jest.mock('pdf-parse', () => {
  return jest.fn().mockResolvedValue({ text: 'mocked pdf content' });
});

import { parseDocument } from './parser.factory';

describe('parseDocument', () => {
  it('should parse txt content', async () => {
    const buffer = Buffer.from('Hello, plain text!');
    const result = await parseDocument(buffer, 'txt');
    expect(result).toBe('Hello, plain text!');
  });

  it('should parse md content', async () => {
    const buffer = Buffer.from('# Heading\n\nSome **bold** text.');
    const result = await parseDocument(buffer, 'md');
    expect(result).toBe('# Heading\n\nSome **bold** text.');
  });

  it('should parse csv and convert rows to key-value pairs', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const buffer = Buffer.from(csv);
    const result = await parseDocument(buffer, 'csv');
    expect(result).toContain('name: Alice');
    expect(result).toContain('age: 30');
    expect(result).toContain('name: Bob');
    expect(result).toContain('age: 25');
  });

  it('should throw for unsupported file type', async () => {
    const buffer = Buffer.from('data');
    await expect(parseDocument(buffer, 'exe')).rejects.toThrow(
      'Unsupported file type: exe',
    );
  });
});
