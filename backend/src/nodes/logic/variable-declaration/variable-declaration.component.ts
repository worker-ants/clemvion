import { VariableDeclarationHandler } from '../../../modules/execution-engine/handlers/logic/variable-declaration.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  variableDeclarationNodeConfigSchema,
  variableDeclarationNodeMetadata,
  variableDeclarationNodePorts,
} from './variable-declaration.schema';

export const variableDeclarationNodeComponent: NodeComponent = {
  metadata: variableDeclarationNodeMetadata,
  ports: variableDeclarationNodePorts,
  configSchema: variableDeclarationNodeConfigSchema,
  createHandler: () => new VariableDeclarationHandler(),
};
