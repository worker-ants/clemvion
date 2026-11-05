import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import {
  ERROR_CLASS_CODES,
  ITERATION_PASSTHROUGH_CODES,
  resolveIterationErrorCode,
} from './iteration-error-code';
import { ExecutionTimeLimitError } from '../workflow-errors';
import { MakeshopRateLimitedError } from '../../../nodes/integration/makeshop/makeshop-api.client';
import { IntegrationError } from '../../../nodes/integration/_base/integration-handler-base';
import {
  collectTsFiles,
  toPosixRelative,
} from '../../../common/__test-utils__/source-scan';

// CLE-T-REC4X3 — ForEach · Map · Parallel 이 실패 회차 `error.code` 를 고르는 공용 규칙.
// 값은 ERRCODES 규칙 2(UPPER_SNAKE_CASE)를 따르는 등재 코드이거나 §3 예외 `AbortError` 다.
describe('resolveIterationErrorCode', () => {
  it('문자열 code 를 가진 에러 클래스는 그 code 를 낸다', () => {
    expect(
      resolveIterationErrorCode(new MakeshopRateLimitedError(3, 1, 'shop-1')),
    ).toBe('MAKESHOP_RATE_LIMITED');
  });

  it('name 이 AbortError 면 AbortError 를 낸다 (ERRCODES §3 예외)', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(resolveIterationErrorCode(err)).toBe('AbortError');
  });

  // DOMException 의 code 는 숫자다(AbortError 는 20). jest 는 테스트 realm 이 달라
  // `new DOMException() instanceof Error` 가 거짓이므로 같은 모양을 테스트 realm 의 Error 로 만든다.
  it('DOMException 처럼 숫자 code 를 가진 AbortError 는 AbortError 를 낸다', () => {
    const err = Object.assign(new Error('aborted'), { code: 20 });
    err.name = 'AbortError';
    expect(resolveIterationErrorCode(err)).toBe('AbortError');
  });

  it('AbortError 는 문자열 code 보다 먼저 본다 (Node 의 AbortError 는 code ABORT_ERR)', () => {
    const err = Object.assign(new Error('aborted'), { code: 'ABORT_ERR' });
    err.name = 'AbortError';
    expect(resolveIterationErrorCode(err)).toBe('AbortError');
  });

  it.each([
    ['평범한 Error', new Error('boom')],
    ['TypeError', new TypeError('x is not a function')],
    ['빈 name', Object.assign(new Error('nameless'), { name: '' })],
    ['소문자 code', Object.assign(new Error('x'), { code: 'not_upper' })],
    ['숫자 code', Object.assign(new Error('x'), { code: 42 })],
    ['빈 code', Object.assign(new Error('x'), { code: '' })],
  ])('%s 는 UNKNOWN_ERROR 를 낸다', (_label, err) => {
    expect(resolveIterationErrorCode(err)).toBe('UNKNOWN_ERROR');
  });

  it.each([
    ['문자열', 'plain string'],
    ['undefined', undefined],
    ['null', null],
    ['code 를 가진 평범한 객체', { code: 'MAKESHOP_RATE_LIMITED' }],
    ['name 이 AbortError 인 평범한 객체', { name: 'AbortError' }],
  ])('Error 가 아닌 값(%s)은 UNKNOWN_ERROR 를 낸다', (_label, value) => {
    expect(resolveIterationErrorCode(value)).toBe('UNKNOWN_ERROR');
  });

  it.each([
    ['ErrorCode', 'HTTP_TIMEOUT'],
    ['EngineErrorCode', 'SERVER_INTERRUPTED'],
    ['MCP_ERROR_CODES', 'MCP_TIMEOUT'],
  ])('%s 값(%s)을 code 로 실은 에러는 그 값을 낸다', (_label, code) => {
    expect(
      resolveIterationErrorCode(Object.assign(new Error('x'), { code })),
    ).toBe(code);
  });

  // 소스 스캔은 `ErrorCode.X` 로 싣는 클래스를 보지 못한다. 실제 인스턴스로 확인한다.
  it('ErrorCode.X 로 code 를 싣는 클래스(ExecutionTimeLimitError)는 그 code 를 낸다', () => {
    expect(resolveIterationErrorCode(new ExecutionTimeLimitError(10, 5))).toBe(
      'EXECUTION_TIME_LIMIT_EXCEEDED',
    );
  });

  it('IntegrationError 의 code 를 낸다', () => {
    expect(
      resolveIterationErrorCode(
        new IntegrationError('INTEGRATION_CALL_FAILED', 'x'),
      ),
    ).toBe('INTEGRATION_CALL_FAILED');
  });

  // 질문 01a1aaea-8263 답 A2 — 런타임 · 드라이버 code 는 모양이 같아도 카탈로그에 없다.
  it.each([
    ['시스템 에러', 'ECONNREFUSED'],
    ['시스템 에러', 'ETIMEDOUT'],
    ['Node 내부 에러', 'ERR_INVALID_URL'],
    ['mysql2', 'ER_DUP_ENTRY'],
    ['모르는 UPPER_SNAKE_CASE', 'SOME_UNLISTED_CODE'],
  ])('%s code(%s)는 UNKNOWN_ERROR 를 낸다', (_label, code) => {
    expect(
      resolveIterationErrorCode(Object.assign(new Error('x'), { code })),
    ).toBe('UNKNOWN_ERROR');
  });
});

// 허용 목록(`ERROR_CLASS_CODES`)이 에러 클래스의 `code` 리터럴을 빠짐없이 담는지 본다.
// 빠지면 그 클래스의 값이 `UNKNOWN_ERROR` 로 바뀐다. 보는 형태는 셋이다.
//   1. 이름이 `…Error` 인 클래스의 `code` 필드 초기값 리터럴 (`readonly code = 'X'`, `as const` 포함)
//   2. 그 클래스의 `code` 필드 · 생성자 인자 타입의 문자열 리터럴 유니온
//   3. 생성자 첫 인자가 `code` 인 클래스를 `new X('CODE', …)` 로 만드는 리터럴
// `ErrorCode.X` 처럼 상수로 싣는 값과 변수로 넘기는 값은 보지 않는다(앞의 것은 허용 목록이 `ErrorCode` 를 통째로 담고
// 위 `resolveIterationErrorCode` 블록의 런타임 케이스가 확인한다). 이름이 `Error` 로 끝나지 않는 클래스도 보지 않는다.
describe('ERROR_CLASS_CODES 와 소스의 에러 클래스 code 리터럴', () => {
  const SRC_ROOT = path.resolve(__dirname, '../../..');
  const SKIP_SEGMENTS = new Set(['__tests__', '__test-utils__', 'testing']);

  function literalUnion(type: ts.TypeNode | undefined): string[] {
    if (!type) return [];
    if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) {
      return [type.literal.text];
    }
    if (ts.isUnionTypeNode(type)) return type.types.flatMap(literalUnion);
    return [];
  }

  function initializerLiteral(expr: ts.Expression | undefined): string[] {
    if (!expr) return [];
    if (ts.isAsExpression(expr)) return initializerLiteral(expr.expression);
    if (ts.isStringLiteral(expr)) return [expr.text];
    return [];
  }

  function scan(): {
    found: Map<string, string>;
    codeFirstArgClasses: Set<string>;
  } {
    const files = collectTsFiles(SRC_ROOT).filter(
      (f) =>
        !toPosixRelative(SRC_ROOT, f)
          .split('/')
          .some((seg) => SKIP_SEGMENTS.has(seg)),
    );
    const found = new Map<string, string>();
    const codeFirstArgClasses = new Set<string>();
    const sources: ts.SourceFile[] = [];
    const add = (code: string, file: string) => {
      if (!found.has(code)) found.set(code, toPosixRelative(SRC_ROOT, file));
    };

    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (!/\bcode\b/.test(text) || !/Error\b/.test(text)) continue;
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      sources.push(sf);
      const visit = (node: ts.Node): void => {
        if (ts.isClassDeclaration(node) && node.name?.text.endsWith('Error')) {
          for (const member of node.members) {
            if (
              ts.isPropertyDeclaration(member) &&
              ts.isIdentifier(member.name) &&
              member.name.text === 'code'
            ) {
              for (const c of [
                ...initializerLiteral(member.initializer),
                ...literalUnion(member.type),
              ]) {
                add(c, file);
              }
            }
            if (ts.isConstructorDeclaration(member)) {
              member.parameters.forEach((param, index) => {
                if (!ts.isIdentifier(param.name) || param.name.text !== 'code')
                  return;
                for (const c of literalUnion(param.type)) add(c, file);
                if (index === 0) codeFirstArgClasses.add(node.name!.text);
              });
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }

    for (const sf of sources) {
      const visit = (node: ts.Node): void => {
        if (
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          codeFirstArgClasses.has(node.expression.text)
        ) {
          const first = node.arguments?.[0];
          if (first && ts.isStringLiteral(first)) add(first.text, sf.fileName);
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    return { found, codeFirstArgClasses };
  }

  const { found, codeFirstArgClasses } = scan();

  it('스캔이 세 형태를 모두 잡는다 (공허한 통과 방지)', () => {
    expect(found.has('MAKESHOP_RATE_LIMITED')).toBe(true); // 1. 필드 초기값
    expect(found.has('INVALID_EXECUTION_STATE')).toBe(true); // 1. `as const`
    expect(found.has('RESUME_FAILED')).toBe(true); // 2. 생성자 인자 리터럴 유니온
    expect(codeFirstArgClasses.has('IntegrationError')).toBe(true);
    expect(found.has('INTEGRATION_TYPE_MISMATCH')).toBe(true); // 3. new IntegrationError('…')
  });

  it('소스의 에러 클래스 code 리터럴은 모두 허용 목록에 있다', () => {
    const missing = [...found]
      .filter(([code]) => !ITERATION_PASSTHROUGH_CODES.has(code))
      .map(([code, file]) => `${code} (${file})`);
    expect(missing).toEqual([]);
  });

  it('ERROR_CLASS_CODES 의 값은 아직 소스에 있다 (지운 클래스의 값이 남지 않는다)', () => {
    const stale = ERROR_CLASS_CODES.filter((code) => !found.has(code));
    expect(stale).toEqual([]);
  });
});
