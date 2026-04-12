import { SlackHandler } from './slack.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

const postMessageMock = jest.fn();
const updateMock = jest.fn();
const reactionsAddMock = jest.fn();
const conversationsListMock = jest.fn();
const filesUploadMock = jest.fn();

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    chat: {
      postMessage: (...args: unknown[]) => postMessageMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
    reactions: {
      add: (...args: unknown[]) => reactionsAddMock(...args),
    },
    conversations: {
      list: (...args: unknown[]) => conversationsListMock(...args),
    },
    files: {
      uploadV2: (...args: unknown[]) => filesUploadMock(...args),
    },
  })),
}));

function ctx(): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    nodeExecutionId: 'ne-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
  };
}

function makeService(
  overrides: {
    integration?: unknown;
    logUsage?: jest.Mock;
  } = {},
) {
  const logUsage = overrides.logUsage ?? jest.fn().mockResolvedValue(undefined);
  const integration = overrides.integration ?? {
    id: 'int-1',
    name: 'Team',
    serviceType: 'slack',
    status: 'connected',
    credentials: { access_token: 'xoxb-token' },
  };
  return {
    service: {
      getForExecution: jest.fn().mockResolvedValue(integration),
      logUsage,
    },
    logUsage,
  };
}

describe('SlackHandler', () => {
  beforeEach(() => {
    postMessageMock.mockReset();
    updateMock.mockReset();
    reactionsAddMock.mockReset();
    conversationsListMock.mockReset();
    filesUploadMock.mockReset();
  });

  // ---- validate ----
  describe('validate', () => {
    const handler = new SlackHandler();

    it('requires integrationId and action', () => {
      expect(handler.validate({}).valid).toBe(false);
    });

    it('rejects unknown action', () => {
      expect(
        handler.validate({ integrationId: 'int-1', action: 'dance' }).valid,
      ).toBe(false);
    });

    it('requires channel + text for send_message', () => {
      expect(
        handler.validate({
          integrationId: 'int-1',
          action: 'send_message',
        }).valid,
      ).toBe(false);
      expect(
        handler.validate({
          integrationId: 'int-1',
          action: 'send_message',
          channel: 'C1',
          text: 'hi',
        }).valid,
      ).toBe(true);
    });

    it('requires channel + ts + emoji for add_reaction', () => {
      expect(
        handler.validate({
          integrationId: 'int-1',
          action: 'add_reaction',
          channel: 'C1',
          ts: '1.0',
          emoji: 'tada',
        }).valid,
      ).toBe(true);
    });

    it('list_channels needs no extra fields', () => {
      expect(
        handler.validate({ integrationId: 'int-1', action: 'list_channels' })
          .valid,
      ).toBe(true);
    });

    it('upload_file requires channel + (content or file)', () => {
      expect(
        handler.validate({
          integrationId: 'int-1',
          action: 'upload_file',
          channel: 'C1',
        }).valid,
      ).toBe(false);
      expect(
        handler.validate({
          integrationId: 'int-1',
          action: 'upload_file',
          channel: 'C1',
          content: 'hello',
        }).valid,
      ).toBe(true);
    });
  });

  // ---- execute ----
  describe('execute', () => {
    it('sends a message and logs success', async () => {
      const { service, logUsage } = makeService();
      postMessageMock.mockResolvedValue({ channel: 'C1', ts: '100.0' });
      const handler = new SlackHandler(service as never);
      const out = (await handler.execute(
        null,
        {
          integrationId: 'int-1',
          action: 'send_message',
          channel: 'C1',
          text: 'hi',
        },
        ctx(),
      )) as {
        config: { action: string };
        output: { ts: string; channel: string };
        meta: { durationMs: number };
      };
      expect(out.config.action).toBe('send_message');
      expect(out.output.ts).toBe('100.0');
      expect(postMessageMock).toHaveBeenCalledWith({
        channel: 'C1',
        text: 'hi',
      });
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('strips colons from emoji name', async () => {
      const { service } = makeService();
      reactionsAddMock.mockResolvedValue({});
      const handler = new SlackHandler(service as never);
      await handler.execute(
        null,
        {
          integrationId: 'int-1',
          action: 'add_reaction',
          channel: 'C1',
          ts: '1.0',
          emoji: ':thumbsup:',
        },
        ctx(),
      );
      expect(reactionsAddMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'thumbsup' }),
      );
    });

    it('logs failure and rethrows on API error', async () => {
      const { service, logUsage } = makeService();
      postMessageMock.mockRejectedValue(new Error('slack rate limited'));
      const handler = new SlackHandler(service as never);
      await expect(
        handler.execute(
          null,
          {
            integrationId: 'int-1',
            action: 'send_message',
            channel: 'C1',
            text: 'hi',
          },
          ctx(),
        ),
      ).rejects.toThrow('slack rate limited');
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('rejects non-slack integration type', async () => {
      const { service } = makeService({
        integration: {
          id: 'int-1',
          serviceType: 'email',
          status: 'connected',
          name: 'Wrong',
          credentials: { access_token: 't' },
        },
      });
      const handler = new SlackHandler(service as never);
      await expect(
        handler.execute(
          null,
          {
            integrationId: 'int-1',
            action: 'send_message',
            channel: 'C1',
            text: 'hi',
          },
          ctx(),
        ),
      ).rejects.toThrow(/not "slack"/);
    });

    it('rejects integration without access_token', async () => {
      const { service } = makeService({
        integration: {
          id: 'int-1',
          serviceType: 'slack',
          status: 'connected',
          name: 'NoToken',
          credentials: {},
        },
      });
      const handler = new SlackHandler(service as never);
      await expect(
        handler.execute(
          null,
          {
            integrationId: 'int-1',
            action: 'send_message',
            channel: 'C1',
            text: 'hi',
          },
          ctx(),
        ),
      ).rejects.toThrow(/access_token/);
    });

    it('list_channels returns shortened channel list', async () => {
      const { service } = makeService();
      conversationsListMock.mockResolvedValue({
        channels: [
          { id: 'C1', name: 'general' },
          { id: 'C2', name: 'random' },
        ],
      });
      const handler = new SlackHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', action: 'list_channels' },
        ctx(),
      )) as { output: { channels: Array<{ id: string; name: string }> } };
      expect(out.output.channels).toHaveLength(2);
    });

    it('update_message invokes chat.update with ts/text', async () => {
      const { service } = makeService();
      updateMock.mockResolvedValue({ channel: 'C1', ts: '200.0' });
      const handler = new SlackHandler(service as never);
      const out = (await handler.execute(
        null,
        {
          integrationId: 'int-1',
          action: 'update_message',
          channel: 'C1',
          ts: '100.0',
          text: 'edited',
        },
        ctx(),
      )) as { output: { ts: string } };
      expect(out.output.ts).toBe('200.0');
      expect(updateMock).toHaveBeenCalledWith({
        channel: 'C1',
        ts: '100.0',
        text: 'edited',
      });
    });

    it('upload_file with content field falls back to content payload', async () => {
      const { service } = makeService();
      filesUploadMock.mockResolvedValue({ files: [{ id: 'F1' }] });
      const handler = new SlackHandler(service as never);
      await handler.execute(
        null,
        {
          integrationId: 'int-1',
          action: 'upload_file',
          channel: 'C1',
          content: 'hello',
          filename: 'note.txt',
        },
        ctx(),
      );
      expect(filesUploadMock).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_id: 'C1',
          content: 'hello',
          filename: 'note.txt',
        }),
      );
    });

    it('upload_file decodes base64 file field into a Buffer', async () => {
      const { service } = makeService();
      filesUploadMock.mockResolvedValue({ files: [{ id: 'F2' }] });
      const handler = new SlackHandler(service as never);
      await handler.execute(
        null,
        {
          integrationId: 'int-1',
          action: 'upload_file',
          channel: 'C1',
          file: 'base64:' + Buffer.from('binary').toString('base64'),
        },
        ctx(),
      );
      const payload = filesUploadMock.mock.calls[0][0] as {
        file?: unknown;
        content?: unknown;
      };
      expect(Buffer.isBuffer(payload.file)).toBe(true);
      expect(payload.content).toBeUndefined();
    });

    it('falls back to requires_integration stub without service', async () => {
      const handler = new SlackHandler();
      const out = (await handler.execute(
        null,
        {
          integrationId: 'int-1',
          action: 'send_message',
          channel: 'C1',
          text: 'hi',
        },
        ctx(),
      )) as { status: string };
      expect(out.status).toBe('requires_integration');
    });
  });
});
