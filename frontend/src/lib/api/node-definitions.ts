import { apiClient } from "./client";
import type {
  NodeDefinitionResponse,
  NodeCategoryMeta,
} from "@/lib/node-definitions/types";

export type NodeDefinitionsPayload = {
  definitions: NodeDefinitionResponse[];
  categories: NodeCategoryMeta[];
};

export const nodeDefinitionsApi = {
  list: () =>
    apiClient.get<
      | { data: NodeDefinitionsPayload }
      | NodeDefinitionsPayload
      | { data: NodeDefinitionResponse[] }
      | NodeDefinitionResponse[]
    >("/nodes/definitions"),
};
