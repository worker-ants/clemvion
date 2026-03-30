/**
 * AST node types for the expression language.
 */

export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | MemberExpression
  | IndexExpression
  | CallExpression
  | UnaryExpression
  | BinaryExpression
  | TernaryExpression
  | ArrayLiteral
  | ObjectLiteral
  | TemplateLiteral;

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteral {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface NullLiteral {
  type: 'NullLiteral';
}

export interface Identifier {
  type: 'Identifier';
  name: string;
}

export interface MemberExpression {
  type: 'MemberExpression';
  object: ASTNode;
  property: string;
}

export interface IndexExpression {
  type: 'IndexExpression';
  object: ASTNode;
  index: ASTNode;
}

export interface CallExpression {
  type: 'CallExpression';
  callee: ASTNode;
  args: ASTNode[];
}

export interface UnaryExpression {
  type: 'UnaryExpression';
  operator: '!' | '-';
  operand: ASTNode;
}

export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '>' | '<=' | '>=' | '&&' | '||';
  left: ASTNode;
  right: ASTNode;
}

export interface TernaryExpression {
  type: 'TernaryExpression';
  condition: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode;
}

export interface ArrayLiteral {
  type: 'ArrayLiteral';
  elements: ASTNode[];
}

export interface ObjectLiteralProperty {
  key: string;
  value: ASTNode;
}

export interface ObjectLiteral {
  type: 'ObjectLiteral';
  properties: ObjectLiteralProperty[];
}

export interface TemplatePart {
  type: 'text' | 'expression';
  value: string | ASTNode;
}

export interface TemplateLiteral {
  type: 'TemplateLiteral';
  parts: TemplatePart[];
}
