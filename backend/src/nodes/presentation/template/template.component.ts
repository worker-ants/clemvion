import { TemplateHandler } from '../../../modules/execution-engine/handlers/presentation/template.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  templateNodeConfigSchema,
  templateNodeMetadata,
  templateNodePorts,
} from './template.schema';

export const templateNodeComponent: NodeComponent = {
  metadata: templateNodeMetadata,
  ports: templateNodePorts,
  configSchema: templateNodeConfigSchema,
  createHandler: () => new TemplateHandler(),
};
