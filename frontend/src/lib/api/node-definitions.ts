import { apiClient } from "./client";
import type { NodeDefinitionResponse } from "@/lib/node-definitions/types";

export const nodeDefinitionsApi = {
  list: () => apiClient.get<{ data: NodeDefinitionResponse[] } | NodeDefinitionResponse[]>("/nodes/definitions"),
};
