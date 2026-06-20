import { NodeComponent } from '../core/node-component.interface';
import { ifElseComponent } from './if-else';
import { switchNodeComponent } from './switch';
import { loopNodeComponent } from './loop';
import { variableDeclarationNodeComponent } from './variable-declaration';
import { variableModificationNodeComponent } from './variable-modification';
import { splitNodeComponent } from './split';
import { mapNodeComponent } from './map';
import { foreachNodeComponent } from './foreach';
import { mergeNodeComponent } from './merge';
import { filterNodeComponent } from './filter';
import { parallelNodeComponent } from './parallel';
import { backgroundNodeComponent } from './background';

/**
 * Logic 카테고리 노드 컴포넌트 (M-5 레이어1 — 카테고리-로컬 단일 출처).
 * 노드 추가 = 이 배열에 한 줄.
 */
export const LOGIC_COMPONENTS: NodeComponent[] = [
  ifElseComponent,
  switchNodeComponent,
  loopNodeComponent,
  variableDeclarationNodeComponent,
  variableModificationNodeComponent,
  splitNodeComponent,
  mapNodeComponent,
  foreachNodeComponent,
  mergeNodeComponent,
  filterNodeComponent,
  parallelNodeComponent,
  backgroundNodeComponent,
];
