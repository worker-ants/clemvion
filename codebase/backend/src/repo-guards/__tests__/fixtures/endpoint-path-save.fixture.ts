/**
 * `findTriggerRepositorySaves` 의 **양성/음성 대조군**.
 *
 * ## 왜 필요한가
 *
 * *"현재 저장소가 규칙을 지킨다"* 와 *"이 함수가 위반을 잡는다"* 는 **다른 주장**이다.
 * 전자만 단언하면 술어를 넓혀도(예: `.catch` 체인 존재만 보게 해도) 스위트가 초록이다 —
 * 형제 가드가 실제로 그 구멍에 당했다 (`review/code/2026/09/06/11_55_36` W1).
 *
 * 이 파일은 프로덕션 스캔 범위(`src/modules/triggers`) **밖**이라 베이스라인을 오염시키지
 * 않는다. 형제 fixture(`user-relation-load.fixture.ts`)와 같은 규율로, `any` 대신 **가짜
 * 타입**을 선언해 lint 경고 없이 형태만 흉내 낸다.
 */

interface FakeRepo {
  save(entity: unknown): Promise<unknown>;
  readonly manager: FakeManager;
}

interface FakeManager {
  save(entity: unknown, target: unknown): Promise<unknown>;
  transaction<T>(cb: (m: FakeManager) => Promise<T>): Promise<T>;
}

declare const triggerRepo: FakeRepo;
declare const scheduleRepo: FakeRepo;
/** `EntityManager.save(Trigger, …)` 형태를 흉내 내기 위한 가짜 엔티티 클래스. */
declare const Trigger: new () => unknown;
declare const Execution: new () => unknown;

export class FixtureService {
  private readonly triggerRepository: FakeRepo = triggerRepo;
  private readonly scheduleRepository: FakeRepo = scheduleRepo;

  /** 양성 — 래핑 없는 `triggerRepository.save`. */
  async unwrappedSave(t: unknown): Promise<void> {
    await this.triggerRepository.save(t);
  }

  /** 음성 — 충돌 래퍼를 부르는 `.catch` 가 붙었다. */
  async wrappedSave(t: unknown): Promise<void> {
    await this.triggerRepository
      .save(t)
      .catch((err: unknown) => this.rethrowEndpointPathConflict(err));
  }

  /**
   * 양성 — `.catch` 는 있으나 **다른 것을 한다.** 체인 존재만 보면 통과시키는 형태라,
   * 이 대조군이 없으면 술어가 *"`.catch` 가 있는가"* 로 넓어져도 아무도 모른다.
   */
  async catchButNotWrapping(t: unknown): Promise<void> {
    await this.triggerRepository.save(t).catch(() => undefined);
  }

  /**
   * 양성 — 콜백이 래퍼 **이름만 언급**하고 부르지는 않는다. `.catch` 전체 텍스트에 이름이
   * 들어 있는지만 보면 이 형태가 **래핑됨으로 통과**한다(fail-open).
   */
  async mentionsButDoesNotCall(t: unknown): Promise<void> {
    await this.triggerRepository.save(t).catch(() => {
      // rethrowEndpointPathConflict 를 여기서 부르는 게 맞지만 아직 안 했다.
      return undefined;
    });
  }

  /**
   * 음성 — **변수 선언을 경유하는 wrap.** `const saved = await repo.save(t).catch(...)` 는
   * 프로덕션 `create`/`update` 가 실제로 쓰는 형태이고, 신규 가드가 처음에 이 자리를
   * `#saved` 로 잘못 이름 붙였던 회귀 형태이기도 하다. 프로덕션 파일의 **우연한 모양**에
   * 기대지 않도록 여기서 직접 고정한다 (`review/code/2026/09/08/13_34_28` testing INFO#4).
   */
  async wrappedViaVariable(t: unknown): Promise<unknown> {
    const saved = await this.triggerRepository
      .save(t)
      .catch((err: unknown) => this.rethrowEndpointPathConflict(err));
    return saved;
  }

  /** 음성 — **다른 리포지토리**의 save 는 이 가드 대상이 아니다. */
  async otherRepositorySave(s: unknown): Promise<void> {
    await this.scheduleRepository.save(s);
  }

  /** 양성 둘 — 같은 메서드 안의 두 번째 호출은 `#2` 로 갈린다. */
  async twoSaves(a: unknown, b: unknown): Promise<void> {
    await this.triggerRepository.save(a);
    await this.triggerRepository.save(b);
  }

  /**
   * 음성 — **트랜잭션 콜백 안의 `manager.save(Trigger, …)`** 이고 `.catch` 는 바깥 체인에
   * 붙었다. 프로덕션 `update` 가 실제로 쓰는 형태이고, 종전 가드가 (a) 수신자 이름이
   * 달라서 저장을 **놓치고** (b) 놓치지 않았더라도 콜백 경계에서 멈춰 **미래핑으로 읽던**
   * 두 결함을 한 자리에서 고정한다.
   */
  async managerSaveWrapped(t: unknown): Promise<unknown> {
    return this.triggerRepository.manager
      .transaction(async (m) => m.save(Trigger, t))
      .catch((err: unknown) => this.rethrowEndpointPathConflict(err));
  }

  /** 양성 — 같은 형태인데 래핑이 없다. */
  async managerSaveUnwrapped(t: unknown): Promise<unknown> {
    return this.triggerRepository.manager.transaction(async (m) =>
      m.save(Trigger, t),
    );
  }

  /** 음성 — **다른 엔티티**의 manager save 는 이 가드 대상이 아니다. */
  async managerSaveOtherEntity(x: unknown): Promise<unknown> {
    return this.triggerRepository.manager.transaction(async (m) =>
      m.save(Execution, x),
    );
  }

  private rethrowEndpointPathConflict(err: unknown): never {
    throw err;
  }
}
