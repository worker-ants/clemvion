import { parseCsv } from './csv.parser';

describe('CsvParser', () => {
  it('should convert CSV rows to key-value text', () => {
    const csv = 'name,age,department\nAlice,30,Engineering\nBob,25,Marketing';
    const result = parseCsv(Buffer.from(csv));
    expect(result).toContain('name: Alice');
    expect(result).toContain('age: 30');
    expect(result).toContain('department: Engineering');
    expect(result).toContain('name: Bob');
  });

  it('should return empty string for empty CSV', () => {
    expect(parseCsv(Buffer.from(''))).toBe('');
  });

  it('should handle header-only CSV', () => {
    const csv = 'name,age';
    const result = parseCsv(Buffer.from(csv));
    expect(result).toBe('');
  });
});
