import { ALL_NODE_COMPONENTS } from '../../nodes';
import {
  HandlerDependencies,
  NodeComponent,
} from '../../nodes/core/node-component.interface';
import { NODE_CATEGORIES } from '../../nodes/core/categories';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { WorkflowExecutor } from '../../nodes/core/workflow-executor.interface';
import { NodeHandlerDependenciesProvider } from './handlers/node-handler-dependencies.provider';
import { NodeBootstrapService } from './node-bootstrap.service';

function setup(components: NodeComponent[]) {
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
    components,
  );
  return { service, componentRegistry, handlerDeps, workflowExecutor, built };
}

function bootstrapArgs(componentRegistry: NodeComponentRegistry): {
  components: NodeComponent[];
  deps: unknown;
} {
  const [components, deps] = (componentRegistry.bootstrap as jest.Mock).mock
    .calls[0] as [NodeComponent[], unknown];
  return { components, deps };
}

describe('NodeBootstrapService', () => {
  it('onModuleInit 이 WORKFLOW_EXECUTOR 로 build 한 deps 로 주입된 NODE_COMPONENT 전수를 bootstrap 한다', () => {
    // M-5 레이어1 — 카탈로그를 정적 import 가 아닌 NODE_COMPONENT DI 주입으로 받는다.
    const { service, componentRegistry, handlerDeps, workflowExecutor, built } =
      setup([...ALL_NODE_COMPONENTS]);

    service.onModuleInit();

    // 옛 자기참조 `handlerDeps.build(this)` 가 WORKFLOW_EXECUTOR 토큰 주입으로 대체됨.
    expect(handlerDeps.build).toHaveBeenCalledTimes(1);
    expect(handlerDeps.build).toHaveBeenCalledWith(workflowExecutor);

    expect(componentRegistry.bootstrap).toHaveBeenCalledTimes(1);
    const { components, deps } = bootstrapArgs(componentRegistry);
    // 주입 전수가 그대로 전달된다(집합 동일) — 정렬되므로 배열 참조/순서 동일성은 아님.
    expect(new Set(components)).toEqual(new Set(ALL_NODE_COMPONENTS));
    expect(components).toHaveLength(ALL_NODE_COMPONENTS.length);
    expect(deps).toBe(built);
  });

  it('주입 순서와 무관하게 (카테고리 order, type) 로 결정적 정렬해 bootstrap 한다', () => {
    // 일부러 뒤집은 입력 — 정렬이 import/주입 순서에 비의존임을 가드.
    const { service, componentRegistry } = setup(
      [...ALL_NODE_COMPONENTS].reverse(),
    );

    service.onModuleInit();

    const { components } = bootstrapArgs(componentRegistry);
    const categoryOrder = new Map<string, number>(
      NODE_CATEGORIES.map((c) => [c.id, c.order]),
    );
    const orderOf = (c: NodeComponent) =>
      categoryOrder.get(c.metadata.category) ?? Number.MAX_SAFE_INTEGER;
    // 인접쌍이 (카테고리 order, type) 로 비감소 정렬돼 있는지 단언.
    for (let i = 1; i < components.length; i++) {
      const prev = components[i - 1];
      const cur = components[i];
      const sorted =
        orderOf(prev) < orderOf(cur) ||
        (orderOf(prev) === orderOf(cur) &&
          prev.metadata.type.localeCompare(cur.metadata.type) <= 0);
      expect(sorted).toBe(true);
    }
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
      [...ALL_NODE_COMPONENTS],
    );

    service.onModuleInit();

    const { deps } = bootstrapArgs(componentRegistry);
    expect(deps).toBe(built);
  });
});
