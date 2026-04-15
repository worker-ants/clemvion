import { TransformHandler } from '../../../modules/execution-engine/handlers/data/transform.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  transformNodeConfigSchema,
  transformNodeMetadata,
  transformNodePorts,
} from './transform.schema';

export const transformNodeComponent: NodeComponent = {
  metadata: transformNodeMetadata,
  ports: transformNodePorts,
  configSchema: transformNodeConfigSchema,
  createHandler: () => new TransformHandler(),
};
