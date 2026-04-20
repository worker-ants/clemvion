import { TableHandler } from './table.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  tableNodeConfigSchema,
  tableNodeMetadata,
  tableNodeOutputSchema,
  tableNodePorts,
} from './table.schema';

export const tableNodeComponent: NodeComponent = {
  metadata: tableNodeMetadata,
  ports: tableNodePorts,
  configSchema: tableNodeConfigSchema,
  outputSchema: tableNodeOutputSchema,
  createHandler: () => new TableHandler(),
};
