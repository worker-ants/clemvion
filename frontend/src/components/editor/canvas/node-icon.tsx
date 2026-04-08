"use client";

import type { LucideProps } from "lucide-react";
import {
  GitBranch,
  Route,
  Repeat,
  Variable,
  PenLine,
  Split,
  Map,
  ListOrdered,
  Merge,
  Workflow,
  Globe,
  Database,
  MessageSquare,
  Mail,
  ArrowRightLeft,
  Code,
  GalleryHorizontal,
  Table,
  BarChart3,
  FileInput,
  FileText,
  FileDown,
  Puzzle,
  Layout,
  HelpCircle,
  Brain,
  Tags,
  FileSearch,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  GitBranch,
  Route,
  Repeat,
  Variable,
  PenLine,
  Split,
  Map,
  ListOrdered,
  Merge,
  Workflow,
  Globe,
  Database,
  MessageSquare,
  Mail,
  ArrowRightLeft,
  Code,
  GalleryHorizontal,
  Table,
  BarChart3,
  FileInput,
  FileText,
  FileDown,
  Puzzle,
  Layout,
  HelpCircle,
  Brain,
  Tags,
  FileSearch,
};

interface NodeIconProps extends LucideProps {
  name: string;
}

export function NodeIcon({ name, ...props }: NodeIconProps) {
  const Icon = ICON_MAP[name] ?? HelpCircle;
  return <Icon {...props} />;
}
