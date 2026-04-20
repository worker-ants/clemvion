import { CarouselHandler } from './carousel.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  carouselNodeConfigSchema,
  carouselNodeMetadata,
  carouselNodeOutputSchema,
  carouselNodePorts,
} from './carousel.schema';

export const carouselNodeComponent: NodeComponent = {
  metadata: carouselNodeMetadata,
  ports: carouselNodePorts,
  configSchema: carouselNodeConfigSchema,
  outputSchema: carouselNodeOutputSchema,
  createHandler: () => new CarouselHandler(),
};
