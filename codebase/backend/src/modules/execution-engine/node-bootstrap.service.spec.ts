import { ALL_NODE_COMPONENTS } from '../../nodes';
import { HandlerDependencies } from '../../nodes/core/node-component.interface';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { WorkflowExecutor } from '../../nodes/core/workflow-executor.interface';
import { NodeHandlerDependenciesProvider } from './handlers/node-handler-dependencies.provider';
import { NodeBootstrapService } from './node-bootstrap.service';

describe('NodeBootstrapService', () => {
  it('onModuleInit 이 WORKFLOW_EXECUTOR 로 build 한 deps 로 ALL_NODE_COMPONENTS 전수를 bootstrap 한다', () => {
    const built = {} as HandlerDependencies;
    const componentRegistry = {
      bootstrap: jest.fn(),
    } as unknown as NodeComponentRegistry;
    const handlerDeps = {
      build: jest.fn().mockReturnValue(built),
    } as unknown as NodeHandlerDependenciesProvider;
    const workflowExecutor = {} as WorkflowExecutor;

    const service = new NodeBootstrapService(
      componentRegistry,
      handlerDeps,
      workflowExecutor,
    );

    service.onModuleInit();

    // 옛 자기참조 `handlerDeps.build(this)` 가 WORKFLOW_EXECUTOR 토큰 주입으로 대체됨.
    expect(handlerDeps.build).toHaveBeenCalledTimes(1);
    expect(handlerDeps.build).toHaveBeenCalledWith(workflowExecutor);

    // 노드 카탈로그 전수가 그대로 registry 로 전달된다 — 컴포넌트 개수를
    // 하드코딩하지 않고 ALL_NODE_COMPONENTS 참조 동일성으로 단언해, 신규 노드
    // 추가 시에도 자동 커버. (각 컴포넌트의 실제 register 동작은
    // node-component.registry.spec.ts 가, 실부팅 전수 등록은 e2e 부팅 스모크가 커버.)
    expect(componentRegistry.bootstrap).toHaveBeenCalledTimes(1);
    expect(componentRegistry.bootstrap).toHaveBeenCalledWith(
      ALL_NODE_COMPONENTS,
      built,
    );
  });

  it('build 결과 객체를 bootstrap 의 deps 인자로 그대로 전달한다 (deps 누락 회귀 가드)', () => {
    const built = { llmService: {} } as unknown as HandlerDependencies;
    const componentRegistry = {
      bootstrap: jest.fn(),
    } as unknown as NodeComponentRegistry;
    const handlerDeps = {
      build: jest.fn().mockReturnValue(built),
    } as unknown as NodeHandlerDependenciesProvider;

    const service = new NodeBootstrapService(
      componentRegistry,
      handlerDeps,
      {} as WorkflowExecutor,
    );
    service.onModuleInit();

    const [componentsArg, depsArg] = (componentRegistry.bootstrap as jest.Mock)
      .mock.calls[0];
    expect(componentsArg).toBe(ALL_NODE_COMPONENTS);
    expect(depsArg).toBe(built);
  });
});
