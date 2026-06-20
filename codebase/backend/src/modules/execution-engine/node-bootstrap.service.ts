import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  NODE_COMPONENT,
  type NodeComponent,
} from '../../nodes/core/node-component.interface';
import { NODE_CATEGORIES } from '../../nodes/core/categories';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import {
  WORKFLOW_EXECUTOR,
  type WorkflowExecutor,
} from '../../nodes/core/workflow-executor.interface';
import { NodeHandlerDependenciesProvider } from './handlers/node-handler-dependencies.provider';

/**
 * 서버 부팅 시 DI 로 주입받은 노드 컴포넌트 카탈로그(`NODE_COMPONENT` 토큰 — 단일
 * `useValue` 배열)를 결정적으로 정렬한 뒤 `NodeComponentRegistry.bootstrap` 으로
 * `NodeHandlerRegistry` 에 등록하는 단일-책임 lifecycle 진입점.
 *
 * 옛 `ExecutionEngineService.onModuleInit` 이 직접 수행하던 책임을 분리하고
 * (C-1 strangler-fig step 1 / m-3), **M-5 레이어1** 에서 노드 카탈로그 지식을
 * `ALL_NODE_COMPONENTS` 정적 import 대신 `NodeComponentsModule` 이 바인딩하는
 * {@link NODE_COMPONENT} 토큰 주입으로 전환했다 — 노드 추가가 중앙 파일을 건드리지
 * 않게 하고(merge-conflict hotspot 해소), 마켓플레이스 레이어3 의 동적 등록 seam 을
 * 연다. `WorkflowExecutor`(= 엔진)도 {@link WORKFLOW_EXECUTOR} 토큰으로 주입받는다.
 *
 * **등록 순서**: 주입 배열 순서는 Nest provider 등록 순서(= 모듈 import 순서)에
 * 의존하므로 신뢰하지 않는다. `(NODE_CATEGORIES.order, metadata.type)` 로 명시
 * 정렬해 결정적 등록·`listDefinitions` 순서를 보장한다 — 옛 `ALL_NODE_COMPONENTS`
 * 배열의 암묵적 선언 순서를 명시 정렬키로 승격한 것이며, 미래 동적(레이어3)
 * 컴포넌트도 같은 규칙으로 정렬된다.
 *
 * 시점 안전성: 핸들러는 dispatch(앱 listen 이후)와 엔진의 `onApplicationBootstrap`
 * 에서만 필요한데, Nest 는 모든 provider 의 `onModuleInit` 완료 후에야
 * `onApplicationBootstrap` 으로 진입하므로 등록은 항상 그 전에 끝난다.
 */
@Injectable()
export class NodeBootstrapService implements OnModuleInit {
  constructor(
    private readonly componentRegistry: NodeComponentRegistry,
    private readonly handlerDeps: NodeHandlerDependenciesProvider,
    @Inject(WORKFLOW_EXECUTOR)
    private readonly workflowExecutor: WorkflowExecutor,
    @Inject(NODE_COMPONENT)
    private readonly components: NodeComponent[],
  ) {}

  onModuleInit(): void {
    this.componentRegistry.bootstrap(
      this.sortComponents(this.components),
      this.handlerDeps.build(this.workflowExecutor),
    );
  }

  /**
   * `(카테고리 order, type)` 결정적 정렬. 주입 배열 순서(= 카탈로그 spread 순서)에
   * 비의존하며, 같은 규칙이 미래 동적 컴포넌트에도 적용된다.
   */
  private sortComponents(components: NodeComponent[]): NodeComponent[] {
    const categoryOrder = new Map<string, number>(
      NODE_CATEGORIES.map((c) => [c.id, c.order]),
    );
    const orderOf = (c: NodeComponent): number =>
      categoryOrder.get(c.metadata.category) ?? Number.MAX_SAFE_INTEGER;
    return [...components].sort(
      (a, b) =>
        orderOf(a) - orderOf(b) ||
        a.metadata.type.localeCompare(b.metadata.type),
    );
  }
}
