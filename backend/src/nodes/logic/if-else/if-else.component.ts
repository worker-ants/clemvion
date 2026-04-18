import { IfElseHandler } from './if-else.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  ifElseConfigSchema,
  ifElseMetadata,
  ifElsePorts,
} from './if-else.schema';

export const ifElseComponent: NodeComponent = {
  metadata: ifElseMetadata,
  ports: ifElsePorts,
  configSchema: ifElseConfigSchema,
  createHandler: () => new IfElseHandler(),
};
