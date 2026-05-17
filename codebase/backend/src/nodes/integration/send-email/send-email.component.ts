import { SendEmailHandler } from './send-email.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  sendEmailNodeConfigSchema,
  sendEmailNodeMetadata,
  sendEmailNodeOutputSchema,
  sendEmailNodePorts,
} from './send-email.schema';

export const sendEmailNodeComponent: NodeComponent = {
  metadata: sendEmailNodeMetadata,
  ports: sendEmailNodePorts,
  configSchema: sendEmailNodeConfigSchema,
  outputSchema: sendEmailNodeOutputSchema,
  createHandler: (deps) => new SendEmailHandler(deps.integrationsService),
};
