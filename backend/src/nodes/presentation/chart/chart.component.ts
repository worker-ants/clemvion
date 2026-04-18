import { ChartHandler } from './chart.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  chartConfigSchema,
  chartInputSchema,
  chartMetadata,
  chartOutputSchema,
  chartPorts,
} from './chart.schema';

export const chartComponent: NodeComponent = {
  metadata: chartMetadata,
  ports: chartPorts,
  configSchema: chartConfigSchema,
  inputSchema: chartInputSchema,
  outputSchema: chartOutputSchema,
  createHandler: () => new ChartHandler(),
};
