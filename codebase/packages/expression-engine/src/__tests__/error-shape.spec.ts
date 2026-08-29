import * as errors from '../errors';
import { ErrorCode, ExpressionError } from '../errors';

/**
 * `ExpressionError` 계열의 **모양** 캐너리.
 *
 * 왜 여기(패키지)인가 — 이 계열의 에러는 backend 의 두 곳에서 `new Error(..., { cause })`
 * 로 감싸져 나가고, 그 부착이 안전한 근거가
 * `spec/5-system/3-error-handling.md` §6.3.1 의 **C2**("`err` 가 message·name 밖의 민감
 * 정보를 속성으로 들고 있지 않다")다. 그 소비처(backend spec)에서 잠그면 **거기서 실제로
 * 지나가는 클래스만** 잠기고, 나머지는 조용히 새로 생긴다 — 실제로 그렇게 됐다:
 * 소비처 캐너리가 3종만 지나가는 상태에서 리뷰가 4번째(`FunctionError`)를 뮤테이션으로
 * 뚫었고, 세어 보니 클래스는 **여섯**이었다.
 *
 * 그래서 축을 "도달 가능한 경로" 가 아니라 **"이 모듈이 export 하는 에러 클래스 전부"**
 * 로 바꾼다. 새 하위 클래스가 추가되면 아래 `SUBCLASSES` 의 전수성 단언이 먼저 RED 를
 * 내므로, 커버리지가 조용히 좁아지지 않는다.
 *
 * 측정 축이 **enumerable** own key 인 이유: C2 가 막으려는 것은 pg 드라이버의
 * `detail`/`hint`, HTTP 응답 헤더, 커넥션 문자열처럼 **직렬화에 딸려 나오는** 값이다.
 * `JSON.stringify` 와 object spread 는 enumerable 만 본다. 표준 `message`/`stack` 은
 * own 이지만 non-enumerable 이라 여기 안 잡히는 것이 맞다.
 */
describe('ExpressionError 계열의 own-property 모양 (§6.3.1 C2 캐너리)', () => {
  /** 비민감 화이트리스트 — `code` 는 enum 문자열, `position` 은 입력 안의 정수 오프셋. */
  const ALLOWED_KEYS = ['code', 'name', 'position'];

  /**
   * 클래스 → 그 클래스가 **써야 하는** `ErrorCode`.
   *
   * 종전엔 `expect(Object.values(ErrorCode)).toContain(err.code)` 였는데, 그건 "enum 안의
   * 값인가" 만 보는 **타입 검사**라 클래스↔코드 매핑이 뒤바뀌어도 통과한다 — 리뷰가
   * `SyntaxError`/`ReferenceError` 의 코드를 맞바꾸는 뮤테이션으로 9/9 GREEN 을 실측해
   * 보였다. 정확값 비교로 바꿔 그 축을 실제로 잠근다.
   *
   * 아래 전수성 단언이 이 표와 `SUBCLASSES` 를 대조하므로, 새 클래스를 표에 안 적으면
   * `undefined` 로 조용히 통과하는 게 아니라 먼저 RED 가 난다.
   */
  const EXPECTED_CODE: Record<string, ErrorCode> = {
    SyntaxError: ErrorCode.EXPR_SYNTAX_ERROR,
    ReferenceError: ErrorCode.EXPR_REFERENCE_ERROR,
    TypeError: ErrorCode.EXPR_TYPE_ERROR,
    FunctionError: ErrorCode.EXPR_FUNCTION_ERROR,
    TimeoutError: ErrorCode.EXPR_TIMEOUT,
    DepthExceededError: ErrorCode.EXPR_DEPTH_EXCEEDED,
  };

  /** `errors.ts` 가 export 하는 `ExpressionError` 하위 클래스 전부 (base 제외). */
  const SUBCLASSES = Object.entries(errors).filter(
    (entry): entry is [string, new (message: string) => ExpressionError] => {
      const [, value] = entry;
      return (
        typeof value === 'function' &&
        value !== ExpressionError &&
        value.prototype instanceof ExpressionError
      );
    },
  );

  // 전수성 — 하위 클래스가 늘거나 줄면 여기가 먼저 RED 를 낸다. 이 단언이 없으면
  // 아래 `it.each` 가 "0건 순회" 로도 GREEN 이라 캐너리가 조용히 무력해진다.
  it('하위 클래스를 전부 집어냈다 (여섯 종)', () => {
    expect(SUBCLASSES.map(([name]) => name).sort()).toEqual([
      'DepthExceededError',
      'FunctionError',
      'ReferenceError',
      'SyntaxError',
      'TimeoutError',
      'TypeError',
    ]);
  });

  it('클래스↔코드 표가 하위 클래스와 1:1 이다', () => {
    expect(Object.keys(EXPECTED_CODE).sort()).toEqual(
      SUBCLASSES.map(([name]) => name).sort(),
    );
  });

  it.each(SUBCLASSES)(
    '%s 의 enumerable own key 가 비민감 화이트리스트를 벗어나지 않는다',
    (name, Cls) => {
      const err = new Cls('probe message');
      expect(Object.keys(err).sort()).toEqual(ALLOWED_KEYS);

      // 키 이름만 잠그면 "같은 키에 민감한 값이 실린다" 는 변형을 놓친다. 값도 고정한다.
      expect(err.code).toBe(EXPECTED_CODE[name]);
      // 여기 fixture 는 `position` 을 넘기지 않으므로 `undefined` 가 **정확한** 기대값이다.
      // 종전의 `undefined || Number.isInteger(...)` 는 이 파일 안에서 정수 분기가 한 번도
      // 실행되지 않는 vacuous disjunction 이었다. 정수 분기는 아래 base 케이스가 지나간다.
      expect(err.position).toBeUndefined();
    },
  );

  it('base `ExpressionError` 자신도 같은 모양이다', () => {
    const err = new ExpressionError(ErrorCode.EXPR_SYNTAX_ERROR, 'probe', 7);
    expect(Object.keys(err).sort()).toEqual(ALLOWED_KEYS);
    expect(err.position).toBe(7);
  });

  it('표준 `message`/`stack` 은 non-enumerable 이라 화이트리스트 밖에 있다', () => {
    // 이 캐너리가 "enumerable" 축을 고른 근거의 실측이다 — 축을 `getOwnPropertyNames`
    // 로 바꾸면 이 둘이 섞여 들어와 화이트리스트의 의미가 달라진다.
    const err = new errors.SyntaxError('probe', 3);
    expect(Object.getOwnPropertyNames(err).sort()).toEqual([
      'code',
      'message',
      'name',
      'position',
      'stack',
    ]);
    expect(Object.keys(err)).not.toContain('message');
    expect(Object.keys(err)).not.toContain('stack');
  });
});
