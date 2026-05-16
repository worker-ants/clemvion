import { Cafe24Handler } from './cafe24.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  cafe24NodeConfigSchema,
  cafe24NodeMetadata,
  cafe24NodeOutputSchema,
  cafe24NodePorts,
} from './cafe24.schema';
import { buildCafe24Extras } from './metadata/public-meta';

export const cafe24NodeComponent: NodeComponent = {
  metadata: cafe24NodeMetadata,
  ports: cafe24NodePorts,
  configSchema: cafe24NodeConfigSchema,
  outputSchema: cafe24NodeOutputSchema,
  createHandler: (deps) => {
    // `cafe24ApiClient` is optional on HandlerDependencies for legacy /
    // test wiring; in production it MUST be injected (ExecutionEngineModule
    // imports Cafe24Module). Fail fast at registration rather than throwing
    // a confusing TypeError on the first cafe24 node execution.
    if (!deps.cafe24ApiClient) {
      throw new Error(
        'Cafe24ApiClient is not injected — Cafe24Module import is missing from the module wiring',
      );
    }
    return new Cafe24Handler(deps.integrationsService, deps.cafe24ApiClient);
  },
  // Ships the (resource, operation) catalog to the frontend so the dynamic
  // form can render Operation select + typed Fields without an extra round
  // trip. `method` / `path` are intentionally stripped — see public-meta.ts.
  extras: () => buildCafe24Extras(),
};
