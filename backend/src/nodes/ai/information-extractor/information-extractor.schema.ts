import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const informationExtractorNodeConfigSchema = z.object({}).passthrough();
export type InformationExtractorConfig = z.infer<
  typeof informationExtractorNodeConfigSchema
>;

export const informationExtractorNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'out', label: 'Output', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

export const informationExtractorNodeMetadata: NodeComponentMetadata = {
  type: 'information_extractor',
  category: 'ai',
  label: 'Information Extractor',
  description: 'Extract structured data from text',
  icon: 'FileSearch',
  color: '#10B981',

  defaultConfig: {},
};
