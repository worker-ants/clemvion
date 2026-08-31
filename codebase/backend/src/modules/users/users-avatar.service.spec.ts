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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

/** 파일 객체는 정상인데 **내용만 비어 있는** 케이스. `!file` 만으로는 못 거른다. */
function makeEmptyFile(): Express.Multer.File {
  return {
    originalname: 'me.png',
    buffer: Buffer.alloc(0),
    mimetype: 'image/png',
  } as unknown as Express.Multer.File;
}

describe('UsersService.updateAvatar (§6.1 — 공개 URL 서빙)', () => {
  let service: UsersService;
  let s3: { upload: jest.Mock; getPublicUrl: jest.Mock; delete: jest.Mock };
  let savedPatch: Partial<User> | undefined;

  const buildUser = (avatarUrl: string | null): User =>
    ({ id: USER_ID, email: 'a@b.c', avatarUrl }) as unknown as User;

  async function setup(existing: User | null): Promise<void> {
    savedPatch = undefined;
    s3 = {
      upload: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn(
        (key: string) => `https://cdn.example/bucket/${key}`,
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(existing),
      // 아바타 갱신은 **컬럼 단위 update** 다 — 스냅샷 전체 save 는 lost update 를 만든다.
      update: jest.fn(async (_id: string, patch: Partial<User>) => {
        savedPatch = patch;
        return undefined;
      }),
      findOneOrFail: jest.fn(async () => ({
        ...(existing ?? ({ id: USER_ID } as User)),
        ...savedPatch,
      })),
      save: jest.fn(() => {
        throw new Error('updateAvatar 는 save() 를 쓰면 안 된다 (lost update)');
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
    // 매핑 **값**을 전수로 문다. 초판은 `png` 하나만 단언해서, `jpg: 'image/jpeg'` 를
    // `'image/jpg'` 로 바꿔도 33건이 전부 GREEN 이었다(리뷰 4라운드 실측). Content-Type 은
    // 공개 URL 에서 브라우저의 렌더 방식을 정하는 보안 경계라 값 하나하나가 계약이다.
    it.each([
      ['me.png', 'image/png'],
      ['me.jpg', 'image/jpeg'],
      ['me.jpeg', 'image/jpeg'],
      ['me.webp', 'image/webp'],
      ['me.gif', 'image/gif'],
    ])(
      '%s → %s 를 싣는다 (파일의 mimetype 은 text/html 이어도)',
      async (name, expected) => {
        await setup(buildUser(null));
        await service.updateAvatar(USER_ID, makeFile(name));
        expect(s3.upload.mock.calls[0][2]).toBe(expected);
      },
    );

    it('대문자 확장자도 정상 처리한다 (ME.PNG)', async () => {
      // 거부 케이스만 있고 **대문자가 통과하는지**를 보는 양성 테스트가 없었다 —
      // `.toLowerCase()` 를 지워도 30건이 전부 GREEN 이었다(리뷰 4라운드 실측).
      await setup(buildUser(null));
      await service.updateAvatar(USER_ID, makeFile('ME.PNG'));
      expect(s3.upload.mock.calls[0][2]).toBe('image/png');
      expect(s3.upload.mock.calls[0][0]).toMatch(/\.png$/);
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

    // 가드는 `!file?.buffer?.length` 라 **두 조건**을 본다. 초판은 `undefined` 하나만
    // 넘겨서, `!file` 로 바꿔 빈-버퍼 방어를 통째로 없애도 GREEN 이었다(리뷰 5라운드 실측).
    // 이름은 "빈 파일" 인데 실제로 검증한 것은 "파일 부재" 였다 — 이 PR 이 다른 곳에서는
    // 경계하던 "분기를 못 가르는 fixture" 가 정작 이 가드에는 적용되지 않았다.
    it.each([
      ['파일 부재', undefined],
      ['파일은 있으나 buffer 가 빈 것', makeEmptyFile()],
    ])('%s 를 거부한다', async (_label, file) => {
      await setup(buildUser(null));
      await expect(service.updateAvatar(USER_ID, file)).rejects.toBeInstanceOf(
        BadRequestException,
      );
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

    it.each([
      ['?v=2', '쿼리스트링'],
      ['#frag', '프래그먼트'],
      ['?v=2#frag', '둘 다'],
    ])('옛 URL 에 %s 가 붙어 있어도 순수 키로 지운다 (%s)', async (suffix) => {
      // 사용자가 `PATCH /users/me` 로 쿼리·프래그먼트가 붙은 URL 을 넣을 수 있다.
      // 그대로 키로 쓰면 S3 에 그런 오브젝트가 없어 삭제가 조용히 실패하고 고아가 남는다.
      // 리뷰 3라운드 실측: 이 분기를 지워도 기존 테스트 27건이 전부 GREEN 이었다.
      const old = `https://cdn.example/bucket/avatars/${USER_ID}/old.png${suffix}`;
      await setup(buildUser(old));
      await service.updateAvatar(USER_ID, makeFile('new.png'));
      expect(s3.delete).toHaveBeenCalledWith(`avatars/${USER_ID}/old.png`);
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
      expect(savedPatch?.avatarUrl).toContain('avatars/');
    });

    it('정리는 DB 저장 **뒤에** 일어난다 — 저장이 실패하면 옛 객체가 남아야 한다', async () => {
      const old = `https://cdn.example/bucket/avatars/${USER_ID}/old.png`;
      await setup(buildUser(old));
      const repo = (
        service as unknown as { userRepository: { update: jest.Mock } }
      ).userRepository;
      repo.update.mockRejectedValue(new Error('db down'));

      await expect(
        service.updateAvatar(USER_ID, makeFile('new.png')),
      ).rejects.toThrow('db down');
      // 순서가 뒤집히면 사용자에게 **이미 지워진** 아바타를 가리키는 상태가 남는다.
      expect(s3.delete).not.toHaveBeenCalled();
    });
  });
});

describe('UsersService.updateAvatar — 정리 실패는 요청을 깨뜨리지 않는다', () => {
  /**
   * 리뷰(2026-08-31)가 잡은 CRITICAL. 첫 판은 `decodeURIComponent` 를 정리 `try` **밖**에
   * 두었다. 옛 `avatarUrl` 에 깨진 퍼센트 인코딩이 있으면 `URIError` 가 전파돼 — 새 파일
   * 업로드와 DB 저장이 **이미 성공한 뒤에** — 클라이언트는 500 을 받았다. 그 값은 사용자가
   * `PATCH /users/me` 로 직접 넣을 수 있고 `@IsUrl` 은 퍼센트 인코딩을 검사하지 않는다.
   *
   * 즉 JSDoc 이 약속한 "정리 실패는 삼킨다" 보다 구현이 좁았다.
   */
  it('옛 URL 의 퍼센트 인코딩이 깨져 있어도 업로드는 성공한다', async () => {
    const s3 = {
      upload: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn((k: string) => `https://cdn.example/bucket/${k}`),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const broken = `https://cdn.example/bucket/avatars/${USER_ID}/%zz.png`;
    const repo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: USER_ID, avatarUrl: broken } as User),
      update: jest.fn().mockResolvedValue(undefined),
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: USER_ID, avatarUrl: 'new' } as User),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: S3Service, useValue: s3 },
      ],
    }).compile();
    const service = module.get(UsersService);

    // 파싱이 try 밖이면 여기서 URIError 가 나 500 이 된다.
    await expect(
      service.updateAvatar(USER_ID, makeFile('new.png')),
    ).resolves.toBeDefined();
    expect(s3.upload).toHaveBeenCalled();
    // 키를 못 읽었으니 삭제는 시도하지 않고 조용히 넘어간다(고아 객체 1개).
    expect(s3.delete).not.toHaveBeenCalled();
  });
});

describe('UsersService.update — PATCH 로 아바타를 바꿔도 옛 객체를 정리한다', () => {
  /**
   * 리뷰(2026-08-31) WARNING. `POST me/avatar` 만 정리하고 `PATCH me` 는 하지 않아,
   * 업로드한 아바타를 PATCH 로 덮으면 S3 객체가 영구 고아로 남았다.
   *
   * 정리 조건이 "페이로드에 avatarUrl 이 있다" 가 아니라 **"값이 달라졌다"** 인 것이
   * 핵심이다 — OAuth 재연동은 같은 URL 을 다시 넘기므로, 값 비교가 없으면 방금 저장한
   * 객체를 지운다.
   */
  const OLD = `https://cdn.example/bucket/avatars/${USER_ID}/old.png`;

  async function build(after: string | null) {
    const s3 = {
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const repo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: USER_ID, avatarUrl: OLD } as User),
      update: jest.fn().mockResolvedValue(undefined),
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: USER_ID, avatarUrl: after } as User),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: S3Service, useValue: s3 },
      ],
    }).compile();
    return { service: module.get(UsersService), s3, repo };
  }

  it('avatarUrl 이 바뀌면 옛 객체를 지운다', async () => {
    const { service, s3 } = await build('https://gravatar.example/x');
    await service.update(USER_ID, { avatarUrl: 'https://gravatar.example/x' });
    expect(s3.delete).toHaveBeenCalledWith(`avatars/${USER_ID}/old.png`);
  });

  it('같은 값이면 지우지 않는다 — OAuth 재연동이 사용 중인 객체를 날리면 안 된다', async () => {
    const { service, s3 } = await build(OLD);
    await service.update(USER_ID, { avatarUrl: OLD });
    expect(s3.delete).not.toHaveBeenCalled();
  });

  it('avatarUrl 이 없는 페이로드는 사전 조회조차 하지 않는다 (호출부 17곳의 비용)', async () => {
    const { service, repo, s3 } = await build(OLD);
    await service.update(USER_ID, { name: 'new name' } as Partial<User>);
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(s3.delete).not.toHaveBeenCalled();
  });
});

describe('UsersService.updateAvatar — 아바타 외의 컬럼을 건드리지 않는다 (lost update)', () => {
  /**
   * 리뷰 2라운드(2026-08-31)가 잡은 CRITICAL. 초판은 S3 업로드 **앞에서** 읽은 엔티티
   * 스냅샷에 `avatarUrl` 만 얹어 `save(user)` 했다. 업로드는 네트워크 I/O 라 수백 ms~수 초
   * 걸리고, 그 사이 다른 요청이 같은 row 를 바꾸면(로그인 실패 카운터·계정 잠금·2FA 등록 —
   * 전부 `usersService.update()` 의 부분 갱신 경로) 뒤늦은 저장이 그 변경을 **조용히 옛
   * 값으로 되돌린다.**
   *
   * 고친 방식은 락이 아니라 **쓰는 컬럼을 줄이는 것**이다. `avatarUrl` 하나만 UPDATE 에
   * 실으면 경쟁 자체가 성립하지 않는다. 그래서 여기서 고정할 것은 "락이 있다" 가 아니라
   * **"UPDATE 페이로드에 avatarUrl 말고 아무것도 없다"** 이다.
   */
  it('update 는 avatarUrl 단 하나만 싣는다', async () => {
    const s3 = {
      upload: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn((k: string) => `https://cdn.example/bucket/${k}`),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const update = jest.fn().mockResolvedValue(undefined);
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        id: USER_ID,
        avatarUrl: null,
        // 업로드가 도는 동안 다른 요청이 바꿀 수 있는 컬럼들.
        loginAttempts: 0,
        lockedUntil: null,
        twoFactorSecret: null,
      } as unknown as User),
      update,
      findOneOrFail: jest.fn().mockResolvedValue({ id: USER_ID } as User),
      save: jest.fn(() => {
        throw new Error('save() 를 쓰면 스냅샷 전체가 실린다');
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: S3Service, useValue: s3 },
      ],
    }).compile();

    await module.get(UsersService).updateAvatar(USER_ID, makeFile('me.png'));

    expect(update).toHaveBeenCalledTimes(1);
    const [id, patch] = update.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(id).toBe(USER_ID);
    // 키 집합을 **정확히** 비교한다 — 하나라도 더 실리면 그 컬럼이 되돌려질 수 있다.
    expect(Object.keys(patch)).toEqual(['avatarUrl']);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('UsersService.updateAvatar — 확장자 화이트리스트는 프로토타입 체인을 타지 않는다', () => {
  /**
   * 리뷰 2라운드 WARNING. `AVATAR_CONTENT_TYPES` 는 일반 객체 리터럴이라
   * `o['constructor']` 같은 상속 이름이 truthy 다. `ext` 는 사용자가 보낸 **파일명**에서
   * 나오므로 `avatar.constructor` 로 화이트리스트를 통과했다.
   *
   * ## 실제로 도달 가능한 것은 2개다 — 리뷰의 "7개" 를 좁힌다
   *
   * 리뷰는 원시 객체에서 7개 이름이 전부 truthy 임을 실측했다. 맞지만 **코드 경로의
   * 성질은 아니다.** `ext` 는 조회 전에 `.toLowerCase()` 를 거치고, `Object.prototype` 의
   * 이름들은 camelCase 라 소문자화하면 사라진다:
   *
   *   constructor → constructor  (히트)      toString → tostring  (미스)
   *   __proto__   → __proto__    (히트)      valueOf  → valueof   (미스) … 나머지도 미스
   *
   * 그래서 **가드를 지웠을 때 실제로 뚫리는 것은 `constructor`·`__proto__` 둘뿐**이고,
   * 뮤테이션도 26건 중 2건만 RED 였다(예측과 일치). 나머지 5개 케이스는 소문자화가 이미
   * 막으므로 이 가드를 가르지 못한다 — 지우지 않고 두되 **왜 vacuous 인지**를 여기 적어,
   * 다음 사람이 "7개를 막는다" 고 오독하지 않게 한다.
   *
   * 도달 가능한 표면이 2개라고 해서 가드가 불필요한 것은 아니다. 우회 하나면 충분하다.
   */
  it.each([
    // ↓ 가드를 지우면 실제로 뚫리는 둘
    'constructor',
    '__proto__',
    // ↓ 아래 다섯은 `.toLowerCase()` 가 이미 막는다 (이 가드를 가르지 못함)
    'toString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
  ])('확장자 %s 를 거부한다', async (ext) => {
    const s3 = {
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
      delete: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
        { provide: S3Service, useValue: s3 },
      ],
    }).compile();

    await expect(
      module.get(UsersService).updateAvatar(USER_ID, makeFile(`a.${ext}`)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(s3.upload).not.toHaveBeenCalled();
  });
});

describe('UsersService.updateAvatar — 사용자 부재 응답이 형제 엔드포인트와 같다', () => {
  /**
   * 리뷰 2라운드 WARNING. `code` 만 싣고 `message` 를 빼면, 같은 `USER_NOT_FOUND` 를 쓰는
   * 형제 엔드포인트(`getMe`·`updateMe`·`changePassword` — 전부 `'User not found'` 포함)와
   * 응답 본문이 갈린다.
   */
  it('code 와 message 를 모두 싣는다', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: S3Service,
          useValue: {
            upload: jest.fn(),
            getPublicUrl: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    await expect(
      module.get(UsersService).updateAvatar(USER_ID, makeFile('me.png')),
    ).rejects.toMatchObject({
      response: { code: 'USER_NOT_FOUND', message: 'User not found' },
    });
  });
});

describe('OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리', () => {
  /**
   * 리뷰 2라운드 WARNING. 이 PR 이 "`avatarUrl` 이 바뀌면 옛 S3 객체를 지운다" 는 불변식을
   * `UsersService.update()` **한 곳에** 심었는데, `auth-oauth.service.ts` 의 `resolveUser()`
   * 는 raw `QueryBuilder` 로 `avatarUrl` 을 직접 써 그 진입점을 지나가지 않는다.
   *
   * **오늘은 고아가 생기지 않는다.** 값 우선순위가 `byEmail.avatarUrl ?? profile.avatarUrl`
   * 이라 이미 올린 아바타가 있으면 그 값이 이기고, 결국 아무것도 바뀌지 않기 때문이다.
   * 우선순위가 뒤집히면(예: 공급자 사진을 우선) 업로드된 객체가 조용히 고아가 되고,
   * 이 PR 의 회귀 테스트는 **어느 것도 그것을 잡지 못한다.**
   *
   * ## 왜 런타임 테스트가 아니라 소스 캐너리인가
   *
   * OAuth stub 모드는 `profile.avatarUrl` 을 **항상 `null`** 로 준다
   * (`auth-oauth.service.ts` `isOAuthStubEnabled()` 분기). 그래서 우선순위를 뒤집어도
   * `byEmail.avatarUrl ?? null` 과 `null ?? byEmail.avatarUrl` 이 같은 값을 내고,
   * 런타임 단언은 **두 분기를 가르지 못한다**(vacuous). 실제로 가르려면 공급자 사진이
   * 있는 fixture 가 필요한데 그건 stub 계약을 바꾸는 일이라 이 PR 범위 밖이다.
   *
   * 그래서 표현식 자체를 고정한다. 이 테스트가 깨지면 **우선순위를 바꾸는 사람이 위 문단을
   * 읽게 되는 것**이 목적이다 — 그때 정리 경로를 함께 손봐야 한다.
   */
  it('resolveUser 는 기존 avatarUrl 을 공급자 사진보다 우선한다', () => {
    const src = readFileSync(
      join(__dirname, '../auth/auth-oauth.service.ts'),
      'utf-8',
    );
    expect(src).toContain(
      'avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? undefined,',
    );
  });
});
