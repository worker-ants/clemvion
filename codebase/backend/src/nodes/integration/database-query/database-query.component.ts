import { DatabaseQueryHandler } from './database-query.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  databaseQueryNodeConfigSchema,
  databaseQueryNodeMetadata,
  databaseQueryNodeOutputSchema,
  databaseQueryNodePorts,
} from './database-query.schema';

export const databaseQueryNodeComponent: NodeComponent = {
  metadata: databaseQueryNodeMetadata,
  ports: databaseQueryNodePorts,
  configSchema: databaseQueryNodeConfigSchema,
  outputSchema: databaseQueryNodeOutputSchema,
  createHandler: (deps) =>
    new DatabaseQueryHandler(
      deps.integrationsService,
      deps.integrationCacheBus,
    ),
};
