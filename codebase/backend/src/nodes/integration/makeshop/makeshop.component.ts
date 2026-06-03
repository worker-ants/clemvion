import { MakeshopHandler } from './makeshop.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  makeshopNodeConfigSchema,
  makeshopNodeMetadata,
  makeshopNodeOutputSchema,
  makeshopNodePorts,
} from './makeshop.schema';
import { buildMakeshopExtras } from './metadata/public-meta';

export const makeshopNodeComponent: NodeComponent = {
  metadata: makeshopNodeMetadata,
  ports: makeshopNodePorts,
  configSchema: makeshopNodeConfigSchema,
  outputSchema: makeshopNodeOutputSchema,
  createHandler: (deps) => {
    // `makeshopApiClient` is optional on HandlerDependencies for legacy / test
    // wiring; in production it MUST be injected (ExecutionEngineModule imports
    // MakeshopModule). Fail fast at registration rather than throwing a
    // confusing TypeError on the first makeshop node execution.
    if (!deps.makeshopApiClient) {
      throw new Error(
        'MakeshopApiClient is not injected — MakeshopModule import is missing from the module wiring',
      );
    }
    return new MakeshopHandler(
      deps.integrationsService,
      deps.makeshopApiClient,
    );
  },
  // Ships the (resource, operation) catalog to the frontend so the dynamic
  // form can render Operation select + typed Fields without an extra round
  // trip. `method` / `path` are intentionally stripped — see public-meta.ts.
  extras: () => buildMakeshopExtras(),
};
