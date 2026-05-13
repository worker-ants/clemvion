import { Cafe24Handler } from './cafe24.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  cafe24NodeConfigSchema,
  cafe24NodeMetadata,
  cafe24NodeOutputSchema,
  cafe24NodePorts,
} from './cafe24.schema';

export const cafe24NodeComponent: NodeComponent = {
  metadata: cafe24NodeMetadata,
  ports: cafe24NodePorts,
  configSchema: cafe24NodeConfigSchema,
  outputSchema: cafe24NodeOutputSchema,
  createHandler: (deps) =>
    new Cafe24Handler(deps.integrationsService, deps.cafe24ApiClient),
};
