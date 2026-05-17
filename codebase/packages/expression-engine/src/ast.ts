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
  | TemplateLiteral
  | ChainExpression;

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
  // `a?.b` 의 `.b` 단계만 true. 체인 전체의 short-circuit 은
  // ChainExpression 이 담당한다.
  optional?: boolean;
}

export interface IndexExpression {
  type: 'IndexExpression';
  object: ASTNode;
  index: ASTNode;
  optional?: boolean;
}

export interface CallExpression {
  type: 'CallExpression';
  callee: ASTNode;
  args: ASTNode[];
  optional?: boolean;
}

// Optional chaining (`?.`) 이 하나라도 포함된 postfix chain 을 감싸는 wrapper.
// 평가 중 어느 optional 단계의 LHS 가 null/undefined 로 밝혀지면 체인 전체가
// null 로 short-circuit 된다. `a?.b.c.d` 에서 a 가 null 이면 .c, .d 는
// non-optional 이라도 throw 하지 않고 통째로 스킵된다는 JS 의미론을 구현한다.
export interface ChainExpression {
  type: 'ChainExpression';
  expression: ASTNode;
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
