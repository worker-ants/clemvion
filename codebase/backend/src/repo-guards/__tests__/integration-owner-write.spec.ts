import * as path from 'node:path';
import {
  INTEGRATION_OWNER_WRITES,
  UNLOCKED_INTEGRATION_OWNER_WRITES,
  findIntegrationOwnerWrites,
  listIntegrationOwnerWrites,
} from './integration-owner-write-guard';

/**
 * 개인 통합 행을 만들거나 개인으로 바꾸는 경로가 모두 쓰기 잠금 도우미를 거치게 한다(CLE-INT-MANAGE REQ-INTMGMT-066 ·
 * 067, NERV Task `CLE-T-PS7JQY`).
 *
 * 멤버가 나가거나 제거되면 멤버십을 지우는 트랜잭션이 그 사람의 개인 통합을 지운다. 그 사이 같은 사람의 개인 통합 행을
 * 새로 만들면 지운 뒤에 남는다. 그래서 통합 행을 만드는 쓰기는 워크스페이스 → 멤버십 순으로 잠그고 멤버십을 다시 읽는다
 * (`integration-owner-write-lock.ts`). 이 잠금을 건너뛰는 새 생성 경로가 생기면 나간 멤버의 개인 통합이 다시 남으므로,
 * 통합 행을 만들거나 공개 범위를 바꾸는 지점을 전부 세어 허용 목록과 맞추고 각 지점이 도우미를 부르는지 본다.
 *
 * 새 지점이 걸리면 그 경로가 개인 통합 행을 만들 수 있는지 보고 도우미를 부르게 한 뒤 `INTEGRATION_OWNER_WRITES` 에
 * 적는다. 개인 행을 만들지 않는 지점은 이유를 적고 `UNLOCKED_INTEGRATION_OWNER_WRITES` 에도 올린다.
 */
describe('통합 행 생성 · 공개 범위 변경 지점의 쓰기 잠금', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const srcDir = path.resolve(__dirname, '../..');
  const found = listIntegrationOwnerWrites(repoRoot, srcDir);

  it('통합 행을 만들거나 공개 범위를 바꾸는 지점이 허용 목록과 같다', () => {
    expect(found.map((w) => w.key)).toEqual(
      Object.keys(INTEGRATION_OWNER_WRITES).sort(),
    );
  });

  it('잠금 면제 목록 밖의 지점은 모두 쓰기 잠금 도우미를 부른다', () => {
    const unlocked = found
      .filter((w) => !w.locked)
      .map((w) => w.key)
      .sort();
    expect(unlocked).toEqual([...UNLOCKED_INTEGRATION_OWNER_WRITES].sort());
  });

  it('[전제] 스캔이 실제 생성 · 전환 경로 넷 이상을 찾고 그 경로들이 잠근다', () => {
    const locked = found.filter((w) => w.locked).map((w) => w.key);
    expect(locked.length).toBeGreaterThanOrEqual(4);
    expect(locked).toEqual(
      expect.arrayContaining([
        'codebase/backend/src/modules/integrations/integrations.service.ts::create',
        'codebase/backend/src/modules/integrations/integrations.service.ts::switchToPersonalLocked',
        'codebase/backend/src/modules/integrations/integration-oauth.service.ts::writePrivatePending',
        'codebase/backend/src/modules/integrations/integration-oauth.service.ts::writeMakeshopPendingTx',
      ]),
    );
  });
});

describe('findIntegrationOwnerWrites', () => {
  it.each<[string, string]>([
    [
      '@InjectRepository(Integration) 저장소의 create',
      `class S {
         constructor(@InjectRepository(Integration) private readonly integrationRepository: Repository<Integration>) {}
         async a() { const e = this.integrationRepository.create(body); await this.integrationRepository.save(e); }
       }`,
    ],
    [
      'getRepository(Integration) 변수의 create',
      `async function a(manager) { const repo = manager.getRepository(Integration); await repo.save(repo.create(row)); }`,
    ],
    [
      'Repository<Integration> 형 매개변수의 insert',
      `async function a(integrations: Repository<Integration>) { await integrations.insert(row); }`,
    ],
    [
      'getRepository(Integration) 에 바로 이은 scope update',
      `async function a(manager) { await manager.getRepository(Integration).update({ id }, { scope: 'personal' }); }`,
    ],
    [
      '쿼리 빌더 insert().into(Integration)',
      `async function a(qb) { await qb.insert().into(Integration).values(rows).execute(); }`,
    ],
    [
      '원시 SQL INSERT INTO integration',
      `async function a(m) { await m.query('INSERT INTO integration (id) VALUES ($1)', []); }`,
    ],
  ])('%s 를 잡는다', (_label, source) => {
    expect(findIntegrationOwnerWrites(source)).toEqual([
      { scope: 'a', locked: false },
    ]);
  });

  // 음성 fixture: 같은 쓰기에 도우미가 있으면 locked, 빠지면 unlocked 다. 빠진 쪽이 허용 목록 대조를 RED 로 만든다.
  it('같은 함수가 쓰기 잠금 도우미를 부르면 locked, 건너뛰면 unlocked 다', () => {
    const withLock = `class S {
      async create(body) {
        const entity = this.integrationRepository.create(body);
        return this.dataSource.transaction(async (manager) => {
          throwUnlessIntegrationCreateLocked(await lockForIntegrationWrite(manager, target));
          return manager.getRepository(Integration).save(entity);
        });
      }
      constructor(@InjectRepository(Integration) private readonly integrationRepository: Repository<Integration>) {}
    }`;
    const skipped = withLock.replace(
      'throwUnlessIntegrationCreateLocked(await lockForIntegrationWrite(manager, target));',
      '',
    );
    expect(skipped).not.toBe(withLock);

    expect(findIntegrationOwnerWrites(withLock)).toEqual([
      { scope: 'create', locked: true },
    ]);
    expect(findIntegrationOwnerWrites(skipped)).toEqual([
      { scope: 'create', locked: false },
    ]);
  });

  it('감싼 도우미(lockForPendingWrite)도 잠금으로 센다', () => {
    const source = `class S {
      writePending(params) {
        return this.dataSource.transaction(async (manager) => {
          await lockForPendingWrite(manager, params);
          const repo = manager.getRepository(Integration);
          return repo.save(repo.create(row));
        });
      }
    }`;
    expect(findIntegrationOwnerWrites(source)).toEqual([
      { scope: 'writePending', locked: true },
    ]);
  });

  it('다른 함수의 도우미 호출은 이 함수의 잠금으로 세지 않는다', () => {
    const source = `class S {
      locks(manager) { return lockForIntegrationWrite(manager, target); }
      writes(manager) { const repo = manager.getRepository(Integration); return repo.save(repo.create(row)); }
    }`;
    expect(findIntegrationOwnerWrites(source)).toEqual([
      { scope: 'writes', locked: false },
    ]);
  });

  it.each<[string, string]>([
    [
      '다른 엔티티의 create',
      `async function a(manager) { const repo = manager.getRepository(OAuthState); await repo.save(repo.create(row)); }`,
    ],
    [
      '통합 저장소의 scope 아닌 update · save · delete',
      `async function a(integrations: Repository<Integration>) {
         await integrations.update({ id }, { status: 'connected' });
         await integrations.save(entity);
         await integrations.delete({ id });
       }`,
    ],
    [
      'integration_usage_log 원시 SQL',
      `async function a(m) { await m.query('INSERT INTO integration_usage_log (id) VALUES ($1)', []); }`,
    ],
    [
      '주석 속 생성',
      `async function a() { /* INSERT INTO integration */ // repo.create(row) with getRepository(Integration)
       }`,
    ],
  ])('%s 는 잡지 않는다', (_label, source) => {
    expect(findIntegrationOwnerWrites(source)).toEqual([]);
  });
});
