import {
  assertDocumentIdPayload,
  InvalidJobPayloadError,
} from './job-payload.util';

describe('assertDocumentIdPayload', () => {
  const baseJob = {
    id: 'job-1',
    name: 'embed',
    timestamp: 1_700_000_000_000,
    attemptsMade: 0,
  };

  it('returns documentId when payload is a non-empty string', () => {
    expect(
      assertDocumentIdPayload(
        { ...baseJob, data: { documentId: 'd-uuid-1' } } as never,
        'Ctx',
      ),
    ).toBe('d-uuid-1');
  });

  it.each([
    ['undefined', {}],
    ['null', { documentId: null }],
    ['empty string', { documentId: '' }],
    ['whitespace only', { documentId: '   ' }],
    ['number', { documentId: 42 }],
    ['object', { documentId: { id: 'x' } }],
  ])('throws InvalidJobPayloadError when documentId is %s', (_label, data) => {
    expect(() =>
      assertDocumentIdPayload({ ...baseJob, data } as never, 'Ctx'),
    ).toThrow(InvalidJobPayloadError);
  });

  it('attaches diagnostic debug context to the error', () => {
    let captured: unknown;
    try {
      assertDocumentIdPayload(
        { ...baseJob, data: { foo: 'bar' } } as never,
        'EmbeddingCtx',
      );
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(InvalidJobPayloadError);
    const error = captured as InvalidJobPayloadError;
    expect(error.message).toMatch(/EmbeddingCtx: documentId is missing/);
    expect(error.reason).toMatch(/documentId is missing/);
    expect(error.debug).toMatchObject({
      jobId: 'job-1',
      jobName: 'embed',
      timestamp: 1_700_000_000_000,
      attemptsMade: 0,
      payloadKeys: ['foo'],
      documentIdType: 'undefined',
    });
  });

  it('reports documentIdType correctly for non-string types', () => {
    let captured: unknown;
    try {
      assertDocumentIdPayload(
        { ...baseJob, data: { documentId: 42 } } as never,
        'Ctx',
      );
    } catch (err) {
      captured = err;
    }
    expect((captured as InvalidJobPayloadError).debug.documentIdType).toBe(
      'number',
    );
  });
});
