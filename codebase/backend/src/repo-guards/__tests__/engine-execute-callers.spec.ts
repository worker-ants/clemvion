import * as path from 'node:path';
import {
  ENGINE_ENTRY_CALLERS,
  type EngineCallerListing,
  diffEngineCallers,
  listEngineCallers,
  scanEngineCalls,
} from './engine-execute-callers-guard';

/**
 * 엔진에서 워크플로우를 실행하는 지점이 모두 워크플로우 활성 관문 목록이나 면제 목록에 있게 한다
 * (CLE-TRIG-DATA 「워크플로우 활성 관문」, NERV Task `CLE-T-BMRXCS`).
 *
 * 관문(`isWorkflowInactive`)은 엔진 `execute()` 안이 아니라 진입 경로마다 호출부에 있다. 엔진은 관문을 거치는
 * 경로와 거치지 않는 경로를 `triggerId` · `executedBy` 로 가를 수 있지만 막아야 하는 자리가 `execute()` 보다
 * 앞이라 엔진에 백스톱을 두지 않았다(CLE-TRIG-DATA Rationale 「왜 엔진이 아니라 호출부에서 확인하는가」).
 * 그래서 새 진입 경로가 관문 없이 엔진을 부르면 런타임에는 막을 장치가 없다. 이 테스트가 그 누락을 CI 에서 잡는다.
 *
 * 새 지점이 걸리면 그 경로가 외부 이벤트로 새 실행을 만드는지 정한다. 만들면 관문을 거치게 하고 `gated` 로,
 * 사람이 직접 시작하거나 이미 시작된 실행의 한 단계면 이유를 적어 `exempt` 로 `ENGINE_ENTRY_CALLERS` 에 올린다.
 * CLE-TRIG-DATA 「워크플로우 활성 관문」 의 경로 표나 「관문을 거치지 않는 경로」 에도 함께 더한다.
 *
 * 한계: `gated` 지점은 같은 함수 안에서 관문 호출이 진입 호출보다 소스상 앞에 있는지까지만 본다. 관문이 분기
 * 안에 있어 실제로는 거치지 않는 경로, 형 주석 없이 받은 엔진(구조분해 · 별칭 타입), 같은 파일의 같은 이름
 * 함수 둘은 가리지 못한다.
 */
describe('엔진 실행 진입 호출 지점 허용 목록', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const srcDir = path.resolve(__dirname, '../..');
  const listing = listEngineCallers(repoRoot, srcDir);
  const { entryCalls, gateScopes } = listing;
  const mismatch = diffEngineCallers(listing, ENGINE_ENTRY_CALLERS);

  it('엔진 진입 메서드를 부르는 지점이 허용 목록과 같다', () => {
    expect({ unlisted: mismatch.unlisted, stale: mismatch.stale }).toEqual({
      unlisted: [],
      stale: [],
    });
  });

  it('gated 지점은 같은 함수 안에서 엔진보다 먼저 isWorkflowInactive 를 부른다', () => {
    expect(mismatch.gatedWithoutGateFirst).toEqual([]);
  });

  it('isWorkflowInactive 를 부르는 함수는 모두 gated 지점이다', () => {
    expect(mismatch.gateOutsideGated).toEqual([]);
  });

  it('[전제] 스캔이 실제 진입 지점과 관문 호출을 찾는다', () => {
    expect(entryCalls).toContain(
      'codebase/backend/src/modules/hooks/hooks.service.ts::handleWebhook::execute',
    );
    expect(entryCalls).toContain(
      'codebase/backend/src/nodes/flow/workflow/workflow.handler.ts::execute::executeInline',
    );
    expect(gateScopes).toContain(
      'codebase/backend/src/modules/schedules/schedule-runner.service.ts::process',
    );
  });
});

describe('diffEngineCallers', () => {
  const allowlist = {
    'a.ts::hook::execute': { kind: 'gated', reason: 'r' },
    'a.ts::manual::execute': { kind: 'exempt', reason: 'r' },
  } as const;
  const clean: EngineCallerListing = {
    entryCalls: ['a.ts::hook::execute', 'a.ts::manual::execute'],
    gateScopes: ['a.ts::hook'],
    entryCallsBeforeGate: ['a.ts::manual::execute'],
  };
  const none = {
    unlisted: [],
    stale: [],
    gatedWithoutGateFirst: [],
    gateOutsideGated: [],
  };

  it('스캔과 허용 목록이 맞으면 어긋남이 없다', () => {
    expect(diffEngineCallers(clean, allowlist)).toEqual(none);
  });

  it('목록에 없는 진입 지점과 사라진 목록 항목을 낸다', () => {
    const listing = {
      ...clean,
      entryCalls: ['a.ts::hook::execute', 'a.ts::newRoute::execute'],
      entryCallsBeforeGate: ['a.ts::newRoute::execute'],
    };
    expect(diffEngineCallers(listing, allowlist)).toEqual({
      ...none,
      unlisted: ['a.ts::newRoute::execute'],
      stale: ['a.ts::manual::execute'],
    });
  });

  it('관문보다 앞서 엔진을 부르는 gated 지점을 낸다', () => {
    const listing = {
      ...clean,
      entryCallsBeforeGate: ['a.ts::hook::execute', 'a.ts::manual::execute'],
    };
    expect(diffEngineCallers(listing, allowlist).gatedWithoutGateFirst).toEqual(
      ['a.ts::hook::execute'],
    );
  });

  it('gated 가 아닌 함수의 관문 호출을 낸다', () => {
    const listing = { ...clean, gateScopes: ['a.ts::hook', 'a.ts::manual'] };
    expect(diffEngineCallers(listing, allowlist).gateOutsideGated).toEqual([
      'a.ts::manual',
    ]);
  });
});

describe('scanEngineCalls', () => {
  it.each<[string, string, string[]]>([
    [
      'ExecutionEngineService 주입 속성의 execute',
      `class S {
         constructor(private readonly executionEngineService: ExecutionEngineService) {}
         async a() { await this.executionEngineService.execute(id, {}, opts); }
       }`,
      ['a::execute'],
    ],
    [
      'WorkflowExecutor 주입 속성의 executeAsync · executeInline',
      `class H {
         constructor(private readonly executionEngine: WorkflowExecutor) {}
         async a() {
           await this.executionEngine.executeAsync(id, {});
           await this.executionEngine.executeInline(id, {}, o);
         }
       }`,
      ['a::executeAsync', 'a::executeInline'],
    ],
    [
      '엔진 형 매개변수의 executeSync',
      `async function a(engine: ExecutionEngineService) { await engine.executeSync(id); }`,
      ['a::executeSync'],
    ],
    [
      '엔진 클래스 안의 this.executeInline',
      `class ExecutionEngineService {
         async a() { await this.executeInline(id, {}, o); }
       }`,
      ['a::executeInline'],
    ],
    [
      '옵셔널 체이닝 · non-null 단언',
      `class S {
         constructor(private readonly engine: ExecutionEngineService) {}
         async a() { await this.engine?.execute(id); await this.engine!.executeSync(id); }
       }`,
      ['a::execute', 'a::executeSync'],
    ],
    [
      '엔진 형 단언',
      `async function a(x: unknown) { await (x as WorkflowExecutor).executeAsync(id, {}); }`,
      ['a::executeAsync'],
    ],
    [
      '괄호로 감싼 수신자',
      `class S {
         constructor(private readonly engine: ExecutionEngineService) {}
         async a() { await (this.engine).execute(id); }
       }`,
      ['a::execute'],
    ],
    [
      '앵글 괄호 형 단언',
      `async function a(x: unknown) { await (<WorkflowExecutor>x).executeInline(id, {}, o); }`,
      ['a::executeInline'],
    ],
    [
      '엔진 형 이름을 단언 밖에서 받은 수신자의 any 단언',
      `async function a(engine: ExecutionEngineService) { await (engine as any).execute(id); }`,
      ['a::execute'],
    ],
    [
      '한 함수 안의 같은 진입 호출 두 번은 한 지점',
      `async function a(engine: ExecutionEngineService) { await engine.execute(1); await engine.execute(2); }`,
      ['a::execute'],
    ],
  ])('%s 를 잡는다', (_label, source, expected) => {
    expect(scanEngineCalls(source).entryCalls).toEqual(expected);
  });

  it.each<[string, string]>([
    [
      '쿼리 빌더의 execute',
      `async function a(repo) { await repo.createQueryBuilder().update().set({}).execute(); }`,
    ],
    [
      '노드 핸들러의 execute',
      `async function a(handler: NodeHandler) { return handler.execute(input, config, ctx); }`,
    ],
    [
      '엔진이 아닌 클래스의 this.execute',
      `class Other { async a() { await this.execute(); } async execute() {} }`,
    ],
    [
      '엔진이 아닌 형으로 단언한 수신자',
      `async function a(x: unknown) { await (x as Other).execute(); }`,
    ],
    [
      '이중 단언으로 엔진이 아닌 형이 된 수신자',
      `async function a(x: unknown) { await (x as unknown as Foo).execute(); }`,
    ],
    [
      '엔진 서비스의 다른 메서드',
      `class S {
         constructor(private readonly engine: ExecutionEngineService) {}
         async a() { await this.engine.runExecutionFromQueue(id); }
       }`,
    ],
  ])('%s 는 잡지 않는다', (_label, source) => {
    expect(scanEngineCalls(source).entryCalls).toEqual([]);
  });

  it('isWorkflowInactive 를 부르는 함수를 모은다', () => {
    const source = `class S {
      async a() { if (await isWorkflowInactive(repo, id, ws)) return; }
      async b() { await other(repo); }
    }`;
    expect(scanEngineCalls(source).gateScopes).toEqual(['a']);
  });

  it('관문보다 앞서거나 관문 없이 부르는 진입 호출을 가린다', () => {
    const source = `class S {
      constructor(private readonly engine: ExecutionEngineService) {}
      async gated() { if (await isWorkflowInactive(r, id, ws)) return; await this.engine.execute(id); }
      async late() { await this.engine.execute(id); await isWorkflowInactive(r, id, ws); }
      async none() { await this.engine.execute(id); }
    }`;
    expect(scanEngineCalls(source).entryCallsBeforeGate).toEqual([
      'late::execute',
      'none::execute',
    ]);
  });

  it.each<[string, string, string[]]>([
    [
      '관문이 둘이면 가장 앞선 관문을 기준으로 삼는다',
      `class S {
        constructor(private readonly engine: ExecutionEngineService) {}
        async a() {
          if (await isWorkflowInactive(r, id, ws)) return;
          await this.engine.execute(id);
          if (await isWorkflowInactive(r, id2, ws)) return;
        }
      }`,
      [],
    ],
    [
      '진입 호출 사이에 관문이 끼면 앞선 진입 호출을 낸다',
      `class S {
        constructor(private readonly engine: ExecutionEngineService) {}
        async a() {
          await this.engine.executeAsync(id, {});
          if (await isWorkflowInactive(r, id, ws)) return;
          await this.engine.execute(id);
        }
      }`,
      ['a::executeAsync'],
    ],
  ])('%s', (_label, source, expected) => {
    expect(scanEngineCalls(source).entryCallsBeforeGate).toEqual(expected);
  });

  it('[알려진 한계] 구조분해로 꺼낸 진입 메서드는 잡지 못한다', () => {
    const source = `async function a(engine: ExecutionEngineService) {
      const { execute } = engine;
      await execute(id);
    }`;
    expect(scanEngineCalls(source).entryCalls).toEqual([]);
  });
});
