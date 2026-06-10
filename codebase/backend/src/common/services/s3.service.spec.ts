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

function createService(): S3Service {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        's3.bucket': 'test-bucket',
        's3.endpoint': 'http://localhost:9000',
        's3.region': 'us-east-1',
        's3.accessKey': 'ak',
        's3.secretKey': 'sk',
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
    const keys = [
      ...Array.from({ length: 1000 }, (_, i) => `k${i}`),
      'tail-1',
    ];

    const result = await service.deleteMany(keys);

    // Key 가 없는 Errors 항목은 무시 (S3 응답 방어).
    expect(result).toEqual({ errored: ['bad-1', 'bad-2'] });
  });
});
