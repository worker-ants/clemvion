import { extractTriggerData } from './trigger-data.util';

describe('extractTriggerData', () => {
  it('extracts webhook transport (body/headers/query/method) from __triggerSource=webhook', () => {
    const data = extractTriggerData({
      __triggerSource: 'webhook',
      parameters: { userId: '1' },
      body: { event: 'push' },
      headers: { 'content-type': 'application/json' },
      query: { ref: 'main' },
      method: 'POST',
    });
    expect(data).toEqual({
      body: { event: 'push' },
      headers: { 'content-type': 'application/json' },
      query: { ref: 'main' },
      method: 'POST',
    });
    // parameters is NOT included ($params / $input.parameters exposes it).
    expect(data).not.toHaveProperty('parameters');
  });

  it('returns undefined for manual (__triggerSource=manual, only parameters)', () => {
    expect(
      extractTriggerData({ __triggerSource: 'manual', parameters: {} }),
    ).toBeUndefined();
  });

  it('returns undefined for schedule', () => {
    expect(
      extractTriggerData({ __triggerSource: 'schedule', parameters: {} }),
    ).toBeUndefined();
  });

  it('back-detects webhook when marker absent but transport fields present', () => {
    const data = extractTriggerData({ body: { x: 1 }, method: 'GET' });
    expect(data).toEqual({ body: { x: 1 }, method: 'GET' });
  });

  it('returns undefined for empty/non-object/array inputs', () => {
    expect(extractTriggerData(undefined)).toBeUndefined();
    expect(extractTriggerData(null)).toBeUndefined();
    expect(extractTriggerData('str')).toBeUndefined();
    expect(extractTriggerData([1, 2])).toBeUndefined();
    expect(extractTriggerData({})).toBeUndefined();
    expect(extractTriggerData({ parameters: {} })).toBeUndefined();
  });

  it('omits non-record headers/query and preserves body even when null', () => {
    const data = extractTriggerData({
      __triggerSource: 'webhook',
      body: null,
      headers: 'not-a-record',
      query: ['not', 'record'],
    });
    expect(data).toEqual({ body: null });
  });
});
