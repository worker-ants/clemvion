import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

// S3Client.send 를 가로채기 위한 모듈 mock. Command 클래스들은 입력을 보존하는
// 단순 래퍼로 대체해 send 호출 페이로드를 단언할 수 있게 한다.
const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  class FakeCommand {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: class extends FakeCommand {},
    GetObjectCommand: class extends FakeCommand {},
    DeleteObjectCommand: class extends FakeCommand {},
    DeleteObjectsCommand: class extends FakeCommand {},
  };
});

function createService(overrides: Record<string, string> = {}): S3Service {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        's3.bucket': 'test-bucket',
        's3.endpoint': 'http://localhost:9000',
        's3.region': 'us-east-1',
        's3.accessKey': 'ak',
        's3.secretKey': 'sk',
        's3.publicBaseUrl': 'http://localhost:9000',
        ...overrides,
      };
      return values[key];
    }),
  } as unknown as ConfigService;
  return new S3Service(config);
}

describe('S3Service.deleteMany', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('빈 키 배열이면 API 호출 없이 errored 빈 배열을 반환한다 (청크 경계 0)', async () => {
    const service = createService();
    const result = await service.deleteMany([]);
    expect(result).toEqual({ errored: [] });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('단건 키는 DeleteObjects 1회 호출로 처리한다 (청크 경계 1)', async () => {
    const service = createService();
    sendMock.mockResolvedValueOnce({ Deleted: [{ Key: 'k1' }], Errors: [] });

    const result = await service.deleteMany(['k1']);

    expect(result).toEqual({ errored: [] });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input).toEqual({
      Bucket: 'test-bucket',
      Delete: { Objects: [{ Key: 'k1' }] },
    });
  });

  it('정확히 1000키는 단일 청크로 보낸다 (청크 경계 1000)', async () => {
    const service = createService();
    sendMock.mockResolvedValue({ Errors: [] });
    const keys = Array.from({ length: 1000 }, (_, i) => `k${i}`);

    await service.deleteMany(keys);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0] as {
      input: { Delete: { Objects: unknown[] } };
    };
    expect(cmd.input.Delete.Objects).toHaveLength(1000);
  });

  it('1001키는 1000 + 1 두 청크로 분할한다 (청크 경계 1001 — API 1000키 상한)', async () => {
    const service = createService();
    sendMock.mockResolvedValue({ Errors: [] });
    const keys = Array.from({ length: 1001 }, (_, i) => `k${i}`);

    await service.deleteMany(keys);

    expect(sendMock).toHaveBeenCalledTimes(2);
    const first = sendMock.mock.calls[0][0] as {
      input: { Delete: { Objects: Array<{ Key: string }> } };
    };
    const second = sendMock.mock.calls[1][0] as {
      input: { Delete: { Objects: Array<{ Key: string }> } };
    };
    expect(first.input.Delete.Objects).toHaveLength(1000);
    expect(second.input.Delete.Objects).toHaveLength(1);
    expect(second.input.Delete.Objects[0].Key).toBe('k1000');
  });

  it('응답 Errors 의 key 를 errored 로 수집한다 (부분 실패 — best-effort warn 매핑용)', async () => {
    const service = createService();
    sendMock
      .mockResolvedValueOnce({
        Deleted: [{ Key: 'ok-1' }],
        Errors: [{ Key: 'bad-1', Code: 'AccessDenied' }],
      })
      .mockResolvedValueOnce({
        Errors: [{ Key: 'bad-2', Code: 'InternalError' }, { Code: 'NoKey' }],
      });
    const keys = [...Array.from({ length: 1000 }, (_, i) => `k${i}`), 'tail-1'];

    const result = await service.deleteMany(keys);

    // Key 가 없는 Errors 항목은 무시 (S3 응답 방어).
    expect(result).toEqual({ errored: ['bad-1', 'bad-2'] });
  });
});

/**
 * `getPublicUrl` 은 아바타 업로드(§6.1)가 신설한 메서드다. 소비 테스트들이 `S3Service`
 * 를 통째로 mock 하기 때문에 **이 구현 자체는 어디서도 실행되지 않았다** — 여기서 문다.
 */
describe('S3Service.getPublicUrl', () => {
  it('base + 버킷 + 키를 경로로 잇는다', () => {
    expect(createService().getPublicUrl('avatars/u1/a.png')).toBe(
      'http://localhost:9000/test-bucket/avatars/u1/a.png',
    );
  });

  it('base 의 트레일링 슬래시를 제거한다 (`//` 이중 슬래시 방지)', () => {
    const s = createService({ 's3.publicBaseUrl': 'https://cdn.example///' });
    expect(s.getPublicUrl('avatars/u1/a.png')).toBe(
      'https://cdn.example/test-bucket/avatars/u1/a.png',
    );
  });

  it('세그먼트만 인코딩한다 — `/` 는 경로로 남는다', () => {
    // 키 전체를 `encodeURIComponent` 하면 `/` 가 `%2F` 가 되어 경로가 아니라 한 덩어리
    // 오브젝트명이 된다. 그 구현과 갈라지도록 공백이 든 세그먼트로 확인한다.
    const url = createService().getPublicUrl('avatars/u 1/a b.png');
    expect(url).toBe(
      'http://localhost:9000/test-bucket/avatars/u%201/a%20b.png',
    );
    expect(url).not.toContain('%2F');
  });

  it('s3.publicBaseUrl 이 없으면 endpoint 로 떨어진다 (생성자의 2차 방어)', () => {
    // 생성자 주석이 "설정 모듈이 로드되지 않은 조립에서 `undefined` 가 URL 에 박히는 것을
    // 막는다" 고 주장한다. 리뷰 3라운드 실측으로 **그 주장을 검증하는 테스트가 없었다**
    // (해당 분기를 지워도 81건 전부 GREEN). 주장을 코드에 묶는다.
    const s = createService({
      's3.endpoint': 'http://fallback:9000',
      's3.publicBaseUrl': undefined as unknown as string,
    });
    const url = s.getPublicUrl('avatars/u1/a.png');
    expect(url).toBe('http://fallback:9000/test-bucket/avatars/u1/a.png');
    expect(url).not.toContain('undefined');
  });

  it('publicBaseUrl 이 endpoint 와 달라도 그 값을 쓴다 (내부 주소를 새지 않는다)', () => {
    const s = createService({
      's3.endpoint': 'http://minio:9000',
      's3.publicBaseUrl': 'https://cdn.example',
    });
    const url = s.getPublicUrl('avatars/u1/a.png');
    expect(url).toBe('https://cdn.example/test-bucket/avatars/u1/a.png');
    expect(url).not.toContain('minio');
  });
});
