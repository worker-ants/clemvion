import { MergeHandler } from '../../../modules/execution-engine/handlers/logic/merge.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  mergeNodeConfigSchema,
  mergeNodeMetadata,
  mergeNodePorts,
} from './merge.schema';

export const mergeNodeComponent: NodeComponent = {
  metadata: mergeNodeMetadata,
  ports: mergeNodePorts,
  configSchema: mergeNodeConfigSchema,
  createHandler: () => new MergeHandler(),
};
