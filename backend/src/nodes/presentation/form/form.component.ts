import { FormHandler } from '../../../modules/execution-engine/handlers/presentation/form.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  formNodeConfigSchema,
  formNodeMetadata,
  formNodePorts,
} from './form.schema';

export const formNodeComponent: NodeComponent = {
  metadata: formNodeMetadata,
  ports: formNodePorts,
  configSchema: formNodeConfigSchema,
  createHandler: () => new FormHandler(),
};
