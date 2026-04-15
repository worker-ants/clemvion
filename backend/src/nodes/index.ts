import { NodeComponent } from './core/node-component.interface';

import { manualTriggerComponent } from './trigger/manual-trigger';

import { ifElseComponent } from './logic/if-else';
import { switchNodeComponent } from './logic/switch';
import { loopNodeComponent } from './logic/loop';
import { variableDeclarationNodeComponent } from './logic/variable-declaration';
import { variableModificationNodeComponent } from './logic/variable-modification';
import { splitNodeComponent } from './logic/split';
import { mapNodeComponent } from './logic/map';
import { foreachNodeComponent } from './logic/foreach';
import { mergeNodeComponent } from './logic/merge';
import { filterNodeComponent } from './logic/filter';

import { workflowNodeComponent } from './flow/workflow';

import { aiAgentNodeComponent } from './ai/ai-agent';
import { textClassifierNodeComponent } from './ai/text-classifier';
import { informationExtractorNodeComponent } from './ai/information-extractor';

import { httpRequestNodeComponent } from './integration/http-request';
import { databaseQueryNodeComponent } from './integration/database-query';
import { sendEmailNodeComponent } from './integration/send-email';

import { transformNodeComponent } from './data/transform';
import { codeNodeComponent } from './data/code';

import { carouselNodeComponent } from './presentation/carousel';
import { tableNodeComponent } from './presentation/table';
import { chartComponent } from './presentation/chart';
import { formNodeComponent } from './presentation/form';
import { templateNodeComponent } from './presentation/template';

export const ALL_NODE_COMPONENTS: NodeComponent[] = [
  manualTriggerComponent,

  ifElseComponent,
  switchNodeComponent,
  loopNodeComponent,
  variableDeclarationNodeComponent,
  variableModificationNodeComponent,
  splitNodeComponent,
  mapNodeComponent,
  foreachNodeComponent,
  mergeNodeComponent,
  filterNodeComponent,

  workflowNodeComponent,

  aiAgentNodeComponent,
  textClassifierNodeComponent,
  informationExtractorNodeComponent,

  httpRequestNodeComponent,
  databaseQueryNodeComponent,
  sendEmailNodeComponent,

  transformNodeComponent,
  codeNodeComponent,

  carouselNodeComponent,
  tableNodeComponent,
  chartComponent,
  formNodeComponent,
  templateNodeComponent,
];

export * from './core';
