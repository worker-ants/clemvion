import { ParallelHandler } from './parallel.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  parallelNodeConfigSchema,
  parallelNodeMetadata,
  parallelNodeOutputSchema,
  parallelNodePorts,
} from './parallel.schema';

export const parallelNodeComponent: NodeComponent = {
  metadata: parallelNodeMetadata,
  ports: parallelNodePorts,
  configSchema: parallelNodeConfigSchema,
  outputSchema: parallelNodeOutputSchema,
  createHandler: () => new ParallelHandler(),
};
