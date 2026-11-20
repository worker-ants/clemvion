import * as path from 'node:path';
import {
  ENGINE_ENTRY_CALLERS,
  callerScope,
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
 */
describe('엔진 실행 진입 호출 지점 허용 목록', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const srcDir = path.resolve(__dirname, '../..');
  const { entryCalls, gateScopes } = listEngineCallers(repoRoot, srcDir);

  it('엔진 진입 메서드를 부르는 지점이 허용 목록과 같다', () => {
    expect(entryCalls).toEqual(Object.keys(ENGINE_ENTRY_CALLERS).sort());
  });

  it('gated 지점은 같은 함수 안에서 isWorkflowInactive 를 부른다', () => {
    const gated = Object.entries(ENGINE_ENTRY_CALLERS)
      .filter(([, v]) => v.kind === 'gated')
      .map(([k]) => callerScope(k))
      .sort();
    expect(gated.filter((scope) => !gateScopes.includes(scope))).toEqual([]);
  });

  it('isWorkflowInactive 를 부르는 함수는 모두 gated 지점이다', () => {
    const gated = new Set(
      Object.entries(ENGINE_ENTRY_CALLERS)
        .filter(([, v]) => v.kind === 'gated')
        .map(([k]) => callerScope(k)),
    );
    expect(gateScopes.filter((scope) => !gated.has(scope))).toEqual([]);
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
});
