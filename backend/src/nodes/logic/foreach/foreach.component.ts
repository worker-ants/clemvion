import { ForEachHandler } from './foreach.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  foreachNodeConfigSchema,
  foreachNodeMetadata,
  foreachNodeOutputSchema,
  foreachNodePorts,
} from './foreach.schema';

export const foreachNodeComponent: NodeComponent = {
  metadata: foreachNodeMetadata,
  ports: foreachNodePorts,
  configSchema: foreachNodeConfigSchema,
  outputSchema: foreachNodeOutputSchema,
  createHandler: () => new ForEachHandler(),
};
