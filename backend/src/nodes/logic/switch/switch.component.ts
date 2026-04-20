import { SwitchHandler } from './switch.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  switchNodeConfigSchema,
  switchNodeMetadata,
  switchNodeOutputSchema,
  switchNodePorts,
} from './switch.schema';

export const switchNodeComponent: NodeComponent = {
  metadata: switchNodeMetadata,
  ports: switchNodePorts,
  configSchema: switchNodeConfigSchema,
  outputSchema: switchNodeOutputSchema,
  createHandler: () => new SwitchHandler(),
};
