import type { MDXComponents } from "mdx/types";
import { Callout } from "@/components/docs/mdx/callout";
import { Example } from "@/components/docs/mdx/example";
import { FieldTable } from "@/components/docs/mdx/field-table";
import { FlowDiagram } from "@/components/docs/mdx/flow-diagram";
import { ImplAnchor } from "@/components/docs/mdx/impl-anchor";
import { Step, Steps } from "@/components/docs/mdx/steps";
import { DocsLink } from "@/components/docs/mdx/docs-link";

const docsComponents: MDXComponents = {
  Callout,
  Example,
  FieldTable,
  FlowDiagram,
  ImplAnchor,
  Step,
  Steps,
  a: DocsLink,
};

export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...docsComponents, ...components };
}
