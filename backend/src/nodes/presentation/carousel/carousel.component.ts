import { CarouselHandler } from './carousel.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  carouselNodeConfigSchema,
  carouselNodeMetadata,
  carouselNodePorts,
} from './carousel.schema';

export const carouselNodeComponent: NodeComponent = {
  metadata: carouselNodeMetadata,
  ports: carouselNodePorts,
  configSchema: carouselNodeConfigSchema,
  createHandler: () => new CarouselHandler(),
};
