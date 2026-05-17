import { VariableDeclarationHandler } from './variable-declaration.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  variableDeclarationNodeConfigSchema,
  variableDeclarationNodeMetadata,
  variableDeclarationNodeOutputSchema,
  variableDeclarationNodePorts,
} from './variable-declaration.schema';

export const variableDeclarationNodeComponent: NodeComponent = {
  metadata: variableDeclarationNodeMetadata,
  ports: variableDeclarationNodePorts,
  configSchema: variableDeclarationNodeConfigSchema,
  outputSchema: variableDeclarationNodeOutputSchema,
  createHandler: () => new VariableDeclarationHandler(),
};
