/**
 * Token types and Token interface for the expression language lexer.
 */

export enum TokenType {
  // Literals
  Number = 'Number',
  String = 'String',
  Boolean = 'Boolean',
  Null = 'Null',

  // Identifiers
  Identifier = 'Identifier',

  // Operators
  Plus = 'Plus',             // +
  Minus = 'Minus',           // -
  Star = 'Star',             // *
  Slash = 'Slash',           // /
  Percent = 'Percent',       // %
  Bang = 'Bang',             // !
  Eq = 'Eq',                 // ==
  Neq = 'Neq',              // !=
  Lt = 'Lt',                 // <
  Gt = 'Gt',                 // >
  Lte = 'Lte',              // <=
  Gte = 'Gte',              // >=
  And = 'And',               // &&
  Or = 'Or',                 // ||
  Question = 'Question',     // ?
  Colon = 'Colon',          // :

  // Delimiters
  Dot = 'Dot',               // .
  Comma = 'Comma',           // ,
  LParen = 'LParen',         // (
  RParen = 'RParen',         // )
  LBracket = 'LBracket',     // [
  RBracket = 'RBracket',     // ]
  LBrace = 'LBrace',         // {
  RBrace = 'RBrace',         // }

  // Template
  Text = 'Text',
  ExprStart = 'ExprStart',   // {{
  ExprEnd = 'ExprEnd',       // }}

  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}
