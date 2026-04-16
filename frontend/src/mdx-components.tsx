import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { Callout } from "@/components/docs/mdx/callout";
import { Example } from "@/components/docs/mdx/example";
import { FieldTable } from "@/components/docs/mdx/field-table";
import { FlowDiagram } from "@/components/docs/mdx/flow-diagram";
import { Step, Steps } from "@/components/docs/mdx/steps";

const docsComponents: MDXComponents = {
  Callout,
  Example,
  FieldTable,
  FlowDiagram,
  Step,
  Steps,
  a: ({ href, children, ...rest }) => {
    const safe =
      typeof href === "string" &&
      (href.startsWith("/") ||
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("#") ||
        href.startsWith("mailto:"));
    if (!safe) {
      // javascript:, data: 등 잠재적 XSS 스킴 차단. 링크 없이 텍스트로만 렌더링.
      return <span {...rest}>{children}</span>;
    }
    const isInternal = href.startsWith("/") || href.startsWith("#");
    if (isInternal) {
      return (
        <Link href={href} {...rest}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  },
};

export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...docsComponents, ...components };
}
