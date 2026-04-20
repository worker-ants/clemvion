import { WorkflowHandler } from './workflow.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  workflowNodeConfigSchema,
  workflowNodeMetadata,
  workflowNodeOutputSchema,
  workflowNodePorts,
} from './workflow.schema';

export const workflowNodeComponent: NodeComponent = {
  metadata: workflowNodeMetadata,
  ports: workflowNodePorts,
  configSchema: workflowNodeConfigSchema,
  outputSchema: workflowNodeOutputSchema,
  createHandler: (deps) => new WorkflowHandler(deps.workflowExecutor),
};
