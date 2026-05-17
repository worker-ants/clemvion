import { FormHandler } from './form.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  formNodeConfigSchema,
  formNodeMetadata,
  formNodeOutputSchema,
  formNodePorts,
} from './form.schema';

export const formNodeComponent: NodeComponent = {
  metadata: formNodeMetadata,
  ports: formNodePorts,
  configSchema: formNodeConfigSchema,
  outputSchema: formNodeOutputSchema,
  createHandler: () => new FormHandler(),
};
