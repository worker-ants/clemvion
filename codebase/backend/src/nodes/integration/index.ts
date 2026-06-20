import { NodeComponent } from '../core/node-component.interface';
import { httpRequestNodeComponent } from './http-request';
import { databaseQueryNodeComponent } from './database-query';
import { sendEmailNodeComponent } from './send-email';
import { cafe24NodeComponent } from './cafe24';
import { makeshopNodeComponent } from './makeshop';

/**
 * Integration 카테고리 노드 컴포넌트 (M-5 레이어1 — 카테고리-로컬 단일 출처).
 * 노드 추가 = 이 배열에 한 줄. (vendor API client 주입은 별도로
 * NodeHandlerDependenciesProvider 가 담당 — 등록 표면은 여기로 일원화.)
 */
export const INTEGRATION_COMPONENTS: NodeComponent[] = [
  httpRequestNodeComponent,
  databaseQueryNodeComponent,
  sendEmailNodeComponent,
  cafe24NodeComponent,
  makeshopNodeComponent,
];
