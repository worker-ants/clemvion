import { TableHandler } from '../../../modules/execution-engine/handlers/presentation/table.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  tableNodeConfigSchema,
  tableNodeMetadata,
  tableNodePorts,
} from './table.schema';

export const tableNodeComponent: NodeComponent = {
  metadata: tableNodeMetadata,
  ports: tableNodePorts,
  configSchema: tableNodeConfigSchema,
  createHandler: () => new TableHandler(),
};
