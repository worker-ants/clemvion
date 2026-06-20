import { NodeComponent } from '../core/node-component.interface';
import { manualTriggerComponent } from './manual-trigger';

/**
 * Trigger 카테고리 노드 컴포넌트 (M-5 레이어1 — 카테고리-로컬 단일 출처).
 * 노드 추가 = 이 배열에 한 줄. `nodes/index.ts` 의 정적 spread 와
 * `NodeComponentsModule` 의 DI multi-provider 가 모두 이 배열을 소비한다.
 */
export const TRIGGER_COMPONENTS: NodeComponent[] = [manualTriggerComponent];
