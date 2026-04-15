import { InformationExtractorHandler } from '../../../modules/execution-engine/handlers/ai/information-extractor.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  informationExtractorNodeConfigSchema,
  informationExtractorNodeMetadata,
  informationExtractorNodePorts,
} from './information-extractor.schema';

export const informationExtractorNodeComponent: NodeComponent = {
  metadata: informationExtractorNodeMetadata,
  ports: informationExtractorNodePorts,
  configSchema: informationExtractorNodeConfigSchema,
  createHandler: (deps) => new InformationExtractorHandler(deps.llmService),
};
