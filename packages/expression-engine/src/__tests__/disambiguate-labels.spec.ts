import { buildDisambiguatedKeys } from '../disambiguate-labels';

describe('buildDisambiguatedKeys', () => {
  it('should return label as-is when all labels are unique', () => {
    const entries = [
      { id: 'a', label: 'HTTP Request' },
      { id: 'b', label: 'If/Else' },
      { id: 'c', label: 'Code' },
    ];
    const result = buildDisambiguatedKeys(entries);
    expect(result.get('a')).toBe('HTTP Request');
    expect(result.get('b')).toBe('If/Else');
    expect(result.get('c')).toBe('Code');
  });

  it('should disambiguate duplicate labels with #N suffix', () => {
    const entries = [
      { id: 'a', label: 'HTTP Request' },
      { id: 'b', label: 'HTTP Request' },
      { id: 'c', label: 'HTTP Request' },
    ];
    const result = buildDisambiguatedKeys(entries);
    expect(result.get('a')).toBe('HTTP Request');
    expect(result.get('b')).toBe('HTTP Request#2');
    expect(result.get('c')).toBe('HTTP Request#3');
  });

  it('should only disambiguate duplicated labels, leaving unique ones unchanged', () => {
    const entries = [
      { id: 'a', label: 'HTTP Request' },
      { id: 'b', label: 'If/Else' },
      { id: 'c', label: 'HTTP Request' },
    ];
    const result = buildDisambiguatedKeys(entries);
    expect(result.get('a')).toBe('HTTP Request');
    expect(result.get('b')).toBe('If/Else');
    expect(result.get('c')).toBe('HTTP Request#2');
  });

  it('should handle empty entries', () => {
    const result = buildDisambiguatedKeys([]);
    expect(result.size).toBe(0);
  });

  it('should handle single entry', () => {
    const entries = [{ id: 'a', label: 'Code' }];
    const result = buildDisambiguatedKeys(entries);
    expect(result.get('a')).toBe('Code');
  });

  it('should handle multiple groups of duplicates', () => {
    const entries = [
      { id: 'a', label: 'HTTP Request' },
      { id: 'b', label: 'Code' },
      { id: 'c', label: 'HTTP Request' },
      { id: 'd', label: 'Code' },
    ];
    const result = buildDisambiguatedKeys(entries);
    expect(result.get('a')).toBe('HTTP Request');
    expect(result.get('b')).toBe('Code');
    expect(result.get('c')).toBe('HTTP Request#2');
    expect(result.get('d')).toBe('Code#2');
  });

  it('should preserve insertion order for disambiguation numbering', () => {
    const entries = [
      { id: 'z', label: 'Loop' },
      { id: 'a', label: 'Loop' },
      { id: 'm', label: 'Loop' },
    ];
    const result = buildDisambiguatedKeys(entries);
    // First occurrence keeps original label, subsequent get #2, #3
    expect(result.get('z')).toBe('Loop');
    expect(result.get('a')).toBe('Loop#2');
    expect(result.get('m')).toBe('Loop#3');
  });
});
