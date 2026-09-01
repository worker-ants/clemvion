/**
 * `incrementLoginAttempts` 원자성 회귀.
 *
 * 이 메서드는 **테스트가 하나도 없었다** — 유일한 참조가 `auth.service.spec.ts` 의 mock
 * 이었다(리뷰 7라운드에서 확인). 그 상태로 read-modify-write(`findOneOrFail` → 필드 수정
 * → `save(user)`)를 하고 있었고, 아바타 업로드가 들어오면서 **데이터를 깨는 경쟁**이 됐다:
 *
 *   1. 로그인 실패 요청이 user 를 읽는다 (avatarUrl = 옛 URL)
 *   2. 아바타 업로드가 avatarUrl 을 새 값으로 바꾸고 **옛 S3 객체를 지운다**
 *   3. 1의 `save(user)` 가 커밋 → DB 가 **이미 삭제된 객체를 가리키는 옛 URL** 로 되돌아간다
 *
 * `updateAvatar` 는 정확히 이 상태("사용자에게 이미 지워진 아바타 URL 이 남는다")를 막으려고
 * 정리를 저장 뒤로 미뤘는데, 반대편 writer 가 그 보장을 무효로 만들고 있었다.
 *
 * 그래서 여기서 고정하는 것은 "잠금이 동작한다" 가 아니라 **"이 메서드가 자기 컬럼 둘 말고는
 * 아무것도 쓰지 않는다"** 이다.
 */

import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { S3Service } from '../../common/services/s3.service';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const USER_ID = '11111111-2222-3333-4444-555555555555';

async function build(queryResult: unknown) {
  const query = jest.fn().mockResolvedValue(queryResult);
  const repo = {
    query,
    // 이 셋이 호출되면 read-modify-write 로 되돌아간 것이다 — 시끄럽게 실패시킨다.
    findOne: jest.fn(() => {
      throw new Error('read-modify-write 로 회귀했다');
    }),
    findOneOrFail: jest.fn(() => {
      throw new Error('read-modify-write 로 회귀했다');
    }),
    save: jest.fn(() => {
      throw new Error(
        'save(user) 는 스냅샷 전체를 쓴다 — 다른 컬럼을 되돌린다',
      );
    }),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      UsersService,
      { provide: getRepositoryToken(User), useValue: repo },
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
  return { service: module.get(UsersService), query, repo };
}

describe('UsersService.incrementLoginAttempts — 원자 UPDATE', () => {
  it('단일 문장으로 처리한다 — 사전 조회도, 엔티티 저장도 없다', async () => {
    const { service, query, repo } = await build([[{ login_attempts: 1 }], 1]);
    await service.incrementLoginAttempts(USER_ID);

    expect(query).toHaveBeenCalledTimes(1);
    expect(repo.findOneOrFail).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('SET 절이 login_attempts 와 locked_until 만 쓴다 (avatarUrl 을 되돌리지 않는다)', async () => {
    // **이 단언이 이 파일의 존재 이유다.** 스냅샷 전체 저장으로 되돌아가면 아바타 URL 이
    // 이미 삭제된 객체를 가리키는 상태로 복구된다.
    const { service, query } = await build([[{ login_attempts: 1 }], 1]);
    await service.incrementLoginAttempts(USER_ID);

    const sql = (query.mock.calls[0][0] as string).replace(/\s+/g, ' ');
    const setClause = sql.slice(sql.indexOf('SET'), sql.indexOf('WHERE'));
    const columns = [...setClause.matchAll(/(\w+)\s*=/g)].map((m) => m[1]);
    expect(new Set(columns)).toEqual(
      new Set(['login_attempts', 'locked_until']),
    );
    expect(sql).not.toContain('avatar_url');
  });

  it('RETURNING 이 돌려준 새 카운트를 반환한다 (읽은 값이 아니라)', async () => {
    const { service } = await build([[{ login_attempts: 4 }], 1]);
    await expect(service.incrementLoginAttempts(USER_ID)).resolves.toBe(4);
  });

  it('임계값·잠금 시간을 상수에서 파라미터로 넘긴다 (SQL 리터럴에 숨지 않는다)', async () => {
    const { service, query } = await build([[{ login_attempts: 5 }], 1]);
    await service.incrementLoginAttempts(USER_ID);

    expect(query.mock.calls[0][1]).toEqual([
      USER_ID,
      UsersService.LOGIN_LOCK_THRESHOLD,
      UsersService.LOGIN_LOCK_MINUTES,
    ]);
  });

  it('잠금 시각을 앱 시계가 아니라 DB NOW() 로 잡는다', async () => {
    // 앱 서버가 여럿이면 `new Date(Date.now() + …)` 는 인스턴스마다 달라진다.
    const { service, query } = await build([[{ login_attempts: 5 }], 1]);
    await service.incrementLoginAttempts(USER_ID);
    expect(query.mock.calls[0][0] as string).toContain('NOW()');
  });

  it('없는 사용자면 NotFoundException — 종전 findOneOrFail 과 같은 계약', async () => {
    const { service } = await build([[], 0]);
    await expect(
      service.incrementLoginAttempts(USER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
