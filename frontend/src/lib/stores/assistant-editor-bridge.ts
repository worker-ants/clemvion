/**
 * Dependency-breaking bridge between the assistant store and the editor store.
 *
 * The assistant store receives SSE `tool_call` events for edit operations
 * (`add_node`, `add_edge`, ...) and needs to apply them to the editor-store.
 * A direct import would cause a module cycle (editor-store also imports
 * assistant-store's types through the toolbar). Instead, the editor-store
 * registers its dispatcher here at module load, and the assistant-store
 * calls through this tiny registry — neither side imports the other.
 */

export type AssistantEditorOperation = (
  name: string,
  args: Record<string, unknown>,
  result: unknown,
) => void;

let registered: AssistantEditorOperation | null = null;

export function registerAssistantEditorBridge(fn: AssistantEditorOperation): void {
  registered = fn;
}

export function dispatchAssistantEditorOperation(
  name: string,
  args: Record<string, unknown>,
  result: unknown,
): void {
  registered?.(name, args, result);
}
