/**
 * Tokenizer (Lexer) for the expression language.
 * Converts raw template strings into Token arrays.
 */

import { TokenType, Token } from './tokens';
import { SyntaxError } from './errors';

const MAX_EXPRESSION_LENGTH = 10_000;

export function tokenize(input: string): Token[] {
  if (input.length > MAX_EXPRESSION_LENGTH) {
    throw new SyntaxError(
      `Expression exceeds maximum length of ${MAX_EXPRESSION_LENGTH} characters`,
    );
  }

  const tokens: Token[] = [];
  let pos = 0;
  let inExpression = false;
  let braceDepth = 0;

  while (pos < input.length) {
    if (inExpression) {
      pos = skipWhitespace(input, pos);
      if (pos >= input.length) {
        throw new SyntaxError('Unterminated expression, expected }}', pos);
      }

      // Check for }} as expression end (only when not inside object literal braces)
      if (input[pos] === '}' && input[pos + 1] === '}' && braceDepth === 0) {
        tokens.push({ type: TokenType.ExprEnd, value: '}}', position: pos });
        pos += 2;
        inExpression = false;
        continue;
      }

      // Handle } as RBrace for object literals
      if (input[pos] === '}' && braceDepth > 0) {
        tokens.push({ type: TokenType.RBrace, value: '}', position: pos });
        pos += 1;
        braceDepth--;
        continue;
      }

      const token = readExpressionToken(input, pos);
      if (token.type === TokenType.LBrace) {
        braceDepth++;
      }
      tokens.push(token);
      pos = token.position + token.value.length;
      // Adjust position for string tokens (value doesn't include quotes)
      if (token.type === TokenType.String) {
        pos = skipPastStringEnd(input, token.position);
      }
    } else {
      // Template mode - read text or {{
      const result = readTemplateSegment(input, pos);
      if (result) {
        tokens.push(result.token);
        pos = result.nextPos;
        if (result.token.type === TokenType.ExprStart) {
          inExpression = true;
        }
      } else {
        pos++;
      }
    }
  }

  if (inExpression) {
    throw new SyntaxError('Unterminated expression, expected }}', pos);
  }

  tokens.push({ type: TokenType.EOF, value: '', position: pos });
  return tokens;
}

function skipWhitespace(input: string, pos: number): number {
  while (pos < input.length && /\s/.test(input[pos])) {
    pos++;
  }
  return pos;
}

function readTemplateSegment(
  input: string,
  pos: number,
): { token: Token; nextPos: number } | null {
  // Check for escaped {{
  if (input[pos] === '\\' && input[pos + 1] === '{' && input[pos + 2] === '{') {
    return {
      token: { type: TokenType.Text, value: '{{', position: pos },
      nextPos: pos + 3,
    };
  }

  // Check for {{
  if (input[pos] === '{' && input[pos + 1] === '{') {
    return {
      token: { type: TokenType.ExprStart, value: '{{', position: pos },
      nextPos: pos + 2,
    };
  }

  // Read text until {{ or end
  let end = pos;
  let text = '';
  while (end < input.length) {
    if (
      input[end] === '\\' &&
      input[end + 1] === '{' &&
      input[end + 2] === '{'
    ) {
      text += '{{';
      end += 3;
      continue;
    }
    if (input[end] === '{' && input[end + 1] === '{') {
      break;
    }
    text += input[end];
    end++;
  }

  if (text.length > 0) {
    return {
      token: { type: TokenType.Text, value: text, position: pos },
      nextPos: end,
    };
  }

  return null;
}

function skipPastStringEnd(input: string, startPos: number): number {
  const quote = input[startPos];
  let pos = startPos + 1;
  while (pos < input.length) {
    if (input[pos] === '\\') {
      pos += 2;
      continue;
    }
    if (input[pos] === quote) {
      return pos + 1;
    }
    pos++;
  }
  return pos;
}

function readExpressionToken(input: string, pos: number): Token {
  const ch = input[pos];

  // Two-character operators
  if (pos + 1 < input.length) {
    const two = input[pos] + input[pos + 1];
    switch (two) {
      case '==':
        return { type: TokenType.Eq, value: '==', position: pos };
      case '!=':
        return { type: TokenType.Neq, value: '!=', position: pos };
      case '<=':
        return { type: TokenType.Lte, value: '<=', position: pos };
      case '>=':
        return { type: TokenType.Gte, value: '>=', position: pos };
      case '&&':
        return { type: TokenType.And, value: '&&', position: pos };
      case '||':
        return { type: TokenType.Or, value: '||', position: pos };
    }
  }

  // Single-character tokens
  switch (ch) {
    case '+':
      return { type: TokenType.Plus, value: '+', position: pos };
    case '-':
      return { type: TokenType.Minus, value: '-', position: pos };
    case '*':
      return { type: TokenType.Star, value: '*', position: pos };
    case '/':
      return { type: TokenType.Slash, value: '/', position: pos };
    case '%':
      return { type: TokenType.Percent, value: '%', position: pos };
    case '!':
      return { type: TokenType.Bang, value: '!', position: pos };
    case '<':
      return { type: TokenType.Lt, value: '<', position: pos };
    case '>':
      return { type: TokenType.Gt, value: '>', position: pos };
    case '?':
      return { type: TokenType.Question, value: '?', position: pos };
    case ':':
      return { type: TokenType.Colon, value: ':', position: pos };
    case '.':
      return { type: TokenType.Dot, value: '.', position: pos };
    case ',':
      return { type: TokenType.Comma, value: ',', position: pos };
    case '(':
      return { type: TokenType.LParen, value: '(', position: pos };
    case ')':
      return { type: TokenType.RParen, value: ')', position: pos };
    case '[':
      return { type: TokenType.LBracket, value: '[', position: pos };
    case ']':
      return { type: TokenType.RBracket, value: ']', position: pos };
    case '{':
      return { type: TokenType.LBrace, value: '{', position: pos };
  }

  // Numbers
  if (isDigit(ch)) {
    return readNumber(input, pos);
  }

  // Strings
  if (ch === '"' || ch === "'") {
    return readString(input, pos);
  }

  // Identifiers and keywords
  if (ch === '$' || isIdentStart(ch)) {
    return readIdentifier(input, pos);
  }

  throw new SyntaxError(`Unexpected character: '${ch}'`, pos);
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}

function readNumber(input: string, pos: number): Token {
  let end = pos;
  while (end < input.length && isDigit(input[end])) {
    end++;
  }
  if (end < input.length && input[end] === '.' && end + 1 < input.length && isDigit(input[end + 1])) {
    end++; // skip '.'
    while (end < input.length && isDigit(input[end])) {
      end++;
    }
  }
  return {
    type: TokenType.Number,
    value: input.slice(pos, end),
    position: pos,
  };
}

function readString(input: string, pos: number): Token {
  const quote = input[pos];
  let end = pos + 1;
  let value = '';

  while (end < input.length) {
    if (input[end] === '\\' && end + 1 < input.length) {
      const next = input[end + 1];
      switch (next) {
        case 'n':
          value += '\n';
          break;
        case 't':
          value += '\t';
          break;
        case 'r':
          value += '\r';
          break;
        case '\\':
          value += '\\';
          break;
        default:
          value += next;
          break;
      }
      end += 2;
      continue;
    }
    if (input[end] === quote) {
      return {
        type: TokenType.String,
        value,
        position: pos,
      };
    }
    value += input[end];
    end++;
  }

  throw new SyntaxError(`Unterminated string literal`, pos);
}

function readIdentifier(input: string, pos: number): Token {
  let end = pos;

  // Handle $ prefix
  if (input[end] === '$') {
    end++;
  }

  if (end < input.length && isIdentStart(input[end])) {
    end++;
    while (end < input.length && isIdentPart(input[end])) {
      end++;
    }
  } else if (input[pos] === '$') {
    throw new SyntaxError(`Expected identifier after '$'`, pos);
  }

  const value = input.slice(pos, end);

  // Keywords
  if (value === 'true' || value === 'false') {
    return { type: TokenType.Boolean, value, position: pos };
  }
  if (value === 'null') {
    return { type: TokenType.Null, value, position: pos };
  }

  return { type: TokenType.Identifier, value, position: pos };
}
