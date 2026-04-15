import { CodeHandler } from '../../../modules/execution-engine/handlers/data/code.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  codeNodeConfigSchema,
  codeNodeMetadata,
  codeNodePorts,
} from './code.schema';

export const codeNodeComponent: NodeComponent = {
  metadata: codeNodeMetadata,
  ports: codeNodePorts,
  configSchema: codeNodeConfigSchema,
  createHandler: () => new CodeHandler(),
};
