import { TransformHandler } from './transform.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  transformNodeConfigSchema,
  transformNodeMetadata,
  transformNodeOutputSchema,
  transformNodePorts,
} from './transform.schema';

export const transformNodeComponent: NodeComponent = {
  metadata: transformNodeMetadata,
  ports: transformNodePorts,
  configSchema: transformNodeConfigSchema,
  outputSchema: transformNodeOutputSchema,
  createHandler: () => new TransformHandler(),
};
