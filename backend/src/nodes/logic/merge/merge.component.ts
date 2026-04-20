import { MergeHandler } from './merge.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  mergeNodeConfigSchema,
  mergeNodeMetadata,
  mergeNodeOutputSchema,
  mergeNodePorts,
} from './merge.schema';

export const mergeNodeComponent: NodeComponent = {
  metadata: mergeNodeMetadata,
  ports: mergeNodePorts,
  configSchema: mergeNodeConfigSchema,
  outputSchema: mergeNodeOutputSchema,
  createHandler: () => new MergeHandler(),
};
