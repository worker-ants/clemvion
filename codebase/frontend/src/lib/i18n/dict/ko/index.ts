import { common } from "./common";
import { sidebar } from "./sidebar";
import { auth } from "./auth";
import { profile } from "./profile";
import { workspace } from "./workspace";
import { invitations } from "./invitations";
import { dashboard } from "./dashboard";
import { workflows } from "./workflows";
import { editor } from "./editor";
import { nodeConfigs } from "./nodeConfigs";
import { triggers } from "./triggers";
import { schedules } from "./schedules";
import { integrations } from "./integrations";
import { cafe24Catalog } from "./cafe24Catalog";
import { knowledgeBases } from "./knowledgeBases";
import { llmConfigs } from "./llmConfigs";
import { authentication } from "./authentication";
import { statistics } from "./statistics";
import { executions } from "./executions";
import { history } from "./history";
import { docs } from "./docs";
import { time } from "./time";
import { errors } from "./errors";
import { assistant } from "./assistant";

export const ko = {
  common,
  sidebar,
  auth,
  profile,
  workspace,
  invitations,
  dashboard,
  workflows,
  editor,
  nodeConfigs,
  triggers,
  schedules,
  integrations,
  cafe24Catalog,
  knowledgeBases,
  llmConfigs,
  authentication,
  statistics,
  executions,
  history,
  docs,
  time,
  errors,
  assistant,
} as const;

export type { Dict } from "../types";
