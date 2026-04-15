import { SlackHandler } from '../../../modules/execution-engine/handlers/integration/slack.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  slackNodeConfigSchema,
  slackNodeMetadata,
  slackNodePorts,
} from './slack.schema';

export const slackNodeComponent: NodeComponent = {
  metadata: slackNodeMetadata,
  ports: slackNodePorts,
  configSchema: slackNodeConfigSchema,
  createHandler: (deps) => new SlackHandler(deps.integrationsService),
};
