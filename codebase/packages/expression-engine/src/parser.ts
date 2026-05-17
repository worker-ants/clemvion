/**
 * Recursive descent parser for the expression language.
 * Converts Token[] to AST following operator precedence rules.
 */

import { Token, TokenType } from './tokens';
import {
  ASTNode,
  TemplateLiteral,
  TemplatePart,
  ObjectLiteralProperty,
} from './ast';
import { SyntaxError } from './errors';

export class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse(): ASTNode {
    const parts: TemplatePart[] = [];
    let hasTemplate = false;

    while (!this.isAtEnd()) {
      const token = this.current();

      if (token.type === TokenType.Text) {
        hasTemplate = true;
        parts.push({ type: 'text', value: token.value });
        this.advance();
      } else if (token.type === TokenType.ExprStart) {
        hasTemplate = true;
        this.advance(); // skip {{
        const expr = this.parseExpression();
        this.expect(TokenType.ExprEnd, 'Expected }}');
        parts.push({ type: 'expression', value: expr });
      } else if (token.type === TokenType.EOF) {
        break;
      } else {
        throw new SyntaxError(
          `Unexpected token: ${token.type}`,
          token.position,
        );
      }
    }

    // If template has only a single expression part, unwrap it
    if (parts.length === 1 && parts[0].type === 'expression') {
      return parts[0].value as ASTNode;
    }

    if (hasTemplate) {
      return { type: 'TemplateLiteral', parts } as TemplateLiteral;
    }

    // Empty input -> empty string
    return { type: 'StringLiteral', value: '' };
  }

  private parseExpression(): ASTNode {
    return this.parseTernary();
  }

  private parseTernary(): ASTNode {
    let node = this.parseOr();

    if (this.match(TokenType.Question)) {
      const consequent = this.parseExpression();
      this.expect(TokenType.Colon, 'Expected : in ternary expression');
      const alternate = this.parseExpression();
      node = {
        type: 'TernaryExpression',
        condition: node,
        consequent,
        alternate,
      };
    }

    return node;
  }

  private parseOr(): ASTNode {
    let node = this.parseAnd();

    while (this.match(TokenType.Or)) {
      const right = this.parseAnd();
      node = { type: 'BinaryExpression', operator: '||', left: node, right };
    }

    return node;
  }

  private parseAnd(): ASTNode {
    let node = this.parseEquality();

    while (this.match(TokenType.And)) {
      const right = this.parseEquality();
      node = { type: 'BinaryExpression', operator: '&&', left: node, right };
    }

    return node;
  }

  private parseEquality(): ASTNode {
    let node = this.parseComparison();

    while (true) {
      if (this.match(TokenType.Eq)) {
        const right = this.parseComparison();
        node = { type: 'BinaryExpression', operator: '==', left: node, right };
      } else if (this.match(TokenType.Neq)) {
        const right = this.parseComparison();
        node = { type: 'BinaryExpression', operator: '!=', left: node, right };
      } else {
        break;
      }
    }

    return node;
  }

  private parseComparison(): ASTNode {
    let node = this.parseAddition();

    while (true) {
      if (this.match(TokenType.Lt)) {
        const right = this.parseAddition();
        node = { type: 'BinaryExpression', operator: '<', left: node, right };
      } else if (this.match(TokenType.Gt)) {
        const right = this.parseAddition();
        node = { type: 'BinaryExpression', operator: '>', left: node, right };
      } else if (this.match(TokenType.Lte)) {
        const right = this.parseAddition();
        node = { type: 'BinaryExpression', operator: '<=', left: node, right };
      } else if (this.match(TokenType.Gte)) {
        const right = this.parseAddition();
        node = { type: 'BinaryExpression', operator: '>=', left: node, right };
      } else {
        break;
      }
    }

    return node;
  }

  private parseAddition(): ASTNode {
    let node = this.parseMultiplication();

    while (true) {
      if (this.match(TokenType.Plus)) {
        const right = this.parseMultiplication();
        node = { type: 'BinaryExpression', operator: '+', left: node, right };
      } else if (this.match(TokenType.Minus)) {
        const right = this.parseMultiplication();
        node = { type: 'BinaryExpression', operator: '-', left: node, right };
      } else {
        break;
      }
    }

    return node;
  }

  private parseMultiplication(): ASTNode {
    let node = this.parseUnary();

    while (true) {
      if (this.match(TokenType.Star)) {
        const right = this.parseUnary();
        node = { type: 'BinaryExpression', operator: '*', left: node, right };
      } else if (this.match(TokenType.Slash)) {
        const right = this.parseUnary();
        node = { type: 'BinaryExpression', operator: '/', left: node, right };
      } else if (this.match(TokenType.Percent)) {
        const right = this.parseUnary();
        node = { type: 'BinaryExpression', operator: '%', left: node, right };
      } else {
        break;
      }
    }

    return node;
  }

  private parseUnary(): ASTNode {
    if (this.match(TokenType.Bang)) {
      const operand = this.parseUnary();
      return { type: 'UnaryExpression', operator: '!', operand };
    }

    if (this.match(TokenType.Minus)) {
      const operand = this.parseUnary();
      return { type: 'UnaryExpression', operator: '-', operand };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): ASTNode {
    let node = this.parsePrimary();
    let sawOptional = false;

    while (true) {
      if (this.match(TokenType.QuestionDot)) {
        // `?.` 뒤에는 식별자(member), `[` (index), 또는 `(` (call) 가 온다.
        sawOptional = true;
        const next = this.current();
        if (next.type === TokenType.LBracket) {
          this.advance();
          const index = this.parseExpression();
          this.expect(TokenType.RBracket, 'Expected ]');
          node = {
            type: 'IndexExpression',
            object: node,
            index,
            optional: true,
          };
        } else if (next.type === TokenType.LParen) {
          this.advance();
          const args = this.parseArgList();
          this.expect(TokenType.RParen, 'Expected )');
          node = {
            type: 'CallExpression',
            callee: node,
            args,
            optional: true,
          };
        } else {
          const propToken = this.expect(
            TokenType.Identifier,
            'Expected property name, "[", or "(" after ?.',
          );
          node = {
            type: 'MemberExpression',
            object: node,
            property: propToken.value,
            optional: true,
          };
        }
      } else if (this.match(TokenType.Dot)) {
        const propToken = this.expect(
          TokenType.Identifier,
          'Expected property name after .',
        );
        node = {
          type: 'MemberExpression',
          object: node,
          property: propToken.value,
        };
      } else if (this.match(TokenType.LBracket)) {
        const index = this.parseExpression();
        this.expect(TokenType.RBracket, 'Expected ]');
        node = { type: 'IndexExpression', object: node, index };
      } else if (this.match(TokenType.LParen)) {
        const args = this.parseArgList();
        this.expect(TokenType.RParen, 'Expected )');
        node = { type: 'CallExpression', callee: node, args };
      } else {
        break;
      }
    }

    // Optional 이 한 번이라도 나왔다면 체인 전체를 ChainExpression 으로 감싸
    // evaluator 가 중간 단계 null 을 잡아 체인 끝까지 전파(short-circuit)
    // 하도록 한다. `a?.b.c.d` 에서 a 가 null 이면 결과는 null.
    if (sawOptional) {
      node = { type: 'ChainExpression', expression: node };
    }

    return node;
  }

  private parseArgList(): ASTNode[] {
    const args: ASTNode[] = [];
    if (this.current().type === TokenType.RParen) {
      return args;
    }

    args.push(this.parseExpression());
    while (this.match(TokenType.Comma)) {
      args.push(this.parseExpression());
    }

    return args;
  }

  private parsePrimary(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case TokenType.Number:
        this.advance();
        return { type: 'NumberLiteral', value: parseFloat(token.value) };

      case TokenType.String:
        this.advance();
        return { type: 'StringLiteral', value: token.value };

      case TokenType.Boolean:
        this.advance();
        return { type: 'BooleanLiteral', value: token.value === 'true' };

      case TokenType.Null:
        this.advance();
        return { type: 'NullLiteral' };

      case TokenType.Identifier:
        this.advance();
        return { type: 'Identifier', name: token.value };

      case TokenType.LParen:
        this.advance();
        const expr = this.parseExpression();
        this.expect(TokenType.RParen, 'Expected )');
        return expr;

      case TokenType.LBracket:
        return this.parseArrayLiteral();

      case TokenType.LBrace:
        return this.parseObjectLiteral();

      default:
        throw new SyntaxError(
          `Unexpected token: ${token.type} ('${token.value}')`,
          token.position,
        );
    }
  }

  private parseArrayLiteral(): ASTNode {
    this.expect(TokenType.LBracket, 'Expected [');
    const elements: ASTNode[] = [];

    if (this.current().type !== TokenType.RBracket) {
      elements.push(this.parseExpression());
      while (this.match(TokenType.Comma)) {
        if (this.current().type === TokenType.RBracket) break;
        elements.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RBracket, 'Expected ]');
    return { type: 'ArrayLiteral', elements };
  }

  private parseObjectLiteral(): ASTNode {
    this.expect(TokenType.LBrace, 'Expected {');
    const properties: ObjectLiteralProperty[] = [];

    if (this.current().type !== TokenType.RBrace) {
      properties.push(this.parseObjectProperty());
      while (this.match(TokenType.Comma)) {
        if (this.current().type === TokenType.RBrace) break;
        properties.push(this.parseObjectProperty());
      }
    }

    this.expect(TokenType.RBrace, 'Expected }');
    return { type: 'ObjectLiteral', properties };
  }

  private parseObjectProperty(): ObjectLiteralProperty {
    let key: string;
    const token = this.current();

    if (token.type === TokenType.String) {
      key = token.value;
      this.advance();
    } else if (token.type === TokenType.Identifier) {
      key = token.value;
      this.advance();
    } else {
      throw new SyntaxError(
        'Expected string or identifier as object key',
        token.position,
      );
    }

    this.expect(TokenType.Colon, 'Expected : after object key');
    const value = this.parseExpression();
    return { key, value };
  }

  // Helper methods

  private current(): Token {
    return this.tokens[this.pos] || {
      type: TokenType.EOF,
      value: '',
      position: -1,
    };
  }

  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  private match(type: TokenType): boolean {
    if (this.current().type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType, message: string): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new SyntaxError(
        `${message}, got ${token.type} ('${token.value}')`,
        token.position,
      );
    }
    return this.advance();
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }
}

export function parse(tokens: Token[]): ASTNode {
  const parser = new Parser(tokens);
  return parser.parse();
}
