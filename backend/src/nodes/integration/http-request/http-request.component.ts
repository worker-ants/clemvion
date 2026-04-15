import { HttpRequestHandler } from '../../../modules/execution-engine/handlers/integration/http-request.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  httpRequestNodeConfigSchema,
  httpRequestNodeMetadata,
  httpRequestNodePorts,
} from './http-request.schema';

export const httpRequestNodeComponent: NodeComponent = {
  metadata: httpRequestNodeMetadata,
  ports: httpRequestNodePorts,
  configSchema: httpRequestNodeConfigSchema,
  createHandler: (deps) => new HttpRequestHandler(deps.integrationsService),
};
