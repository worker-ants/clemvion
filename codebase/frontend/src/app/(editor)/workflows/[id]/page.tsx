import { WorkflowEditorLoader } from "./editor-loader";

export default async function WorkflowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkflowEditorLoader workflowId={id} />;
}
