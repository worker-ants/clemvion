import { ForEachHandler } from './foreach.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  foreachNodeConfigSchema,
  foreachNodeMetadata,
  foreachNodePorts,
} from './foreach.schema';

export const foreachNodeComponent: NodeComponent = {
  metadata: foreachNodeMetadata,
  ports: foreachNodePorts,
  configSchema: foreachNodeConfigSchema,
  createHandler: () => new ForEachHandler(),
};
