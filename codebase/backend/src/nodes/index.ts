import { NodeComponent } from './core/node-component.interface';
import { TRIGGER_COMPONENTS } from './trigger';
import { LOGIC_COMPONENTS } from './logic';
import { FLOW_COMPONENTS } from './flow';
import { AI_COMPONENTS } from './ai';
import { INTEGRATION_COMPONENTS } from './integration';
import { DATA_COMPONENTS } from './data';
import { PRESENTATION_COMPONENTS } from './presentation';

/**
 * 정적 노드 컴포넌트 목록 (M-5 레이어1).
 *
 * **부팅 등록은 DI 가 담당**한다 — `NodeComponentsModule` 이 `NODE_COMPONENT`
 * multi-provider 로 등록하고 `NodeBootstrapService` 가 주입받아 부트스트랩한다.
 * 본 배열은 그 등록과 **동일한 카테고리 배열에서 파생된 정적 소비용**이다:
 *  - `ALL_NODE_TYPES` (워크플로 import DTO `@IsIn`·Swagger enum — 모듈 로드 시점
 *    평가라 DI 로 받을 수 없는 정적 소비처)
 *  - `NodeBootstrapService` 의 drift-guard 기준 집합 (DI 주입 집합 == 본 집합)
 *  - metadata 불변 테스트 (`nodes.integration.spec.ts`)
 *
 * 카테고리 배열을 `NODE_CATEGORIES` 순서로 spread 해 기존 팔레트 순서를 보존한다.
 * 노드 추가는 해당 `<category>/index.ts` 배열만 수정하면 되고 본 파일은 카테고리
 * 추가 시에만 바뀐다(merge-conflict hotspot 해소).
 */
export const ALL_NODE_COMPONENTS: NodeComponent[] = [
  ...TRIGGER_COMPONENTS,
  ...LOGIC_COMPONENTS,
  ...FLOW_COMPONENTS,
  ...AI_COMPONENTS,
  ...INTEGRATION_COMPONENTS,
  ...DATA_COMPONENTS,
  ...PRESENTATION_COMPONENTS,
];

export const ALL_NODE_TYPES: readonly string[] = ALL_NODE_COMPONENTS.map(
  (c) => c.metadata.type,
);

export {
  TRIGGER_COMPONENTS,
  LOGIC_COMPONENTS,
  FLOW_COMPONENTS,
  AI_COMPONENTS,
  INTEGRATION_COMPONENTS,
  DATA_COMPONENTS,
  PRESENTATION_COMPONENTS,
};

export * from './core';
