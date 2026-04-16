import { ParallelHandler } from '../../../modules/execution-engine/handlers/logic/parallel.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  parallelNodeConfigSchema,
  parallelNodeMetadata,
  parallelNodePorts,
} from './parallel.schema';

export const parallelNodeComponent: NodeComponent = {
  metadata: parallelNodeMetadata,
  ports: parallelNodePorts,
  configSchema: parallelNodeConfigSchema,
  createHandler: () => new ParallelHandler(),
};
