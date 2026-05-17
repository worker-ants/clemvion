import { TextClassifierHandler } from './text-classifier.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  textClassifierNodeConfigSchema,
  textClassifierNodeMetadata,
  textClassifierNodeOutputSchema,
  textClassifierNodePorts,
} from './text-classifier.schema';

export const textClassifierNodeComponent: NodeComponent = {
  metadata: textClassifierNodeMetadata,
  ports: textClassifierNodePorts,
  configSchema: textClassifierNodeConfigSchema,
  outputSchema: textClassifierNodeOutputSchema,
  createHandler: (deps) =>
    new TextClassifierHandler(deps.llmService, deps.conversationThreadService),
};
