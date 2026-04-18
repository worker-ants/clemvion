import { SplitHandler } from './split.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  splitNodeConfigSchema,
  splitNodeMetadata,
  splitNodePorts,
} from './split.schema';

export const splitNodeComponent: NodeComponent = {
  metadata: splitNodeMetadata,
  ports: splitNodePorts,
  configSchema: splitNodeConfigSchema,
  createHandler: () => new SplitHandler(),
};
