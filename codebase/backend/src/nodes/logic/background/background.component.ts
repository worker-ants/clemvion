import { BackgroundHandler } from './background.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  backgroundNodeConfigSchema,
  backgroundNodeMetadata,
  backgroundNodeOutputSchema,
  backgroundNodePorts,
} from './background.schema';

/**
 * Background 노드 컴포넌트.
 *
 * 핸들러는 main 포트 통과만 담당하고, background 포트 본문의 비동기 실행은
 * ExecutionEngineService가 핸들러 호출 직후에 별도로 enqueue 한다. 그래서 컴포넌트
 * 팩토리에는 별도 의존성이 필요 없다.
 */
export const backgroundNodeComponent: NodeComponent = {
  metadata: backgroundNodeMetadata,
  ports: backgroundNodePorts,
  configSchema: backgroundNodeConfigSchema,
  outputSchema: backgroundNodeOutputSchema,
  createHandler: () => new BackgroundHandler(),
};
