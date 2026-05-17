import { InformationExtractorHandler } from './information-extractor.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  informationExtractorNodeConfigSchema,
  informationExtractorNodeMetadata,
  informationExtractorNodeOutputSchema,
  informationExtractorNodePorts,
} from './information-extractor.schema';

export const informationExtractorNodeComponent: NodeComponent = {
  metadata: informationExtractorNodeMetadata,
  ports: informationExtractorNodePorts,
  configSchema: informationExtractorNodeConfigSchema,
  outputSchema: informationExtractorNodeOutputSchema,
  createHandler: (deps) => new InformationExtractorHandler(deps.llmService),
};
