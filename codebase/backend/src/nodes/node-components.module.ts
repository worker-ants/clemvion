import { Module } from '@nestjs/common';
import { NODE_COMPONENT } from './core/node-component.interface';
import { ALL_NODE_COMPONENTS } from './index';

/**
 * 노드 컴포넌트 DI 등록 모듈 (refactor 02-architecture M-5 레이어1).
 *
 * flowise `NodesPool`(카테고리 디렉토리 → 단일 pool)에 대응하는 DI 진입점이다:
 * 빌트인 노드 컴포넌트 카탈로그(`ALL_NODE_COMPONENTS` — `nodes/<category>/index.ts`
 * 의 카테고리 배열을 `NODE_CATEGORIES` 순서로 spread 한 것)를 {@link NODE_COMPONENT}
 * 토큰으로 바인딩·export 한다. `NodeBootstrapService`(execution-engine)가
 * `@Inject(NODE_COMPONENT)` 로 주입받아 부팅 시 `NodeComponentRegistry` 에 등록한다
 * — 옛 `node-bootstrap.service.ts` 의 `ALL_NODE_COMPONENTS` 정적 import 를 대체해
 * 카탈로그 출처를 DI 로 주입한다(테스트 override 가능, registry seam 확보).
 *
 * 명칭은 `modules/nodes/NodesModule`(Node 영속 + `NodesController`/`NodesService`)과
 * 의도적으로 구분한다 — 본 모듈은 노드 컴포넌트(핸들러 카탈로그) 등록만 담당한다.
 *
 * 노드 추가는 해당 `nodes/<category>/index.ts` 배열만 수정하면 되므로 본 모듈·
 * `nodes/index.ts` 중앙 파일은 카테고리 추가 시에만 바뀐다(merge-conflict hotspot 해소).
 *
 * 마켓플레이스 레이어3 의 워크스페이스별 동적 노드는 `NodeComponentRegistry` seam 위에
 * `registerDynamic` 으로 런타임 등록된다 (현재 미구현 — 빌트인 정적 등록만).
 */
@Module({
  providers: [{ provide: NODE_COMPONENT, useValue: ALL_NODE_COMPONENTS }],
  exports: [NODE_COMPONENT],
})
export class NodeComponentsModule {}
