import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { WorkflowAssistantController } from './workflow-assistant.controller';
import { ASSISTANT_STREAM_ERROR_MESSAGES } from './workflow-assistant-stream-errors';

/**
 * REQ-ASSIST-048 — `sendMessage` 의 바깥 `catch`. 스트림 서비스가 던지면 SSE
 * `error` 이벤트에 `ASSISTANT_STREAM_FAILED` 와 고정 문구만 싣고, 던진 예외의
 * 문구(SQL · LLM 응답 · 스택 조각이 섞일 수 있다)는 서버 로그에만 남긴다(CWE-209).
 * 서비스 안의 `catch` 는 `workflow-assistant-stream.service.spec.ts` 가 다룬다.
 */

const RAW =
  'connect ECONNREFUSED https://api.example.test/v1?key=sk-raw-secret';

type StreamEvent = { event: string; data: unknown };

function makeController(streamMessage: () => AsyncIterable<StreamEvent>) {
  const sessionService = {
    findOneForUser: jest.fn().mockResolvedValue({ id: 'sess-1' }),
  };
  const streamService = { streamMessage: jest.fn(streamMessage) };
  const controller = new WorkflowAssistantController(
    sessionService as never,
    streamService as never,
  );
  return { controller, sessionService, streamService };
}

function makeRes(writableEnded = false) {
  return {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    writableEnded,
  };
}

function send(
  controller: WorkflowAssistantController,
  res: ReturnType<typeof makeRes>,
) {
  return controller.sendMessage(
    'ws-1',
    { sub: 'u-1' } as never,
    '00000000-0000-4000-8000-000000000001',
    { content: 'hello' } as never,
    new EventEmitter() as never,
    res as never,
  );
}

/** 첫 `next()` 에서 예외를 던지는 비동기 이터러블. Error 가 아닌 값도 던질 수 있다. */
function throwingStream(err: unknown): () => AsyncIterable<StreamEvent> {
  return () => ({
    [Symbol.asyncIterator]: () => ({
      // 던진 값이 Error 가 아닌 경로(`String(err)`)를 밟으려고 일부러 Error 가 아닌 값을 거절한다.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      next: () => Promise.reject(err),
    }),
  });
}

describe('WorkflowAssistantController.sendMessage — outer catch', () => {
  let loggerError: jest.SpyInstance;
  beforeEach(() => {
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => loggerError.mockRestore());

  const written = (res: ReturnType<typeof makeRes>) =>
    res.write.mock.calls.map((c) => String(c[0])).join('');

  it('writes only ASSISTANT_STREAM_FAILED and its fixed message when the stream service throws', async () => {
    const { controller } = makeController(throwingStream(new Error(RAW)));
    const res = makeRes();

    await send(controller, res);

    expect(res.write).toHaveBeenCalledWith('event: error\n');
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        code: 'ASSISTANT_STREAM_FAILED',
        message: ASSISTANT_STREAM_ERROR_MESSAGES.ASSISTANT_STREAM_FAILED,
      })}\n\n`,
    );
    // 던진 예외의 문구는 화면으로 가지 않는다.
    expect(written(res)).not.toContain('sk-raw-secret');
    expect(written(res)).not.toContain('ECONNREFUSED');
    expect(res.end).toHaveBeenCalled();
  });

  it('keeps the thrown error text in the server log only', async () => {
    const { controller } = makeController(throwingStream(new Error(RAW)));

    await send(controller, makeRes());

    const logged = loggerError.mock.calls.map((c) => c.map(String).join(' '));
    expect(logged.join('\n')).toContain('sk-raw-secret');
  });

  it('writes the fixed message for a non-Error throw too', async () => {
    const { controller } = makeController(throwingStream(RAW));
    const res = makeRes();

    await send(controller, res);

    expect(written(res)).toContain(
      ASSISTANT_STREAM_ERROR_MESSAGES.ASSISTANT_STREAM_FAILED,
    );
    expect(written(res)).not.toContain('sk-raw-secret');
  });

  it('writes nothing after the response has ended', async () => {
    const { controller } = makeController(throwingStream(new Error(RAW)));
    const res = makeRes(true);

    await send(controller, res);

    expect(res.write).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('forwards the events the stream service yields', async () => {
    const { controller } = makeController(() => ({
      [Symbol.asyncIterator]: async function* () {
        await Promise.resolve();
        yield { event: 'text', data: { delta: 'hi' } };
      },
    }));
    const res = makeRes();

    await send(controller, res);

    expect(written(res)).toBe('event: text\ndata: {"delta":"hi"}\n\n');
    expect(res.end).toHaveBeenCalled();
  });
});
