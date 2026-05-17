import { HttpRequestHandler } from './http-request.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  httpRequestNodeConfigSchema,
  httpRequestNodeMetadata,
  httpRequestNodeOutputSchema,
  httpRequestNodePorts,
} from './http-request.schema';

export const httpRequestNodeComponent: NodeComponent = {
  metadata: httpRequestNodeMetadata,
  ports: httpRequestNodePorts,
  configSchema: httpRequestNodeConfigSchema,
  outputSchema: httpRequestNodeOutputSchema,
  createHandler: (deps) => new HttpRequestHandler(deps.integrationsService),
};
