import { SwitchHandler } from './switch.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  switchNodeConfigSchema,
  switchNodeMetadata,
  switchNodePorts,
} from './switch.schema';

export const switchNodeComponent: NodeComponent = {
  metadata: switchNodeMetadata,
  ports: switchNodePorts,
  configSchema: switchNodeConfigSchema,
  createHandler: () => new SwitchHandler(),
};
