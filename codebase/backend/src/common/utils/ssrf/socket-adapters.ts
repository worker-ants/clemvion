/**
 * 연결 시점 판정용 드라이버 소켓 어댑터(pg · mysql2 `stream`, nodemailer `getSocket`).
 *
 * `fetch` 를 쓰지 않는 드라이버는 주소 조회 훅을 받지 않는다. 그래서 소켓을 이 모듈이 직접 열고 공용 조회 함수
 * (`outbound-guard.ts` 의 `safeOutboundLookup`)를 `net.connect` 의 `lookup` 으로 넘긴다. 연결할 때 푼 주소가 막힌 대역이면 소켓이
 * `SsrfBlockedError` 로 실패한다. 스펙: CLE-NODE-INT-COMMON-ERROR 「사설망 차단」.
 *
 * 세 어댑터는 드라이버 내부의 소켓 호출 규약에 기댄다(pg 는 받은 소켓에 `connect(port, host)` 를 부르고, mysql2 는
 * `{ config }` 를 넘기며, nodemailer 는 `{ connection }` 을 받는다). 드라이버를 올려 이 규약이 바뀌면
 * `socket-adapters.contract.spec.ts` 의 실제 드라이버 테스트가 깨진다(NERV Task `CLE-T-AM1H7X`).
 *
 * 사설망 허용 플래그(`ALLOW_PRIVATE_HOST_TARGETS=true`)를 보고 어댑터를 실을지 정하는 것은 이 모듈이 아니라 호출부의
 * 빌더다(`database-query/database-connection.ts` 의 `buildPgConnection` · `buildMysqlConnection`,
 * `send-email/smtp-host-guard.ts` 의 `guardedSmtpGetSocket`). 이 모듈은 받은 `lookup` 으로 소켓을 열기만 한다.
 */
import { connect, Socket, type LookupFunction } from 'node:net';

/** pg `stream` 팩토리. pg 가 연결(풀의 새 클라이언트 포함)마다 불러 소켓을 받는다. */
export type PgStreamFactory = () => Socket;

/**
 * pg 연결 시점 판정 소켓 팩토리. pg 는 받은 소켓에 `connect(port, host)` 를 부르므로 그 호출을
 * `connect({ port, host, lookup })` 로 바꿔 연결할 때 푼 주소를 공용 대역표로 다시 판정한다. 그 밖의 소켓 동작(`setNoDelay` ·
 * keep-alive · 연결 타임아웃의 `destroy`)은 pg 가 그대로 한다. TLS 는 pg 가 이 소켓 위에서 `servername: host` 로 맺는다.
 * 유닉스 소켓 경로(문자열 인자 하나)는 원래 `connect` 로 넘기고, 그 밖의 알 수 없는 형태는 소켓을 오류로 닫는다.
 */
export function createGuardedPgStream(lookup: LookupFunction): PgStreamFactory {
  return () => {
    const socket = new Socket();
    const originalConnect = socket.connect.bind(socket) as (
      ...args: unknown[]
    ) => Socket;
    socket.connect = (...args: unknown[]) => {
      const [port, host] = args;
      if (
        (typeof port === 'number' || typeof port === 'string') &&
        typeof host === 'string'
      ) {
        return originalConnect({ port: Number(port), host, lookup });
      }
      // 유닉스 소켓 경로(`connect(path)`, 문자열 하나)만 원래 연결로 넘긴다. 그 밖의 형태는 pg 호출 규약이 바뀐 것이라
      // lookup 없이 연결하면 판정이 빠진다. 소켓을 오류로 닫아 연결하지 않는다(fail-closed).
      if (args.length === 1 && typeof args[0] === 'string') {
        return originalConnect(...args);
      }
      socket.destroy(
        new Error(
          'Unsupported pg socket connect call; refusing to connect without SSRF lookup',
        ),
      );
      return socket;
    };
    return socket;
  };
}

/** mysql2 `stream` 팩토리가 받는 인자 중 이 모듈이 읽는 부분. mysql2 는 `{ config }` 를 넘긴다. */
interface MysqlStreamFactoryOptions {
  config: {
    host?: string;
    port?: number;
    enableKeepAlive?: boolean;
    keepAliveInitialDelay?: number;
  };
}

/** mysql2 `stream` 팩토리. mysql2 가 연결(풀의 새 연결 포함)마다 불러 연결 중인 소켓을 받는다. */
export type MysqlStreamFactory = (opts: MysqlStreamFactoryOptions) => Socket;

/**
 * mysql2 연결 시점 판정 소켓 팩토리. `net.connect({ host, port, lookup })` 으로 소켓을 열어 연결할 때 푼 주소를 공용
 * 대역표로 다시 판정한다. mysql2 는 팩토리가 준 소켓에는 `setNoDelay` · keep-alive 를 걸지 않으므로 기본 연결과 같게
 * 여기서 건다(`lib/base/connection.js` 의 기본 경로와 같은 값). TLS 는 mysql2 가 이 소켓 위에서 `config.host` 를
 * servername 으로 맺는다.
 */
export function createGuardedMysqlStream(
  lookup: LookupFunction,
): MysqlStreamFactory {
  return ({ config }) => {
    // mysql2 `ConnectionConfig` 가 채우는 기본값과 같다(`localhost` · 3306). 타입상 비어 있을 수 있어 여기서도 둔다.
    const socket = connect({
      host: config.host ?? 'localhost',
      port: config.port ?? 3306,
      lookup,
    });
    if (config.enableKeepAlive) {
      socket.on('connect', () => {
        socket.setKeepAlive(true, config.keepAliveInitialDelay);
      });
    }
    socket.setNoDelay(true);
    return socket;
  };
}

/**
 * nodemailer 의 연결 대기 기본값(ms). `connectionTimeout` 을 주지 않은 transport 는 nodemailer 와 같은 상한으로 TCP 연결을
 * 기다린다(`smtp-connection` 의 `CONNECTION_TIMEOUT`).
 */
export const SMTP_DEFAULT_CONNECTION_TIMEOUT_MS = 2 * 60 * 1000;

/** {@link createSmtpGetSocket} 이 읽는 transport 옵션. nodemailer 가 transport 옵션 전체를 넘긴다. */
export interface SmtpSocketTarget {
  host?: string;
  port?: number;
  secure?: boolean;
  connectionTimeout?: number;
}

/** nodemailer `getSocket` 훅. `{ connection }` 을 돌려주면 nodemailer 가 그 소켓으로 SMTP 대화를 한다. */
export type SmtpGetSocket = (
  options: SmtpSocketTarget,
  callback: (err: Error | null, socketOptions?: { connection: Socket }) => void,
) => void;

/**
 * 주어진 `lookup` 으로 TCP 소켓을 여는 nodemailer `getSocket` 훅. 연결할 때 푼 주소를 공용 대역표로 다시 판정하고, 통과한
 * 주소로만 연결한 뒤 그 소켓을 nodemailer 에 넘긴다. 막히면 콜백이 `SsrfBlockedError` 를 받고, 발송 · `verify()` 가 그
 * 오류로 실패한다.
 *
 * - nodemailer 는 자체 해석(`dns.resolve4` → `resolve6` → `dns.lookup`)을 하고 `lookup` 옵션을 받지 않는다. 그래서
 *   소켓을 직접 연다. 이 경로에서는 nodemailer 의 해석 · 대체 주소 재시도를 거치지 않고, 대체 주소 선택은 Node
 *   `net.connect` 의 기본 동작(autoSelectFamily)을 따른다.
 * - nodemailer 의 `connectionTimeout` 은 넘겨받은 소켓의 TCP 연결을 기다리지 않는다. 그래서 같은 값(없으면
 *   {@link SMTP_DEFAULT_CONNECTION_TIMEOUT_MS})으로 이 함수가 연결 대기에 상한을 둔다. 넘기면 소켓을 닫고
 *   `ETIMEDOUT` 오류를 넘긴다.
 * - 직접 TLS(`secure`)와 STARTTLS 는 nodemailer 가 이 소켓 위에서 맺는다. SNI · 인증서 검증의 이름은 transport 의
 *   `host` 그대로다(nodemailer 가 `options.host` 로 `servername` 을 정한다).
 * - IP 리터럴 host 는 조회를 거치지 않는다. 리터럴은 연결 전 검사(`send-email/smtp-host-guard.ts` 의 `checkSmtpHost`)가
 *   판정한다.
 */
export function createSmtpGetSocket(lookup: LookupFunction): SmtpGetSocket {
  return (options, callback) => {
    // nodemailer `SMTPConnection` 의 기본값과 같다(host 가 없으면 localhost, port 가 없으면 secure 여부로 465/587).
    const host = options.host || 'localhost';
    const port = Number(options.port) || (options.secure ? 465 : 587);
    const timeoutMs =
      options.connectionTimeout || SMTP_DEFAULT_CONNECTION_TIMEOUT_MS;

    const socket = connect({ host, port, lookup });
    let settled = false;
    const finish = (err: Error | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeListener('error', onError);
      socket.removeListener('connect', onConnect);
      if (err) {
        socket.destroy();
        callback(err);
        return;
      }
      callback(null, { connection: socket });
    };
    const onError = (err: Error): void => finish(err);
    const onConnect = (): void => finish(null);
    const timer = setTimeout(() => {
      const timeoutErr: NodeJS.ErrnoException = new Error('Connection timeout');
      timeoutErr.code = 'ETIMEDOUT';
      finish(timeoutErr);
    }, timeoutMs);
    socket.once('error', onError);
    socket.once('connect', onConnect);
  };
}
