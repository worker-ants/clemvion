import { Injectable } from '@nestjs/common';
import { NodeHandler } from './node-handler.interface';
import { NodeTypeMetadata } from './node-type-metadata';

@Injectable()
export class NodeHandlerRegistry {
  private readonly handlers = new Map<string, NodeHandler>();
  private readonly metadata = new Map<string, NodeTypeMetadata>();

  /**
   * 핸들러 등록. `metadata` 는 NodeComponentMetadata.executionMetadata 에서
   * 직접 전달된다 (NodeComponentRegistry.bootstrap 가 호출).
   *
   * 테스트 fixture 등 NodeComponent 경로를 거치지 않고 직접 핸들러를 등록하는
   * 호출자는 metadata 를 생략할 수 있으며, 이 경우 dispatch 는 `kind: 'standard'`
   * 로 동작한다 ({@link getMetadata} 가 sentinel 반환).
   */
  register(
    type: string,
    handler: NodeHandler,
    metadata?: NodeTypeMetadata,
  ): void {
    this.handlers.set(type, handler);
    if (metadata) this.metadata.set(type, metadata);
  }

  get(type: string): NodeHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(
        `UNKNOWN_NODE_TYPE: No handler registered for node type "${type}"`,
      );
    }
    return handler;
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  /**
   * 노드 타입의 dispatch metadata 반환. 등록 시 metadata 가 생략됐으면
   * `{ kind: 'standard' }` sentinel 반환 — dispatch 분기에서 명시 분기 없이
   * 일반 핸들러 경로로 흐른다.
   *
   * (CRIT #3 시나리오 D — self-registering metadata)
   */
  getMetadata(type: string): NodeTypeMetadata {
    return this.metadata.get(type) ?? { kind: 'standard' };
  }

  /**
   * 부팅 시점 정합성 검증. NodeComponentRegistry.bootstrap 호출이 끝난 직후
   * ExecutionEngineService.onApplicationBootstrap 에서 호출된다.
   *
   * 검증 항목:
   *  - 모든 등록 type 이 metadata 를 갖는다 (`{ kind: 'standard' }` sentinel
   *    이 아니라 명시 등록된 metadata 여야 — TS 컴파일 강제와 동일 invariant
   *    를 런타임에서도 재확인)
   *  - `kind: 'container'` / `kind: 'parallel'` 인 type 의 dedicated executor
   *    주입은 호출 측 (ExecutionEngineService) 책임 — 본 메서드는 metadata
   *    누락 / 모순만 검증
   *
   * **테스트 환경 (`NODE_ENV !== 'production'`)** 에서는 누락을 warn 으로만
   * 기록하고 throw 하지 않는다 — 테스트는 `handlerRegistry.register('test_node',
   * handler)` 같이 metadata 없이 등록하는 fixture 가 다수 존재한다. 이 경우
   * dispatch 는 sentinel `{ kind: 'standard' }` 로 동작 (안전).
   *
   * 위반 시 production 에서는 명시적 throw — silent skip 하지 않는다.
   */
  assertConsistency(): void {
    const missing: string[] = [];
    for (const type of this.handlers.keys()) {
      if (!this.metadata.has(type)) missing.push(type);
    }
    if (missing.length === 0) return;

    const message =
      `NodeHandlerRegistry.assertConsistency: ${missing.length} node type(s) ` +
      `registered without executionMetadata: [${missing.join(', ')}]. ` +
      `Each NodeComponent.metadata must declare \`executionMetadata\` ` +
      `({ kind: 'standard' | 'container' | ... }) — see ` +
      `codebase/backend/src/nodes/core/node-type-metadata.ts.`;

    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }

    console.warn(`[NodeHandlerRegistry] (non-production) ${message}`);
  }
}
