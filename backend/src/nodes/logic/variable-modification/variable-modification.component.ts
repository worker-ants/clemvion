import { VariableModificationHandler } from '../../../modules/execution-engine/handlers/logic/variable-modification.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  variableModificationNodeConfigSchema,
  variableModificationNodeMetadata,
  variableModificationNodePorts,
} from './variable-modification.schema';

export const variableModificationNodeComponent: NodeComponent = {
  metadata: variableModificationNodeMetadata,
  ports: variableModificationNodePorts,
  configSchema: variableModificationNodeConfigSchema,
  createHandler: () => new VariableModificationHandler(),
};
