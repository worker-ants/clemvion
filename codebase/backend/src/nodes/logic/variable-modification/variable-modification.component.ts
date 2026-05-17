import { VariableModificationHandler } from './variable-modification.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  variableModificationNodeConfigSchema,
  variableModificationNodeMetadata,
  variableModificationNodeOutputSchema,
  variableModificationNodePorts,
} from './variable-modification.schema';

export const variableModificationNodeComponent: NodeComponent = {
  metadata: variableModificationNodeMetadata,
  ports: variableModificationNodePorts,
  configSchema: variableModificationNodeConfigSchema,
  outputSchema: variableModificationNodeOutputSchema,
  createHandler: () => new VariableModificationHandler(),
};
