import { MapHandler } from '../../../modules/execution-engine/handlers/logic/map.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  mapNodeConfigSchema,
  mapNodeMetadata,
  mapNodePorts,
} from './map.schema';

export const mapNodeComponent: NodeComponent = {
  metadata: mapNodeMetadata,
  ports: mapNodePorts,
  configSchema: mapNodeConfigSchema,
  createHandler: () => new MapHandler(),
};
