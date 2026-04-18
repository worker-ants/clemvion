import { ManualTriggerHandler } from './manual-trigger.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  manualTriggerConfigSchema,
  manualTriggerMetadata,
  manualTriggerPorts,
} from './manual-trigger.schema';

export const manualTriggerComponent: NodeComponent = {
  metadata: manualTriggerMetadata,
  ports: manualTriggerPorts,
  configSchema: manualTriggerConfigSchema,
  createHandler: () => new ManualTriggerHandler(),
};
