import { getNodeDefinition } from "@/lib/node-definitions";
import { SchemaForm } from "../auto-form/schema-form";
import { OVERRIDE_REGISTRY } from "./override-registry";

type NodeConfigProps = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

/**
 * Renders the settings form for a given node type.
 *
 * Strategy:
 *   1. If `OVERRIDE_REGISTRY[nodeType]` is defined, render that bespoke form.
 *   2. Otherwise, auto-generate the form from the node's JSON Schema
 *      (loaded by `loadNodeDefinitions()` on editor entry) using `SchemaForm`.
 *
 * To migrate a node from override to auto-gen, remove its entry from the
 * override registry and ensure the backend zod schema has sufficient
 * `.meta({ ui: ... })` hints for the form to render correctly.
 */
export function NodeConfigRenderer({
  nodeType,
  config,
  onChange,
}: NodeConfigProps & { nodeType: string }) {
  const Custom = OVERRIDE_REGISTRY[nodeType];
  if (Custom) return <Custom config={config} onChange={onChange} />;

  const definition = getNodeDefinition(nodeType);
  if (!definition?.configSchema) return null;
  return (
    <SchemaForm
      schema={definition.configSchema}
      value={config}
      onChange={onChange}
    />
  );
}
