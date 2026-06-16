import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ALL_NODE_COMPONENTS } from '../../nodes';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import {
  WORKFLOW_EXECUTOR,
  type WorkflowExecutor,
} from '../../nodes/core/workflow-executor.interface';
import { NodeHandlerDependenciesProvider } from './handlers/node-handler-dependencies.provider';

/**
 * 서버 부팅 시 `ALL_NODE_COMPONENTS` 를 순회하며 각 컴포넌트의 핸들러를
 * `NodeComponentRegistry.bootstrap` 으로 `NodeHandlerRegistry` 에 등록한다.
 *
 * 옛 `ExecutionEngineService.onModuleInit` 이 직접 수행하던 책임을 분리한
 * 단일-책임 서비스 — 9,670줄 god-class 에서 노드 카탈로그 지식
 * (`ALL_NODE_COMPONENTS`) 과 bootstrap 절차를 떼어낸다
 * (C-1 strangler-fig step 1 / [02-architecture.md](../../../plan/in-progress/refactor/02-architecture.md) m-3).
 *
 * `WorkflowExecutor`(= 엔진) 는 클래스 직접 import 대신 {@link WORKFLOW_EXECUTOR}
 * 토큰으로 주입받는다 — 옛 `handlerDeps.build(this)` 자기참조를 DI 바인딩으로
 * 정리한 것. spec `4-nodes/0-overview.md §1.0` 의 "`NodeComponentRegistry` 는 서버
 * 부팅 시 `ALL_NODE_COMPONENTS` 배열을 순회하며 …`NodeHandlerRegistry` 에 등록"
 * 계약은 그대로 유지된다 — 본 서비스는 그 순회를 트리거하는 lifecycle 진입점일 뿐.
 *
 * 시점 안전성: 핸들러는 dispatch (앱 listen 이후) 와 엔진의
 * `onApplicationBootstrap`(metadata `assertConsistency`) 에서만 필요한데, Nest 는
 * 모든 provider 의 `onModuleInit` 완료를 보장한 뒤에야 `onApplicationBootstrap`
 * 단계로 진입하므로 등록은 항상 그 전에 끝난다.
 */
@Injectable()
export class NodeBootstrapService implements OnModuleInit {
  constructor(
    private readonly componentRegistry: NodeComponentRegistry,
    private readonly handlerDeps: NodeHandlerDependenciesProvider,
    @Inject(WORKFLOW_EXECUTOR)
    private readonly workflowExecutor: WorkflowExecutor,
  ) {}

  onModuleInit(): void {
    this.componentRegistry.bootstrap(
      ALL_NODE_COMPONENTS,
      this.handlerDeps.build(this.workflowExecutor),
    );
  }
}
