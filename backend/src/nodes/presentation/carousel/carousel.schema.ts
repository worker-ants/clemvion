import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const carouselNodeConfigSchema = z.object({}).passthrough();
export type CarouselConfig = z.infer<typeof carouselNodeConfigSchema>;

export const carouselNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const carouselNodeMetadata: NodeComponentMetadata = {
  type: 'carousel',
  category: 'presentation',
  label: 'Carousel',
  description: 'Display as slides',
  icon: 'GalleryHorizontal',
  color: '#EC4899',

  defaultConfig: {
    mode: 'dynamic',
    items: [],
    maxItems: 10,
    layout: 'card',
    itemButtons: [],
    buttons: [],
  },
};
