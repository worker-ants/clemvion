/**
 * Tree-walk evaluator for the expression language AST.
 */

import { ASTNode, TemplateLiteral } from './ast';
import {
  ExpressionError,
  ReferenceError,
  TypeError,
  FunctionError,
  TimeoutError,
  DepthExceededError,
} from './errors';
import { getFunction, hasFunction } from './functions';

export interface ExpressionContext {
  $input?: Record<string, unknown>;
  $node?: Record<string, unknown>;
  $var?: Record<string, unknown>;
  $execution?: {
    id: string;
    startedAt: string;
    mode: string;
    workflowId: string;
  };
  $now?: string;
  $today?: string;
  $env?: Record<string, string>;
  $loop?: {
    index: number;
    iteration: number;
    isFirst: boolean;
    isLast: boolean;
  };
  $item?: unknown;
  $itemIndex?: number;
  $trigger?: Record<string, unknown>;
  $dataSource?: unknown[];
  $sourceItem?: unknown;
  $sourceItemIndex?: number;
  [key: string]: unknown;
}

export interface EvalOptions {
  strictComparison?: boolean;
  timeout?: number;
  maxDepth?: number;
}

const DEFAULT_TIMEOUT = 100;
const DEFAULT_MAX_DEPTH = 100;
const MAX_STRING_RESULT = 1_048_576; // 1MB

// Optional chain (ChainExpression) 안에서 LHS 가 null/undefined 로 판명되면
// 이 sentinel 을 throw 해 바깥쪽 ChainExpression 까지 bubble 시킨다.
// ExpressionError 계층과 별개라 error 래핑을 타지 않고, 일반 catch 로도
// 걸리지 않도록 외부에 노출되지 않는다.
class ShortCircuitSignal {}

export class Evaluator {
  private context: ExpressionContext;
  private options: Required<EvalOptions>;
  private startTime: number;
  private depth: number;

  constructor(
    context: ExpressionContext,
    options?: EvalOptions,
  ) {
    this.context = context;
    this.options = {
      strictComparison: options?.strictComparison ?? false,
      timeout: options?.timeout ?? DEFAULT_TIMEOUT,
      maxDepth: options?.maxDepth ?? DEFAULT_MAX_DEPTH,
    };
    this.startTime = Date.now();
    this.depth = 0;
  }

  evaluate(node: ASTNode): unknown {
    this.checkLimits();
    this.depth++;

    try {
      const result = this.evaluateNode(node);
      return result;
    } finally {
      this.depth--;
    }
  }

  private checkLimits(): void {
    if (this.depth >= this.options.maxDepth) {
      throw new DepthExceededError(
        `Expression depth exceeded maximum of ${this.options.maxDepth}`,
      );
    }
    if (Date.now() - this.startTime > this.options.timeout) {
      throw new TimeoutError(
        `Expression evaluation exceeded timeout of ${this.options.timeout}ms`,
      );
    }
  }

  private evaluateNode(node: ASTNode): unknown {
    switch (node.type) {
      case 'NumberLiteral':
        return node.value;
      case 'StringLiteral':
        return node.value;
      case 'BooleanLiteral':
        return node.value;
      case 'NullLiteral':
        return null;
      case 'Identifier':
        return this.evaluateIdentifier(node.name);
      case 'MemberExpression':
        return this.evaluateMemberExpression(
          node.object,
          node.property,
          node.optional === true,
        );
      case 'IndexExpression':
        return this.evaluateIndexExpression(
          node.object,
          node.index,
          node.optional === true,
        );
      case 'CallExpression':
        return this.evaluateCallExpression(
          node.callee,
          node.args,
          node.optional === true,
        );
      case 'ChainExpression':
        try {
          return this.evaluate(node.expression);
        } catch (e) {
          if (e instanceof ShortCircuitSignal) return null;
          throw e;
        }
      case 'UnaryExpression':
        return this.evaluateUnaryExpression(node.operator, node.operand);
      case 'BinaryExpression':
        return this.evaluateBinaryExpression(node.operator, node.left, node.right);
      case 'TernaryExpression':
        return this.evaluateTernaryExpression(node.condition, node.consequent, node.alternate);
      case 'ArrayLiteral':
        return node.elements.map((el) => this.evaluate(el));
      case 'ObjectLiteral': {
        const obj: Record<string, unknown> = {};
        for (const prop of node.properties) {
          obj[prop.key] = this.evaluate(prop.value);
        }
        return obj;
      }
      case 'TemplateLiteral':
        return this.evaluateTemplateLiteral(node);
      default:
        throw new TypeError(`Unknown AST node type: ${(node as ASTNode).type}`);
    }
  }

  private evaluateIdentifier(name: string): unknown {
    // $ prefixed variables map to context
    if (name.startsWith('$')) {
      if (name in this.context) {
        return this.context[name];
      }
      throw new ReferenceError(`Undefined variable: ${name}`);
    }

    // Check if it's a function name (used as reference, not called)
    if (hasFunction(name)) {
      return name; // Return name as placeholder; CallExpression handles actual invocation
    }

    // Check context for non-$ identifiers
    if (name in this.context) {
      return this.context[name];
    }

    throw new ReferenceError(`Undefined variable: ${name}`);
  }

  private evaluateMemberExpression(
    objectNode: ASTNode,
    property: string,
    optional: boolean,
  ): unknown {
    const obj = this.evaluate(objectNode);

    if (obj === null || obj === undefined) {
      if (optional) throw new ShortCircuitSignal();
      throw new ReferenceError(
        `Cannot read property '${property}' of ${obj}`,
      );
    }

    if (typeof obj !== 'object') {
      throw new TypeError(
        `Cannot read property '${property}' of ${typeof obj}`,
      );
    }

    return (obj as Record<string, unknown>)[property] ?? null;
  }

  private evaluateIndexExpression(
    objectNode: ASTNode,
    indexNode: ASTNode,
    optional: boolean,
  ): unknown {
    const obj = this.evaluate(objectNode);

    if (obj === null || obj === undefined) {
      if (optional) throw new ShortCircuitSignal();
      throw new ReferenceError(`Cannot index into ${obj}`);
    }

    const index = this.evaluate(indexNode);

    if (Array.isArray(obj)) {
      if (typeof index !== 'number') {
        throw new TypeError('Array index must be a number');
      }
      return obj[index] ?? null;
    }

    if (typeof obj === 'object') {
      if (typeof index !== 'string' && typeof index !== 'number') {
        throw new TypeError('Object key must be a string or number');
      }
      return (obj as Record<string, unknown>)[String(index)] ?? null;
    }

    throw new TypeError(`Cannot index into ${typeof obj}`);
  }

  private evaluateCallExpression(
    calleeNode: ASTNode,
    argNodes: ASTNode[],
    optional: boolean,
  ): unknown {
    // Get function name
    let fnName: string;
    if (calleeNode.type === 'Identifier') {
      fnName = calleeNode.name;
    } else {
      throw new FunctionError('Only named function calls are supported');
    }

    const fn = getFunction(fnName);
    if (!fn) {
      // `a?.()` 형태로 정의되지 않은 함수를 optional 호출한 경우는 체인 단락.
      if (optional) throw new ShortCircuitSignal();
      throw new FunctionError(`Unknown function: ${fnName}`);
    }

    const args = argNodes.map((a) => this.evaluate(a));

    try {
      return fn(...args);
    } catch (e) {
      if (e instanceof ExpressionError) throw e;
      throw new FunctionError(
        `Error in function ${fnName}: ${(e as Error).message}`,
      );
    }
  }

  private evaluateUnaryExpression(operator: '!' | '-', operandNode: ASTNode): unknown {
    const operand = this.evaluate(operandNode);

    switch (operator) {
      case '!':
        return !this.toBooleanValue(operand);
      case '-': {
        if (typeof operand !== 'number') {
          throw new TypeError(`Cannot negate ${typeof operand}`);
        }
        return -operand;
      }
    }
  }

  private evaluateBinaryExpression(
    operator: string,
    leftNode: ASTNode,
    rightNode: ASTNode,
  ): unknown {
    // Short-circuit for && and ||
    if (operator === '&&') {
      const left = this.evaluate(leftNode);
      if (!this.toBooleanValue(left)) return left;
      return this.evaluate(rightNode);
    }
    if (operator === '||') {
      const left = this.evaluate(leftNode);
      if (this.toBooleanValue(left)) return left;
      return this.evaluate(rightNode);
    }

    const left = this.evaluate(leftNode);
    const right = this.evaluate(rightNode);

    switch (operator) {
      case '+':
        return this.evalPlus(left, right);
      case '-':
        return this.evalArithmetic(left, right, (a, b) => a - b, '-');
      case '*':
        return this.evalArithmetic(left, right, (a, b) => a * b, '*');
      case '/':
        return this.evalArithmetic(left, right, (a, b) => a / b, '/');
      case '%':
        return this.evalArithmetic(left, right, (a, b) => a % b, '%');
      case '==':
        return this.evalEquality(left, right, false);
      case '!=':
        return !this.evalEquality(left, right, false);
      case '<':
        return this.evalComparison(left, right, (a, b) => a < b);
      case '>':
        return this.evalComparison(left, right, (a, b) => a > b);
      case '<=':
        return this.evalComparison(left, right, (a, b) => a <= b);
      case '>=':
        return this.evalComparison(left, right, (a, b) => a >= b);
      default:
        throw new TypeError(`Unknown operator: ${operator}`);
    }
  }

  private evalPlus(left: unknown, right: unknown): unknown {
    // String concatenation if either side is a string
    if (typeof left === 'string' || typeof right === 'string') {
      return this.toStringValue(left) + this.toStringValue(right);
    }
    // Number addition
    if (typeof left === 'number' && typeof right === 'number') {
      return left + right;
    }
    // Attempt numeric conversion
    const ln = this.tryToNumber(left);
    const rn = this.tryToNumber(right);
    if (ln !== null && rn !== null) {
      return ln + rn;
    }
    return this.toStringValue(left) + this.toStringValue(right);
  }

  private evalArithmetic(
    left: unknown,
    right: unknown,
    op: (a: number, b: number) => number,
    symbol: string,
  ): number {
    const ln = this.toNumberValue(left, symbol);
    const rn = this.toNumberValue(right, symbol);
    return op(ln, rn);
  }

  private evalEquality(left: unknown, right: unknown, _negate: boolean): boolean {
    if (this.options.strictComparison) {
      // Strict mode: no type coercion
      if (typeof left !== typeof right) {
        // Both null/undefined are treated as same type
        if ((left === null || left === undefined) && (right === null || right === undefined)) {
          return true;
        }
        return false;
      }
      if (typeof left === 'object' && typeof right === 'object') {
        return this.deepEqual(left, right);
      }
      return left === right;
    }

    // Loose mode
    // null == undefined
    if ((left === null || left === undefined) && (right === null || right === undefined)) {
      return true;
    }
    if (left === null || left === undefined || right === null || right === undefined) {
      return false;
    }

    // Same type: direct compare
    if (typeof left === typeof right) {
      if (typeof left === 'object') {
        return this.deepEqual(left, right);
      }
      return left === right;
    }

    // Cross-type coercion: try number comparison
    if (typeof left === 'boolean') {
      return this.evalEquality(left ? 1 : 0, right, false);
    }
    if (typeof right === 'boolean') {
      return this.evalEquality(left, right ? 1 : 0, false);
    }

    // String/number coercion
    if (typeof left === 'number' && typeof right === 'string') {
      const rn = Number(right);
      if (!isNaN(rn)) return left === rn;
      return false;
    }
    if (typeof left === 'string' && typeof right === 'number') {
      const ln = Number(left);
      if (!isNaN(ln)) return ln === right;
      return false;
    }

    return false;
  }

  private evalComparison(
    left: unknown,
    right: unknown,
    op: (a: number, b: number) => boolean,
  ): boolean {
    // null comparisons always false
    if (left === null || left === undefined || right === null || right === undefined) {
      return false;
    }

    // Arrays/objects cannot be compared with <, >, etc.
    if (typeof left === 'object' || typeof right === 'object') {
      throw new TypeError('Cannot compare objects or arrays with relational operators');
    }

    // Both numbers
    if (typeof left === 'number' && typeof right === 'number') {
      return op(left, right);
    }

    // Boolean -> number
    const ln = typeof left === 'boolean' ? (left ? 1 : 0) : left;
    const rn = typeof right === 'boolean' ? (right ? 1 : 0) : right;

    // Try numeric comparison
    if (typeof ln === 'string' && typeof rn === 'number') {
      const n = Number(ln);
      if (!isNaN(n)) return op(n, rn);
    }
    if (typeof ln === 'number' && typeof rn === 'string') {
      const n = Number(rn);
      if (!isNaN(n)) return op(ln, n);
    }
    if (typeof ln === 'number' && typeof rn === 'number') {
      return op(ln, rn);
    }

    // String comparison (lexicographic)
    if (typeof ln === 'string' && typeof rn === 'string') {
      // Try numeric first
      const lnn = Number(ln);
      const rnn = Number(rn);
      if (!isNaN(lnn) && !isNaN(rnn)) return op(lnn, rnn);
      // Lexicographic
      return op(ln.localeCompare(rn), 0);
    }

    throw new TypeError(`Cannot compare ${typeof left} and ${typeof right}`);
  }

  private evaluateTernaryExpression(
    conditionNode: ASTNode,
    consequentNode: ASTNode,
    alternateNode: ASTNode,
  ): unknown {
    const condition = this.evaluate(conditionNode);
    if (this.toBooleanValue(condition)) {
      return this.evaluate(consequentNode);
    }
    return this.evaluate(alternateNode);
  }

  private evaluateTemplateLiteral(node: TemplateLiteral): string {
    const parts = node.parts.map((part) => {
      if (part.type === 'text') {
        return part.value as string;
      }
      const value = this.evaluate(part.value as ASTNode);
      return this.toStringValue(value);
    });

    const result = parts.join('');
    if (result.length > MAX_STRING_RESULT) {
      throw new TypeError(`String result exceeds maximum size of ${MAX_STRING_RESULT} bytes`);
    }
    return result;
  }

  // Type coercion helpers

  private toBooleanValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value !== '';
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  private toStringValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private toNumberValue(value: unknown, operator: string): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const n = Number(value);
      if (!isNaN(n)) return n;
    }
    throw new TypeError(
      `Cannot apply '${operator}' operator to ${typeof value}`,
    );
  }

  private tryToNumber(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const n = Number(value);
      if (!isNaN(n)) return n;
    }
    return null;
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => this.deepEqual(val, b[i]));
    }

    if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every((key) => this.deepEqual(aObj[key], bObj[key]));
    }

    return false;
  }
}
