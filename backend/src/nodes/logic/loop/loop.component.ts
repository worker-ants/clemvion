import { LoopHandler } from './loop.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  loopNodeConfigSchema,
  loopNodeMetadata,
  loopNodeOutputSchema,
  loopNodePorts,
} from './loop.schema';

export const loopNodeComponent: NodeComponent = {
  metadata: loopNodeMetadata,
  ports: loopNodePorts,
  configSchema: loopNodeConfigSchema,
  outputSchema: loopNodeOutputSchema,
  createHandler: () => new LoopHandler(),
};
