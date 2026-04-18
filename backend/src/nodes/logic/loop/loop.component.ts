import { LoopHandler } from './loop.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  loopNodeConfigSchema,
  loopNodeMetadata,
  loopNodePorts,
} from './loop.schema';

export const loopNodeComponent: NodeComponent = {
  metadata: loopNodeMetadata,
  ports: loopNodePorts,
  configSchema: loopNodeConfigSchema,
  createHandler: () => new LoopHandler(),
};
