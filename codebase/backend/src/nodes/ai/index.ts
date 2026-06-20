import { NodeComponent } from '../core/node-component.interface';
import { aiAgentNodeComponent } from './ai-agent';
import { textClassifierNodeComponent } from './text-classifier';
import { informationExtractorNodeComponent } from './information-extractor';

/**
 * AI 카테고리 노드 컴포넌트 (M-5 레이어1 — 카테고리-로컬 단일 출처).
 * 노드 추가 = 이 배열에 한 줄.
 */
export const AI_COMPONENTS: NodeComponent[] = [
  aiAgentNodeComponent,
  textClassifierNodeComponent,
  informationExtractorNodeComponent,
];
