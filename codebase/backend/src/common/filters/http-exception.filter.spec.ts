import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { GlobalExceptionFilter } from './http-exception.filter';

function mockHost(): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function bodyOf(json: jest.Mock): {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
} {
  return json.mock.calls[0][0];
}

describe('GlobalExceptionFilter', () => {
  // Logger spy 복원을 afterEach 로 통일(B-5) — 예외로 테스트가 중단돼도 spy 가 누설되지 않는다.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps 413 PayloadTooLargeException to PAYLOAD_TOO_LARGE envelope', () => {
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(new PayloadTooLargeException(), host);

    expect(status).toHaveBeenCalledWith(413);
    const body = bodyOf(json);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.error.requestId).toBeDefined();
  });

  it('maps a plain http-error (status, non-HttpException) 4xx to its envelope', () => {
    // body-parser 의 PayloadTooLargeError 처럼 NestJS HttpException 이 아니지만
    // 숫자 status 를 가진 오류 → mapHttpErrorLike 경로.
    const { host, status, json } = mockHost();
    const err = Object.assign(new Error('request entity too large'), {
      status: 413,
      statusCode: 413,
    });
    new GlobalExceptionFilter().catch(err, host);

    expect(status).toHaveBeenCalledWith(413);
    const body = bodyOf(json);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    // 내부 message 를 echo 하지 않고 일반 문구만 반환한다(CWE-209).
    expect(body.error.message).not.toBe('request entity too large');
    expect(body.error.message).toBe('Request payload too large.');
  });

  it('maps a non-413 4xx http-error to a generic message + logs the original', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { host, status, json } = mockHost();
    const err = Object.assign(new Error('some internal 400 detail'), {
      status: 400,
    });
    new GlobalExceptionFilter().catch(err, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = bodyOf(json);
    expect(body.error.code).toBe('VALIDATION_ERROR'); // getCodeFromStatus(400)
    expect(body.error.requestId).toBeDefined(); // 413 케이스와 대칭(B-6)
    // CWE-209: 내부 원문 미노출, 일반 문구만. 원문은 logger.warn 로만 남는다.
    expect(body.error.message).toBe('The request could not be processed.');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('some internal 400 detail'),
    );
    // spy 복원은 afterEach(jest.restoreAllMocks) 가 담당.
  });

  it('masks a plain 5xx-ish error (no/≥500 status) as 500 INTERNAL_ERROR', () => {
    const { host, status, json } = mockHost();
    const err = Object.assign(new Error('internal detail leak'), {
      status: 502,
    });
    new GlobalExceptionFilter().catch(err, host);

    expect(status).toHaveBeenCalledWith(500);
    const body = bodyOf(json);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('internal detail leak');
    expect(body.error.requestId).toBeDefined(); // 5xx 도 requestId 항상 발급
  });

  it('maps a unique-violation QueryFailedError (23505) to 409 RESOURCE_CONFLICT', () => {
    // typeorm race-window unique 위반 → 클라이언트엔 409 가 옳다(isUniqueViolation 분기).
    const { host, status, json } = mockHost();
    const driverError = Object.assign(new Error('duplicate key value'), {
      code: '23505',
    });
    const err = new QueryFailedError('INSERT ...', [], driverError);
    new GlobalExceptionFilter().catch(err, host);

    expect(status).toHaveBeenCalledWith(409);
    const body = bodyOf(json);
    expect(body.error.code).toBe('RESOURCE_CONFLICT');
    expect(body.error.requestId).toBeDefined();
    // 드라이버 원문(컬럼·제약명)을 echo 하지 않고 고정 문구만 — 양성 단언으로 문구 pin.
    expect(body.error.message).not.toContain('duplicate key value');
    expect(body.error.message).toBe(
      'Resource already exists or has been modified concurrently.',
    );
  });

  it('non-23505 QueryFailedError → 500 INTERNAL_ERROR (RESOURCE_CONFLICT 분기 회피)', () => {
    // 23505(unique) 가 아닌 제약 위반(예 23502 not-null)은 409 가 아니라 generic 500 으로 마스킹된다.
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { host, status, json } = mockHost();
    const driverError = Object.assign(new Error('null value violation'), {
      code: '23502',
    });
    const err = new QueryFailedError('INSERT ...', [], driverError);
    new GlobalExceptionFilter().catch(err, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(bodyOf(json).error.code).toBe('INTERNAL_ERROR');
    error.mockRestore();
  });

  it('recognizes nested { error: { code, message, details } } envelope (API §5.3 shape)', () => {
    // interaction 모듈처럼 nested error shape 으로 throw 하는 코드도 정상 직렬화한다.
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(
      new HttpException(
        {
          error: {
            code: 'STATE_MISMATCH',
            message: 'state conflict',
            details: [{ field: 'x' }],
          },
        },
        HttpStatus.CONFLICT,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    const body = bodyOf(json);
    expect(body.error.code).toBe('STATE_MISMATCH');
    expect(body.error.message).toBe('state conflict');
    expect(body.error.details).toEqual([{ field: 'x' }]);
    expect(body.error.requestId).toBeDefined();
  });

  it('passes through an explicit code + details', () => {
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(
      new BadRequestException({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Invalid webhook payload',
        details: [{ field: 'orderId', code: 'MISSING_REQUIRED_FIELD' }],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    const body = bodyOf(json);
    expect(body.error.code).toBe('INVALID_WEBHOOK_PAYLOAD');
    expect(body.error.details).toEqual([
      { field: 'orderId', code: 'MISSING_REQUIRED_FIELD' },
    ]);
  });

  it('defaults unknown errors to 500 INTERNAL_ERROR', () => {
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(bodyOf(json).error.code).toBe('INTERNAL_ERROR');
  });

  it('비-Error 값 throw(문자열 등)은 UNKNOWN_ERROR_MESSAGE 로 500 처리', () => {
    // Error 인스턴스가 아닌 값(문자열·객체)이 throw 되면 어떤 분기에도 안 걸려
    // UNKNOWN_ERROR_MESSAGE fallthrough 가 그대로 응답된다(UNHANDLED 경로와 구분).
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch('a raw string thrown', host);

    expect(status).toHaveBeenCalledWith(500);
    const body = bodyOf(json);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
  });

  /**
   * `cause` 비노출 불변식 — 이 describe 가 그 **계측 지점**이다.
   *
   * `spec/5-system/3-error-handling.md` §6.3.1 기준으로 저장소 곳곳이 `cause: err` 를 단다
   * (`expression-resolver.service.ts` · `code.handler.ts`). 그 부착이 안전한 근거는
   * **"이 세 경로의 `cause` 를 클라이언트 응답으로 직렬화하는 곳이 없다"** 는 **부재 주장**인데,
   * 부재는 아무도 지키지 않으면 조용히 참이 아니게 된다 — 이 필터가 언젠가 APM·구조적 로깅
   * 유틸을 붙이며 에러 객체를 통째로 펼치면(`...exception`, `serializeError(exception)`),
   * `cause` 안의 원본 드라이버 메시지·SQL·경로가 그대로 클라이언트로 나간다(CWE-209).
   *
   * **부재 주장의 참인 범위를 좁게 적어 둔다** — "저장소 전체에 `cause` 를 읽는 곳이 없다" 는
   * **거짓**이다(`chat-channel/providers/telegram/telegram-client.ts` 의 `describeFetchError`
   * 가 `err.cause` 를 읽는다). 참인 것은 "**클라이언트 응답 봉투를 만드는 경로**가 `cause` 를
   * 싣지 않는다" 이고, 그 경로의 단일 출구가 이 필터다. 그래서 계측을 여기 둔다.
   *
   * **봉투 키를 닫힌 집합으로 단언하는 것이 요점이다.** `expect(body.error.cause)
   * .toBeUndefined()` 만 두면 `cause` 라는 **이름**만 막는다 — `errorCause`·`originalError`·
   * `stack` 처럼 다른 이름으로 새는 것은 그대로 통과한다. 전수 열거라야 "새 필드가 생기면
   * 여기서 멈춘다" 가 성립한다.
   */
  describe('`cause` 비노출 불변식 (계측 지점)', () => {
    /** `cause` 에만 담기는 표식 — 응답 어디에도 이 문자열이 나타나면 안 된다. */
    const CAUSE_MARKER = 'SENSITIVE-CAUSE-DETAIL-a1b2c3';

    /** `error` 봉투가 (details 없이) 싣는 닫힌 키 집합 — 아래 두 곳에서 재사용한다. */
    const CLOSED_ENVELOPE_KEYS = ['code', 'message', 'requestId'];

    /**
     * 표식을 **enumerable own key 로** 심는다. `JSON.stringify` 는 enumerable own key 만
     * 보고 표준 `message`/`stack` 은 non-enumerable 이라 안 잡히므로, 표식을 message 에만
     * 두면 유출돼도 `{}` 로 직렬화돼 **단언이 조용히 통과한다**.
     *
     * 이건 가정이 아니라 실측이다 — 처음엔 표식을 안쪽 에러에만 뒀더니 아래
     * `HttpException` 케이스가 유출 뮤턴트를 **놓쳤다**(봉투에 `"cause":{}` 만 실림).
     * 저장소가 `expression-resolver.service.spec.ts` 의 C2 캐너리에서 "축이 enumerable
     * own key 인 이유" 로 적어 둔 바로 그 함정이다.
     */
    function sensitiveCause(): Error {
      return Object.assign(
        new Error(`ECONNREFUSED ${CAUSE_MARKER} at /srv/app/secret.ts:42`),
        { query: `SELECT * FROM secrets -- ${CAUSE_MARKER}` },
      );
    }

    /** 필터에 직접 넘길 에러 — `.cause` 가 표식을 지닌다. */
    function errorWithCause(): Error {
      return new Error('wrapped failure', { cause: sensitiveCause() });
    }

    it('fixture 자체는 유출되면 표식이 보이는 형태다 (vacuity 방지)', () => {
      // 위 단언들이 "표식이 없다" 를 보는 이상, fixture 가 애초에 표식을 직렬화하지 못하는
      // 형태면 전부 공허하게 통과한다. 그 전제를 여기서 한 번 못 박는다.
      expect(JSON.stringify({ cause: sensitiveCause() })).toContain(
        CAUSE_MARKER,
      );
      expect(
        JSON.stringify({
          cause: (errorWithCause() as { cause?: unknown }).cause,
        }),
      ).toContain(CAUSE_MARKER);
    });

    it('매핑 안 된 내부 Error 의 `cause` 는 응답 봉투 어디에도 실리지 않는다', () => {
      const { host, status, json } = mockHost();
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      new GlobalExceptionFilter().catch(errorWithCause(), host);

      expect(status).toHaveBeenCalledWith(500);
      const body = bodyOf(json);
      // 봉투 전체를 직렬화해 표식이 어느 깊이에도 없음을 본다 — 특정 키만 보지 않는다.
      expect(JSON.stringify(body)).not.toContain(CAUSE_MARKER);
      expect(body.error.message).toBe(
        'An unexpected error occurred. Please try again later.',
      );
    });

    it('`HttpException` 에 `cause` 가 달려 있어도 마찬가지다', () => {
      // Nest 의 HttpException 도 두 번째 인자로 `cause` 를 받는다 — 매핑 경로가 달라서
      // 위 케이스와 별도로 고정한다(같은 이름의 방어가 분기마다 있는지가 관건).
      const { host, status, json } = mockHost();
      const exception = new HttpException(
        { code: 'STATE_MISMATCH', message: 'state conflict' },
        HttpStatus.CONFLICT,
        // 표식을 지닌 에러를 **직접** cause 로 준다 — 한 겹 더 감싸면 바깥 에러의
        // enumerable own key 가 비어 직렬화가 `{}` 가 되고 단언이 공허해진다(위 실측).
        { cause: sensitiveCause() },
      );
      new GlobalExceptionFilter().catch(exception, host);

      expect(status).toHaveBeenCalledWith(409);
      expect(JSON.stringify(bodyOf(json))).not.toContain(CAUSE_MARKER);
    });

    it('http-error(4xx) 매핑 경로에서도 `cause` 가 새지 않는다', () => {
      // mapHttpErrorLike 는 상태 기반 고정 문구만 쓰지만, 그 분기도 같은 봉투를 만든다.
      const { host, status, json } = mockHost();
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const err = Object.assign(errorWithCause(), { status: 413 });
      new GlobalExceptionFilter().catch(err, host);

      expect(status).toHaveBeenCalledWith(413);
      expect(JSON.stringify(bodyOf(json))).not.toContain(CAUSE_MARKER);
    });

    // **분기마다 `cause` 를 실제로 달아 둔다.** 처음엔 `new Error('boom')` 처럼 cause 가
    // 없는 fixture 를 썼더니, 유출 뮤턴트의 조건(`exception.cause` 가 truthy)이 아예 발화하지
    // 않아 이 열거 전체가 뮤턴트를 **놓쳤다**. 닫힌 집합 단언은 "새 키가 생기면 잡는다" 가
    // 요점인데, 그 새 키를 만들 재료가 fixture 에 없으면 공허하다.
    it.each([
      ['매핑 안 된 Error', () => errorWithCause()],
      [
        'http-error 4xx',
        () => Object.assign(errorWithCause(), { status: 404 }) as unknown,
      ],
      [
        'HttpException(객체 응답)',
        () =>
          new HttpException(
            { code: 'X', message: 'y' },
            HttpStatus.BAD_REQUEST,
            {
              cause: sensitiveCause(),
            },
          ),
      ],
      [
        'QueryFailedError(23505)',
        () =>
          Object.assign(
            new QueryFailedError(
              'INSERT ...',
              [],
              Object.assign(new Error('duplicate key value'), {
                code: '23505',
              }),
            ),
            { cause: sensitiveCause() },
          ),
      ],
    ])(
      '봉투 `error` 의 키는 닫힌 집합이다 — %s (새 필드가 생기면 여기서 멈춘다)',
      (_label, make) => {
        const { host, json } = mockHost();
        jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation(() => undefined);
        jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
        new GlobalExceptionFilter().catch(make(), host);

        // `details` 는 호출자가 명시적으로 실은 경우에만 붙는 선택 키다 — 위 4개 fixture 는
        // `details` 를 안 싣는다. 아래 CLOSED_ENVELOPE_KEYS 3개 키를 벗어난 키가 생기면
        // (= 에러 객체를 통째로 펼치는 변경) 여기서 RED.
        expect(Object.keys(bodyOf(json).error).sort()).toEqual(
          CLOSED_ENVELOPE_KEYS,
        );
        // 키 이름만으로는 값 안에 `cause` 내용이 섞여 드는 것(예: message 필드에 원본
        // 드라이버 메시지를 이어붙이는 변경)을 못 잡는다 — 4개 분기 전부에 값 누출 부재
        // 단언을 함께 건다(WARNING: QueryFailedError(23505) 분기는 이 단언이 없으면
        // 뮤테이션으로 GREEN 그대로 통과함을 실측 확인).
        expect(JSON.stringify(bodyOf(json))).not.toContain(CAUSE_MARKER);
      },
    );

    it('비-Error 값 fallthrough 도 같은 닫힌 집합이다', () => {
      // 문자열 throw 는 `cause` 를 가질 수 없어 유출 뮤턴트를 가르지 못한다 — 그래서 위
      // 열거에서 빼고 여기 따로 둔다. 이 케이스가 고정하는 축은 "fallthrough 도 같은 봉투를
      // 만든다" 이지 `cause` 비노출이 아니다. 축이 다른 것을 한 열거에 섞지 않는다.
      const { host, json } = mockHost();
      new GlobalExceptionFilter().catch('a raw string thrown', host);

      expect(Object.keys(bodyOf(json).error).sort()).toEqual(
        CLOSED_ENVELOPE_KEYS,
      );
    });
  });
});
