import { NodeCategory } from '../../modules/nodes/entities/node.entity';

export interface NodeCategoryMeta {
  id: `${NodeCategory}`;
  label: string;
  icon: string;
  color: string;
  order: number;
}

export const NODE_CATEGORIES: readonly NodeCategoryMeta[] = [
  { id: 'trigger', label: 'Trigger', icon: 'Zap', color: '#F59E0B', order: 0 },
  {
    id: 'logic',
    label: 'Logic',
    icon: 'GitBranch',
    color: '#3B82F6',
    order: 1,
  },
  { id: 'flow', label: 'Flow', icon: 'Workflow', color: '#8B5CF6', order: 2 },
  { id: 'ai', label: 'AI', icon: 'Sparkles', color: '#10B981', order: 3 },
  {
    id: 'integration',
    label: 'Integration',
    icon: 'Puzzle',
    color: '#F97316',
    order: 4,
  },
  { id: 'data', label: 'Data', icon: 'Database', color: '#06B6D4', order: 5 },
  {
    id: 'presentation',
    label: 'Presentation',
    icon: 'Layout',
    color: '#EC4899',
    order: 6,
  },
] as const;
