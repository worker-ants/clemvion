import { PdfHandler } from '../../../modules/execution-engine/handlers/presentation/pdf.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  pdfNodeConfigSchema,
  pdfNodeMetadata,
  pdfNodePorts,
} from './pdf.schema';

export const pdfNodeComponent: NodeComponent = {
  metadata: pdfNodeMetadata,
  ports: pdfNodePorts,
  configSchema: pdfNodeConfigSchema,
  createHandler: () => new PdfHandler(),
};
