import { SplitHandler } from './split.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  splitNodeConfigSchema,
  splitNodeMetadata,
  splitNodeOutputSchema,
  splitNodePorts,
} from './split.schema';

export const splitNodeComponent: NodeComponent = {
  metadata: splitNodeMetadata,
  ports: splitNodePorts,
  configSchema: splitNodeConfigSchema,
  outputSchema: splitNodeOutputSchema,
  createHandler: () => new SplitHandler(),
};
