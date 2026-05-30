import {
  createWebChatCorsDelegate,
  extractExternalExecutionId,
  isExternalOriginAllowed,
  parseWidgetOrigins,
  type CorsOptionsLike,
  type CorsRequestLike,
} from './web-chat-cors';

function decide(
  delegate: ReturnType<typeof createWebChatCorsDelegate>,
  req: CorsRequestLike,
): Promise<CorsOptionsLike> {
  return new Promise((resolve, reject) =>
    delegate(req, (err, opts) => (err ? reject(err) : resolve(opts!))),
  );
}

describe('extractExternalExecutionId', () => {
  it('external 경로에서 id 추출', () => {
    expect(
      extractExternalExecutionId('/api/external/executions/abc-1/stream'),
    ).toBe('abc-1');
    expect(extractExternalExecutionId('/api/external/executions/abc-1')).toBe(
      'abc-1',
    );
  });
  it('비-external 경로는 null', () => {
    expect(extractExternalExecutionId('/api/executions/abc-1')).toBeNull();
    expect(extractExternalExecutionId('/api/hooks/x')).toBeNull();
  });
});

describe('isExternalOriginAllowed', () => {
  it('빌트인 위젯 origin 허용', () => {
    expect(
      isExternalOriginAllowed('https://cdn.app', ['https://cdn.app'], []),
    ).toBe(true);
  });
  it('워크스페이스 allowlist origin 허용', () => {
    expect(
      isExternalOriginAllowed('https://acme.com', [], ['https://acme.com']),
    ).toBe(true);
  });
  it('후행 슬래시 정규화', () => {
    expect(
      isExternalOriginAllowed('https://acme.com/', [], ['https://acme.com']),
    ).toBe(true);
  });
  it('미허용 origin 거부', () => {
    expect(
      isExternalOriginAllowed(
        'https://evil.com',
        ['https://cdn.app'],
        ['https://acme.com'],
      ),
    ).toBe(false);
  });
  it('origin 없음(non-browser) 허용', () => {
    expect(isExternalOriginAllowed(undefined, [], [])).toBe(true);
  });
});

describe('parseWidgetOrigins', () => {
  it('콤마 분리 + trim + 후행슬래시 제거', () => {
    expect(parseWidgetOrigins('https://a/, https://b ')).toEqual([
      'https://a',
      'https://b',
    ]);
  });
  it('빈 값 → []', () => {
    expect(parseWidgetOrigins(undefined)).toEqual([]);
    expect(parseWidgetOrigins('')).toEqual([]);
  });
});

describe('createWebChatCorsDelegate', () => {
  const defaultOptions = (): CorsOptionsLike => ({
    origin: () => {},
    credentials: true,
  });

  it('/api/hooks/* → 무제한(origin true, credentials false)', async () => {
    const d = createWebChatCorsDelegate({
      widgetOrigins: [],
      resolveAllowlist: async () => [],
      defaultOptions,
    });
    const opts = await decide(d, {
      path: '/api/hooks/uuid',
      headers: { origin: 'https://anywhere' },
    });
    expect(opts.origin).toBe(true);
    expect(opts.credentials).toBe(false);
  });

  it('/api/external/* 허용 origin → 반영(credentials false)', async () => {
    const d = createWebChatCorsDelegate({
      widgetOrigins: ['https://cdn.app'],
      resolveAllowlist: async (id) => (id === 'e1' ? ['https://acme.com'] : []),
      defaultOptions,
    });
    const opts = await decide(d, {
      path: '/api/external/executions/e1/interact',
      headers: { origin: 'https://acme.com' },
    });
    expect(opts.origin).toBe('https://acme.com');
    expect(opts.credentials).toBe(false);
  });

  it('/api/external/* 빌트인 위젯 origin → 반영', async () => {
    const d = createWebChatCorsDelegate({
      widgetOrigins: ['https://cdn.app'],
      resolveAllowlist: async () => [],
      defaultOptions,
    });
    const opts = await decide(d, {
      path: '/api/external/executions/e1/stream',
      headers: { origin: 'https://cdn.app' },
    });
    expect(opts.origin).toBe('https://cdn.app');
  });

  it('/api/external/* 미허용 origin → origin false', async () => {
    const d = createWebChatCorsDelegate({
      widgetOrigins: ['https://cdn.app'],
      resolveAllowlist: async () => ['https://acme.com'],
      defaultOptions,
    });
    const opts = await decide(d, {
      path: '/api/external/executions/e1/interact',
      headers: { origin: 'https://evil.com' },
    });
    expect(opts.origin).toBe(false);
  });

  it('resolveAllowlist 실패 → fail-closed(origin false)', async () => {
    const d = createWebChatCorsDelegate({
      widgetOrigins: [],
      resolveAllowlist: async () => {
        throw new Error('db');
      },
      defaultOptions,
    });
    const opts = await decide(d, {
      path: '/api/external/executions/e1/interact',
      headers: { origin: 'https://acme.com' },
    });
    expect(opts.origin).toBe(false);
  });

  it('비-웹채팅 경로 → 기존 옵션(credentials true) 유지', async () => {
    const d = createWebChatCorsDelegate({
      widgetOrigins: [],
      resolveAllowlist: async () => [],
      defaultOptions,
    });
    const opts = await decide(d, {
      path: '/api/workflows',
      headers: { origin: 'https://app' },
    });
    expect(opts.credentials).toBe(true);
  });
});
