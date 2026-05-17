import { TemplateHandler } from './template.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  templateNodeConfigSchema,
  templateNodeMetadata,
  templateNodeOutputSchema,
  templateNodePorts,
} from './template.schema';

export const templateNodeComponent: NodeComponent = {
  metadata: templateNodeMetadata,
  ports: templateNodePorts,
  configSchema: templateNodeConfigSchema,
  outputSchema: templateNodeOutputSchema,
  createHandler: () => new TemplateHandler(),
};
