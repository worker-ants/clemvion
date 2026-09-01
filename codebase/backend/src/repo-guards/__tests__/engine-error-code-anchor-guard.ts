// 엔진 레이어 에러 코드가 **앵커 없이 맨 문자열로** 새로 생기는 것을 막는 가드의 순수 로직.
//
// 소비처는 형제 파일 `engine-error-code-anchor.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드 `redis-fail-open-catalog-guard.ts`
// 와 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/** 검사 대상 디렉터리 (저장소 루트 기준). */
export const ENGINE_DIR = 'codebase/backend/src/modules/execution-engine';

/** 코드 상수가 선언된 파일 (저장소 루트 기준). */
export const CODES_SOURCE = 'codebase/backend/src/nodes/core/error-codes.ts';

/** 값을 읽어 올 const 이름. 오탈자가 조용히 "0건" 을 만들지 않도록 상수로 둔다. */
export const CODE_CONST_NAMES = ['ErrorCode', 'EngineErrorCode'] as const;

/** 코드 값이 바인딩되는 식별자 — `code: 'X'` · `const code = 'X'` · `errorCode` 형태. */
export const CODE_BINDING_NAMES = new Set(['code', 'errorCode']);

/**
 * 맨 문자열이어도 통과시키는 예외 — **이미 다른 타입 앵커가 있는** 값들.
 *
 * 여기 옮겨 넣으면 앵커가 **두 개**가 되어 오히려 나빠진다(둘이 갈라질 수 있다).
 * 새 항목을 넣을 때는 "그 값을 붙잡는 타입이 어디 있는가" 를 사유에 적을 것 —
 * 사유가 "아직 안 옮겼다" 면 그건 예외가 아니라 미처리다.
 */
export const ANCHORED_ELSEWHERE: Record<string, string> = {
  INVALID_EXECUTION_STATE:
    'workflow-errors.ts `InvalidExecutionStateError.code` 클래스 필드 (`readonly … as const`)',
  ERROR_PORT_FALLBACK:
    'execution-engine.service.ts `ErrorPortFallbackError.code` 클래스 필드',
  // 아래 넷은 봉투 `code` 가 아니라 `error.details[].code` 레이어다 —
  // `spec/conventions/error-codes.md §4.2` 가 소유하며 `TriggerParameterErrorDetail['code']`
  // 유니온이 붙잡는다(오탈자는 `tsc` 에서 죽는다).
  MISSING_REQUIRED_FIELD:
    "trigger-parameter.types.ts `TriggerParameterErrorDetail['code']` 유니온",
  TYPE_COERCION_FAILED:
    "trigger-parameter.types.ts `TriggerParameterErrorDetail['code']` 유니온",
  INVALID_SCHEMA:
    "trigger-parameter.types.ts `TriggerParameterErrorDetail['code']` 유니온",
  MASKED_VALUE_RESUBMITTED:
    "trigger-parameter.types.ts `TriggerParameterErrorDetail['code']` 유니온",
  // 아래 셋은 `new RehydrationError('RESUME_…', msg)` 의 **생성자 positional 인자**다.
  // `ai-conversation-helpers.ts` 의 `RehydrationError.code` 가 리터럴 유니온으로 선언돼
  // 있어 오탈자는 `tsc` 에서 죽는다.
  RESUME_CHECKPOINT_MISSING:
    'ai-conversation-helpers.ts `RehydrationError.code` 리터럴 유니온 (생성자 인자)',
  RESUME_INCOMPATIBLE_STATE:
    'ai-conversation-helpers.ts `RehydrationError.code` 리터럴 유니온 (생성자 인자)',
};

/** UPPER_SNAKE_CASE 만 코드 후보로 본다 (`'text'`·`'json'` 같은 값 제외). */
const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

export interface BareCodeHit {
  code: string;
  file: string;
  line: number;
}

/**
 * `error-codes.ts` 의 두 const 에서 값 전체를 뽑는다.
 *
 * **정규식이 아니라 AST 로 읽는다** — JSDoc 안의 예시(`` `EXECUTION_TIMEOUT` ``)가 값으로
 * 잡히면 가드가 자기 오판을 사실로 굳힌다. 이 파일은 주석 비중이 높아 실제 위험이다.
 */
export function readDeclaredCodes(repoRoot: string): Set<string> {
  const abs = path.join(repoRoot, CODES_SOURCE);
  const sf = ts.createSourceFile(
    abs,
    fs.readFileSync(abs, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const out = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      (CODE_CONST_NAMES as readonly string[]).includes(node.name.text) &&
      node.initializer
    ) {
      const init = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (ts.isObjectLiteralExpression(init)) {
        for (const prop of init.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isStringLiteral(prop.initializer)
          ) {
            out.add(prop.initializer.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsFiles(p));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
      out.push(p);
  }
  return out;
}

/**
 * 엔진 모듈에서 `code`/`errorCode` 에 바인딩된 UPPER_SNAKE 문자열 리터럴을 **전수** 수집.
 *
 * **왜 AST 인가 — 정규식이 이미 한 번 놓쳤다.** 이 가드를 만들며 돌린 1차 정규식 스캔은
 * `code:\s*'X'` 만 봐서 `const code = 'EXECUTION_QUEUE_WAIT_TIMEOUT'` 를 통째로 놓쳤다.
 * 바인딩 형태를 하나씩 정규식에 더하는 방식은 **다음 형태를 미리 알 수 없어** 같은 실패를
 * 반복한다. AST 는 "식별자에 문자열이 붙는다" 를 형태와 무관하게 본다.
 *
 * 수집 대상 **5형태**: 객체 속성(`{ code: 'X' }`) · 변수 선언(`const code = 'X'`) ·
 * 대입(`code = 'X'`) · 클래스 필드(`readonly code = 'X'`) · **`new XxxError('X', …)` 의
 * positional 인자**.
 *
 * 다섯 번째는 리뷰(`20_43_35` W1)가 잡았다 — 앞 네 형태만 보던 판이 docstring 에는
 * *"엔진 모듈에 새 맨 문자열 코드가 생기면 RED"* 라 적고 있었다. `RehydrationError` 가
 * 코드를 생성자 인자로 받으므로 `RESUME_*` 세 값이 **주장 밖**에 있었다. 보장을 좁히는
 * 대신 스캔을 넓혔다 — 좁히면 다음 사람이 그 경계를 다시 밟는다.
 *
 * 생성자는 **이름이 `Error` 로 끝나는 것**만 본다. 임의 생성자의 문자열 인자까지 받으면
 * 코드와 무관한 UPPER_SNAKE 상수가 위반으로 잡혀 예외 목록이 알리바이로 부푼다.
 *
 * ## 여기서 형태 넓히기를 멈춘다 — 경계와 그 이유
 *
 * **일반 메서드 인자로 넘기는 형태는 보지 않는다.** 실측 예:
 * `markExecutionCancelled(executionId, 'RESUME_FAILED')`. 다섯 형태로 넓힌 직후 이것이
 * 여섯 번째로 나왔고, 그때 멈췄다.
 *
 * 이유는 **형태 공간이 열려 있기 때문**이다. "임의 함수의 임의 문자열 인자" 까지 받으면
 * 코드와 무관한 UPPER_SNAKE 값이 대량으로 잡혀 예외 목록이 부풀고, 그 목록이 커지는 순간
 * 가드는 *"무엇이 위반인가"* 를 스스로 말하지 못하게 된다. 한 칸씩 넓히는 대응은 다음
 * 형태에서 같은 자리를 다시 밟는다 — 이 브랜치가 이미 그 계단을 여러 번 밟았다.
 *
 * **그 자리를 무엇이 막는가**: 그런 호출부의 파라미터는 리터럴 유니온으로 선언돼 있어
 * (`execution-engine.service.ts` 의 `'RESUME_CHECKPOINT_MISSING' | 'RESUME_FAILED' | …`)
 * 오탈자가 `tsc` 에서 죽는다. 즉 이 가드가 막는 것은 **앵커가 아예 없는** 자리고, 타입이
 * 이미 붙잡는 자리는 그 타입이 맡는다. 이 가드의 보장은 **딱 다섯 형태**다 — 그보다 넓게
 * 읽히지 않도록 여기 적어 둔다.
 */
export function collectBoundCodes(
  repoRoot: string,
  /**
   * 스캔 대상 디렉터리 (저장소 루트 기준). 기본값은 엔진 모듈.
   *
   * 형태 커버리지 테스트가 **픽스처 디렉터리**를 넘기기 위해 열어 둔다 — 라이브 소스로
   * 형태를 단언하면 가드가 성공하는 순간 그 형태가 사라져 테스트가 자멸한다(실측).
   */
  relDir: string = ENGINE_DIR,
): BareCodeHit[] {
  const root = path.join(repoRoot, relDir);
  const hits: BareCodeHit[] = [];

  for (const abs of walkTsFiles(root)) {
    const sf = ts.createSourceFile(
      abs,
      fs.readFileSync(abs, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const record = (name: string, literal: ts.Node): void => {
      if (!CODE_BINDING_NAMES.has(name)) return;
      if (!ts.isStringLiteral(literal)) return;
      if (!UPPER_SNAKE.test(literal.text)) return;
      hits.push({
        code: literal.text,
        file: path.relative(repoRoot, abs),
        line: sf.getLineAndCharacterOfPosition(literal.getStart(sf)).line + 1,
      });
    };

    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
        record(node.name.text, node.initializer);
      } else if (
        (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        const init = ts.isAsExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer;
        record(node.name.text, init);
      } else if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text.endsWith('Error')
      ) {
        for (const arg of node.arguments ?? []) {
          if (ts.isStringLiteral(arg) && UPPER_SNAKE.test(arg.text)) {
            hits.push({
              code: arg.text,
              file: path.relative(repoRoot, abs),
              line: sf.getLineAndCharacterOfPosition(arg.getStart(sf)).line + 1,
            });
          }
        }
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const lhs = node.left;
        const name = ts.isIdentifier(lhs)
          ? lhs.text
          : ts.isPropertyAccessExpression(lhs)
            ? lhs.name.text
            : undefined;
        if (name) record(name, node.right);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return hits;
}

/**
 * 엔진 사이트의 **맨 문자열 코드**를 남긴다 — 그 값이 상수에 있든 없든.
 *
 * ## 왜 "값이 상수에 있으면 통과" 가 아닌가 (뮤테이션이 잡은 설계 결함)
 *
 * 첫 판은 `!declared.has(code)` 로 걸렀다. 즉 *"모르는 코드 값"* 을 찾는 가드였다.
 * 뮤테이션으로 확인하니 **`code: EngineErrorCode.SERVER_INTERRUPTED` 를
 * `code: 'SERVER_INTERRUPTED'` 로 되돌려도 GREEN** 이었다 — 값이 이미 상수에 있으니까.
 * 이 가드가 막으려던 바로 그 회귀를 통과시킨 것이다.
 *
 * 막으려는 것은 "모르는 값" 이 아니라 **"상수를 안 거치는 사이트"** 다. 그래서 판정을
 * 값이 아니라 **형태**로 옮겼다: 엔진 모듈에서 `code`/`errorCode` 에 UPPER_SNAKE 문자열
 * 리터럴을 직접 붙이면 위반이고, 처방은 언제나 같다 — 상수를 참조하라.
 *
 * 유일한 예외는 `ANCHORED_ELSEWHERE` — **다른 타입이 이미 그 값을 붙잡고 있어서** 상수로
 * 또 옮기면 앵커가 둘이 되는 경우다.
 */
export function findUnanchored(
  repoRoot: string,
  /**
   * 스캔 대상 디렉터리. 기본값은 엔진 모듈.
   *
   * 픽스처를 넘길 수 있게 열어 둔다 — 그러지 않으면 *"위반을 실제로 검출하는가"* 를
   * **저장소가 지금 클린하다는 사실에만** 기대어 확인하게 된다. 그건 음성 결과이지
   * 검출 능력의 증거가 아니다.
   */
  relDir?: string,
): BareCodeHit[] {
  return collectBoundCodes(repoRoot, relDir).filter(
    (h) => !(h.code in ANCHORED_ELSEWHERE),
  );
}
