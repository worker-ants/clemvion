/**
 * Expression engine error classes and error codes.
 */

export enum ErrorCode {
  EXPR_SYNTAX_ERROR = 'EXPR_SYNTAX_ERROR',
  EXPR_REFERENCE_ERROR = 'EXPR_REFERENCE_ERROR',
  EXPR_TYPE_ERROR = 'EXPR_TYPE_ERROR',
  EXPR_FUNCTION_ERROR = 'EXPR_FUNCTION_ERROR',
  EXPR_TIMEOUT = 'EXPR_TIMEOUT',
  EXPR_DEPTH_EXCEEDED = 'EXPR_DEPTH_EXCEEDED',
}

export class ExpressionError extends Error {
  public readonly code: ErrorCode;
  public readonly position?: number;

  constructor(code: ErrorCode, message: string, position?: number) {
    super(message);
    this.name = 'ExpressionError';
    this.code = code;
    this.position = position;
  }
}

export class SyntaxError extends ExpressionError {
  constructor(message: string, position?: number) {
    super(ErrorCode.EXPR_SYNTAX_ERROR, message, position);
    this.name = 'ExpressionSyntaxError';
  }
}

export class ReferenceError extends ExpressionError {
  constructor(message: string, position?: number) {
    super(ErrorCode.EXPR_REFERENCE_ERROR, message, position);
    this.name = 'ExpressionReferenceError';
  }
}

export class TypeError extends ExpressionError {
  constructor(message: string, position?: number) {
    super(ErrorCode.EXPR_TYPE_ERROR, message, position);
    this.name = 'ExpressionTypeError';
  }
}

export class FunctionError extends ExpressionError {
  constructor(message: string, position?: number) {
    super(ErrorCode.EXPR_FUNCTION_ERROR, message, position);
    this.name = 'ExpressionFunctionError';
  }
}

export class TimeoutError extends ExpressionError {
  constructor(message: string) {
    super(ErrorCode.EXPR_TIMEOUT, message);
    this.name = 'ExpressionTimeoutError';
  }
}

export class DepthExceededError extends ExpressionError {
  constructor(message: string) {
    super(ErrorCode.EXPR_DEPTH_EXCEEDED, message);
    this.name = 'ExpressionDepthExceededError';
  }
}
