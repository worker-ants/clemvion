import { IfElseHandler } from './if-else.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  ifElseConfigSchema,
  ifElseMetadata,
  ifElseOutputSchema,
  ifElsePorts,
} from './if-else.schema';

export const ifElseComponent: NodeComponent = {
  metadata: ifElseMetadata,
  ports: ifElsePorts,
  configSchema: ifElseConfigSchema,
  outputSchema: ifElseOutputSchema,
  createHandler: () => new IfElseHandler(),
};
