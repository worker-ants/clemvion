import { ManualTriggerHandler } from './manual-trigger.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  manualTriggerConfigSchema,
  manualTriggerMetadata,
  manualTriggerOutputSchema,
  manualTriggerPorts,
} from './manual-trigger.schema';

export const manualTriggerComponent: NodeComponent = {
  metadata: manualTriggerMetadata,
  ports: manualTriggerPorts,
  configSchema: manualTriggerConfigSchema,
  outputSchema: manualTriggerOutputSchema,
  createHandler: () => new ManualTriggerHandler(),
};
