import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const marginSchema = z
  .object({
    top: z
      .string()
      .default('20mm')
      .meta({ ui: { label: 'Top', widget: 'text' } }),
    right: z
      .string()
      .default('15mm')
      .meta({ ui: { label: 'Right', widget: 'text' } }),
    bottom: z
      .string()
      .default('20mm')
      .meta({ ui: { label: 'Bottom', widget: 'text' } }),
    left: z
      .string()
      .default('15mm')
      .meta({ ui: { label: 'Left', widget: 'text' } }),
  })
  .passthrough();

export const pdfNodeConfigSchema = z
  .object({
    template: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Template',
          widget: 'code',
          language: 'handlebars',
        },
      }),
    pageSize: z
      .enum(['A4', 'Letter', 'A3'])
      .default('A4')
      .meta({ ui: { label: 'Page Size', widget: 'select' } }),
    orientation: z
      .enum(['portrait', 'landscape'])
      .default('portrait')
      .meta({ ui: { label: 'Orientation', widget: 'select' } }),
    margin: marginSchema
      .default({
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      })
      .meta({ ui: { label: 'Margin' } }),
    headerTemplate: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Header Template',
          widget: 'code',
          language: 'handlebars',
        },
      }),
    footerTemplate: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Footer Template',
          widget: 'code',
          language: 'handlebars',
        },
      }),
    fileName: z
      .string()
      .default('document.pdf')
      .meta({
        ui: {
          label: 'File Name',
          widget: 'expression',
          placeholder: 'report_{{date}}.pdf',
        },
      }),
  })
  .passthrough();
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
};
