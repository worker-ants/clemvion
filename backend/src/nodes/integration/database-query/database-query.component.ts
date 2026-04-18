import { DatabaseQueryHandler } from './database-query.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  databaseQueryNodeConfigSchema,
  databaseQueryNodeMetadata,
  databaseQueryNodePorts,
} from './database-query.schema';

export const databaseQueryNodeComponent: NodeComponent = {
  metadata: databaseQueryNodeMetadata,
  ports: databaseQueryNodePorts,
  configSchema: databaseQueryNodeConfigSchema,
  createHandler: (deps) => new DatabaseQueryHandler(deps.integrationsService),
};
