import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const pdfNodeConfigSchema = z.object({}).passthrough();
export type PdfConfig = z.infer<typeof pdfNodeConfigSchema>;

export const pdfNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const pdfNodeMetadata: NodeComponentMetadata = {
  type: 'pdf',
  category: 'presentation',
  label: 'PDF',
  description: 'Generate PDF documents',
  icon: 'FileDown',
  color: '#EC4899',

  defaultConfig: {},
};
