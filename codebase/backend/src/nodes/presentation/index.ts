import { NodeComponent } from '../core/node-component.interface';
import { carouselNodeComponent } from './carousel';
import { tableNodeComponent } from './table';
import { chartComponent } from './chart';
import { formNodeComponent } from './form';
import { templateNodeComponent } from './template';

/**
 * Presentation 카테고리 노드 컴포넌트 (M-5 레이어1 — 카테고리-로컬 단일 출처).
 * 노드 추가 = 이 배열에 한 줄.
 */
export const PRESENTATION_COMPONENTS: NodeComponent[] = [
  carouselNodeComponent,
  tableNodeComponent,
  chartComponent,
  formNodeComponent,
  templateNodeComponent,
];
