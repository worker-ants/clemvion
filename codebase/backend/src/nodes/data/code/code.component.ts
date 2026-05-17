import { CodeHandler } from './code.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  codeNodeConfigSchema,
  codeNodeMetadata,
  codeNodeOutputSchema,
  codeNodePorts,
} from './code.schema';

export const codeNodeComponent: NodeComponent = {
  metadata: codeNodeMetadata,
  ports: codeNodePorts,
  configSchema: codeNodeConfigSchema,
  outputSchema: codeNodeOutputSchema,
  createHandler: () => new CodeHandler(),
};
