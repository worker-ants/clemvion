/**
 * 아바타 업로드(§6.1) — **조용히 실패할 수 있는 축**만 고정한다.
 *
 * 사용자 결정(2026-08-31)으로 서빙 전략은 **공개 버킷 + 공개 URL** 이다. 그 선택이
 * 만드는 위험은 셋이고, 셋 다 "동작은 하는데 잘못된 채로 동작" 하는 종류라 테스트가
 * 아니면 눈에 띄지 않는다:
 *
 *  1. **키가 추측 가능해지는 것** — 공개 버킷에서 키는 곧 접근 통제다. `uuid` 가 빠지면
 *     `avatars/{userId}` 만으로 남의 아바타를 열 수 있고, 그래도 업로드는 성공한다.
 *  2. **`Content-Type` 이 클라이언트 값으로 새는 것** — 공개 URL 에서 이 헤더가 브라우저의
 *     렌더 방식을 정한다. `text/html` 이 저장되면 저장형 XSS 다. 업로드는 역시 성공한다.
 *  3. **교체 시 옛 객체가 남는 것** — 고아 객체는 과금·용량으로만 드러나고 기능은 정상이다.
 *
 * 단순 happy-path(업로드하면 URL 이 저장된다)는 위 셋에 자연히 포함되므로 따로 세지 않는다.
 */

import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { S3Service } from '../../common/services/s3.service';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const USER_ID = '11111111-2222-3333-4444-555555555555';

function makeFile(originalname: string): Express.Multer.File {
  return {
    originalname,
    buffer: Buffer.from('binary-image-bytes'),
    // 클라이언트가 보내는 값 — 서비스는 이 값을 **믿지 않아야** 한다.
    mimetype: 'text/html',
  } as unknown as Express.Multer.File;
}

describe('UsersService.updateAvatar (§6.1 — 공개 URL 서빙)', () => {
  let service: UsersService;
  let s3: { upload: jest.Mock; getPublicUrl: jest.Mock; delete: jest.Mock };
  let saved: User | undefined;

  const buildUser = (avatarUrl: string | null): User =>
    ({ id: USER_ID, email: 'a@b.c', avatarUrl }) as unknown as User;

  async function setup(existing: User | null): Promise<void> {
    saved = undefined;
    s3 = {
      upload: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn(
        (key: string) => `https://cdn.example/bucket/${key}`,
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(existing),
      save: jest.fn(async (u: User) => {
        saved = u;
        return u;
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: S3Service, useValue: s3 },
      ],
    }).compile();
    service = module.get(UsersService);
  }

  describe('축 1 — 키는 추측 불가능해야 한다 (공개 버킷의 접근 통제)', () => {
    it('키에 userId 와 **UUID** 가 모두 들어간다', async () => {
      await setup(buildUser(null));
      await service.updateAvatar(USER_ID, makeFile('me.png'));

      const key = s3.upload.mock.calls[0][0] as string;
      expect(key).toMatch(
        new RegExp(
          `^avatars/${USER_ID}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png$`,
        ),
      );
    });

    it('두 번 올리면 키가 서로 다르다 — 고정 키면 이 단언이 깨진다', async () => {
      // 위 정규식만으로는 "UUID 자리에 상수를 박은" 구현을 못 가른다. 같은 인스턴스에서
      // 연속 업로드해 실제로 매번 새 값인지 본다.
      await setup(buildUser(null));
      await service.updateAvatar(USER_ID, makeFile('a.png'));
      await service.updateAvatar(USER_ID, makeFile('b.png'));
      const [k1, k2] = s3.upload.mock.calls.map((c) => c[0] as string);
      expect(k1).not.toBe(k2);
    });
  });

  describe('축 2 — Content-Type 은 클라이언트 값을 쓰지 않는다', () => {
    it('확장자에서 파생한 image/* 를 싣는다 (파일의 mimetype 은 text/html 이어도)', async () => {
      await setup(buildUser(null));
      await service.updateAvatar(USER_ID, makeFile('me.png'));
      expect(s3.upload.mock.calls[0][2]).toBe('image/png');
    });

    it.each([
      ['me.svg', 'SVG — 스크립트를 품을 수 있어 의도적으로 제외'],
      ['me.html', '이미지가 아님'],
      ['me', '확장자 없음'],
    ])('%s 를 거부한다 (%s)', async (name) => {
      await setup(buildUser(null));
      await expect(
        service.updateAvatar(USER_ID, makeFile(name)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(s3.upload).not.toHaveBeenCalled();
    });

    it('빈 파일을 거부한다', async () => {
      await setup(buildUser(null));
      await expect(
        service.updateAvatar(USER_ID, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(s3.upload).not.toHaveBeenCalled();
    });
  });

  describe('축 3 — 교체 시 옛 객체 정리', () => {
    it('우리가 올린 옛 아바타를 지운다', async () => {
      const old = `https://cdn.example/bucket/avatars/${USER_ID}/old-uuid.png`;
      await setup(buildUser(old));
      await service.updateAvatar(USER_ID, makeFile('new.png'));
      expect(s3.delete).toHaveBeenCalledWith(`avatars/${USER_ID}/old-uuid.png`);
    });

    it('base URL 이 바뀐 뒤의 옛 URL 에서도 키를 복원한다', async () => {
      // 저장 시점과 삭제 시점의 `publicBaseUrl` 이 다를 수 있다(도메인 이전·CDN 도입).
      // base 를 걷어내는 방식이면 여기서 키를 못 찾고 조용히 고아가 남는다.
      const old = `http://minio:9000/other-bucket/avatars/${USER_ID}/old.webp`;
      await setup(buildUser(old));
      await service.updateAvatar(USER_ID, makeFile('new.png'));
      expect(s3.delete).toHaveBeenCalledWith(`avatars/${USER_ID}/old.webp`);
    });

    it('남의 아바타 키는 지우지 않는다', async () => {
      const other =
        'https://cdn.example/bucket/avatars/99999999-0000-0000-0000-000000000000/x.png';
      await setup(buildUser(other));
      await service.updateAvatar(USER_ID, makeFile('new.png'));
      expect(s3.delete).not.toHaveBeenCalled();
    });

    it('외부 URL(우리가 올린 것이 아님)은 건드리지 않는다', async () => {
      await setup(buildUser('https://gravatar.example/avatar/abc'));
      await service.updateAvatar(USER_ID, makeFile('new.png'));
      expect(s3.delete).not.toHaveBeenCalled();
    });

    it('정리 실패가 업로드를 깨뜨리지 않는다 (best-effort)', async () => {
      const old = `https://cdn.example/bucket/avatars/${USER_ID}/old.png`;
      await setup(buildUser(old));
      s3.delete.mockRejectedValue(new Error('s3 down'));
      await expect(
        service.updateAvatar(USER_ID, makeFile('new.png')),
      ).resolves.toBeDefined();
      expect(saved?.avatarUrl).toContain('avatars/');
    });

    it('정리는 DB 저장 **뒤에** 일어난다 — 저장이 실패하면 옛 객체가 남아야 한다', async () => {
      const old = `https://cdn.example/bucket/avatars/${USER_ID}/old.png`;
      await setup(buildUser(old));
      const repo = (
        service as unknown as { userRepository: { save: jest.Mock } }
      ).userRepository;
      repo.save.mockRejectedValue(new Error('db down'));

      await expect(
        service.updateAvatar(USER_ID, makeFile('new.png')),
      ).rejects.toThrow('db down');
      // 순서가 뒤집히면 사용자에게 **이미 지워진** 아바타를 가리키는 상태가 남는다.
      expect(s3.delete).not.toHaveBeenCalled();
    });
  });
});
