import { FilterHandler } from '../../../modules/execution-engine/handlers/logic/filter.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  filterNodeConfigSchema,
  filterNodeMetadata,
  filterNodePorts,
} from './filter.schema';

export const filterNodeComponent: NodeComponent = {
  metadata: filterNodeMetadata,
  ports: filterNodePorts,
  configSchema: filterNodeConfigSchema,
  createHandler: () => new FilterHandler(),
};
