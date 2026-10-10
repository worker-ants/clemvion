import { isAbortErrorLike } from '../../nodes/integration/_base/abort-cascade.util';
import { isAbortError } from './execution-engine.service';

// The integration nodes (HTTP Request · Cafe24 · MakeShop) and the engine each
// decide whether an error is an AbortError. They stay separate so node modules
// do not import the execution-engine module. If one rule changed alone, a node
// would rethrow an error that the engine then records as `failed` instead of
// `cancelled`, or the other way round. This pins both to the same verdicts.
describe('isAbortErrorLike and the engine isAbortError', () => {
  const named = (name: unknown): Error => {
    const err = new Error('boom');
    (err as { name: unknown }).name = name;
    return err;
  };

  const aborts: Array<[string, unknown]> = [
    ['an Error named AbortError', named('AbortError')],
    ['a DOMException AbortError', new DOMException('aborted', 'AbortError')],
    ['the reason of AbortSignal.abort()', AbortSignal.abort().reason],
    ['a plain object named AbortError (another realm)', { name: 'AbortError' }],
  ];
  const others: Array<[string, unknown]> = [
    ['a DOMException TimeoutError', new DOMException('late', 'TimeoutError')],
    ['a plain Error', new Error('boom')],
    ['a name in another case', { name: 'abortError' }],
    ['a name that is not a string', named(1)],
    ['the string AbortError', 'AbortError'],
    ['null', null],
    ['undefined', undefined],
  ];

  it.each(aborts)('both treat %s as an abort', (_label, err) => {
    expect(isAbortErrorLike(err)).toBe(true);
    expect(isAbortError(err)).toBe(true);
  });

  it.each(others)('neither treats %s as an abort', (_label, err) => {
    expect(isAbortErrorLike(err)).toBe(false);
    expect(isAbortError(err)).toBe(false);
  });
});
