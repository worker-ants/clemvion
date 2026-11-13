import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LlmStreamErrorCode } from '../llm/interfaces/llm-client.interface';
import {
  ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE,
  ASSISTANT_STREAM_ERROR_MESSAGES,
  assistantStreamError,
  type AssistantStreamError,
  type AssistantStreamErrorCode,
} from './workflow-assistant-stream-errors';

/**
 * REQ-ASSIST-048 — 어시스턴트 SSE `error` 이벤트의 `{ code, message }` 는 이 모듈의
 * 빌더(`assistantStreamError`)에서만 온다. 서버는 코드별 고정 영문만 보낸다.
 */

/**
 * 이 모듈이 문구를 정하는 모든 SSE `error` 코드. 프런트엔드 `ERROR_MESSAGE_KEYS`
 * (`assistant-message.tsx`)가 같은 집합을 사전 키로 덮어야 한다. 아래
 * "matches the frontend ERROR_MESSAGE_KEYS" 테스트가 프런트엔드 소스를 읽어
 * 맞춰 본다.
 */
const TABLE_CODES = [
  'ASSISTANT_NO_LLM_CONFIG',
  'ASSISTANT_STREAM_FAILED',
  'LLM_CONNECTION_ERROR',
  'LLM_OUTPUT_MALFORMED',
  'LLM_RATE_LIMIT',
];
/** 한도 숫자가 문구에 들어가 표 대신 `assistantStreamError.tooManyToolCalls` 가 문구를 만드는 코드. */
const FUNCTION_CODES = ['ASSISTANT_TOO_MANY_TOOL_CALLS'];

/**
 * 프런트엔드 짝 표(`ERROR_MESSAGE_KEYS`)가 있는 파일. `backend-checks.yml` 의
 * pathspecs 에도 이 파일이 있어서 이 파일만 바꾼 PR 에서도 아래 대조가 돈다
 * (`.claude/tests/test_assistant_error_codes_ci_coverage.py` 가 이 경로를 읽어 확인한다).
 */
const FRONTEND_TABLE_FILE = join(
  __dirname,
  '../../../../frontend/src/components/editor/assistant-panel/assistant-message.tsx',
);

/** 이 테스트가 읽을 수 있는 `ERROR_MESSAGE_KEYS` 선언 형태. 파싱 실패 메시지에 싣는다. */
const REQUIRED_LITERAL_SHAPE = [
  'export const ERROR_MESSAGE_KEYS: ReadonlyMap<string, TranslationKey> = new Map([',
  '  ["CODE", "assistant.key"],',
  '  ...',
  ']);',
].join('\n');

/**
 * 프런트엔드 소스에서 `ERROR_MESSAGE_KEYS` 의 코드를 뽑는다. 두 패키지가 공유하는
 * 상수가 없어서 선언 줄(`export const ERROR_MESSAGE_KEYS`)에서 시작하는
 * `new Map([...])` 리터럴을 읽는다. 식별자의 다른 등장(사용처)에서 시작하면 그
 * 뒤의 엉뚱한 Map 을 읽을 수 있어서 선언 줄로 묶는다. 선언을 못 찾거나 코드를 하나도
 * 뽑지 못하면 지켜야 할 리터럴 형태를 실어 던진다.
 */
function extractErrorMessageCodes(source: string): string[] {
  const literal =
    /^export const ERROR_MESSAGE_KEYS\b[^=\n]*=\s*new Map\(\[([\s\S]*?)\]\);/m.exec(
      source,
    );
  if (!literal) {
    throw new Error(
      `ERROR_MESSAGE_KEYS declaration not found in ${FRONTEND_TABLE_FILE}. Keep this shape:\n${REQUIRED_LITERAL_SHAPE}`,
    );
  }
  const codes = [...literal[1].matchAll(/\[\s*"([A-Z][A-Z0-9_]*)"\s*,/g)].map(
    (m) => m[1],
  );
  if (codes.length === 0) {
    throw new Error(
      `No ["CODE", ...] entry could be read from ERROR_MESSAGE_KEYS. Keep this shape:\n${REQUIRED_LITERAL_SHAPE}`,
    );
  }
  return codes;
}

function frontendErrorMessageCodes(): string[] {
  return extractErrorMessageCodes(readFileSync(FRONTEND_TABLE_FILE, 'utf8'));
}

describe('extractErrorMessageCodes', () => {
  it('reads the codes of the exported declaration', () => {
    const source = [
      'export const ERROR_MESSAGE_KEYS: ReadonlyMap<string, TranslationKey> = new Map([',
      '  ["A_CODE", "assistant.a"],',
      '  ["B_CODE", "assistant.b"],',
      ']);',
    ].join('\n');
    expect(extractErrorMessageCodes(source)).toEqual(['A_CODE', 'B_CODE']);
  });

  it('reads the declaration, not a Map that follows an earlier use of the name', () => {
    // 사용처에서 매칭을 시작하면 그 뒤 첫 `= new Map([...])` 를 읽는다.
    const source = [
      'const hint = ERROR_MESSAGE_KEYS.get(code);',
      'const OTHER = new Map([["WRONG_CODE", "x"]]);',
      'export const ERROR_MESSAGE_KEYS: ReadonlyMap<string, TranslationKey> = new Map([',
      '  ["RIGHT_CODE", "assistant.right"],',
      ']);',
    ].join('\n');
    expect(extractErrorMessageCodes(source)).toEqual(['RIGHT_CODE']);
  });

  it('reads a declaration that prettier wrapped after `=`', () => {
    const source = [
      'export const ERROR_MESSAGE_KEYS: ReadonlyMap<string, TranslationKey> =',
      '  new Map([',
      '    ["A_CODE", "assistant.a"],',
      '  ]);',
    ].join('\n');
    expect(extractErrorMessageCodes(source)).toEqual(['A_CODE']);
  });

  it('fails with the required shape when the declaration is missing', () => {
    const source = 'const ERROR_MESSAGE_KEYS = new Map([["A_CODE", "a"]]);';
    expect(() => extractErrorMessageCodes(source)).toThrow(
      REQUIRED_LITERAL_SHAPE,
    );
  });

  it('fails with the required shape when no entry can be read', () => {
    // 작은따옴표 항목은 추출식이 읽지 못한다. 빈 목록으로 대조를 통과시키지 않는다.
    const source = [
      'export const ERROR_MESSAGE_KEYS = new Map([',
      "  ['A_CODE', 'assistant.a'],",
      ']);',
    ].join('\n');
    expect(() => extractErrorMessageCodes(source)).toThrow(
      REQUIRED_LITERAL_SHAPE,
    );
  });
});

describe('ASSISTANT_STREAM_ERROR_MESSAGES', () => {
  it('covers exactly the listed codes (with the function-built code)', () => {
    expect(
      [
        ...Object.keys(ASSISTANT_STREAM_ERROR_MESSAGES),
        ...FUNCTION_CODES,
      ].sort(),
    ).toEqual([...TABLE_CODES, ...FUNCTION_CODES].sort());
  });

  it('matches the frontend ERROR_MESSAGE_KEYS', () => {
    expect(frontendErrorMessageCodes().sort()).toEqual(
      [
        ...Object.keys(ASSISTANT_STREAM_ERROR_MESSAGES),
        ...FUNCTION_CODES,
      ].sort(),
    );
  });

  it.each(Object.entries(ASSISTANT_STREAM_ERROR_MESSAGES))(
    '%s has a fixed English message with no provider detail',
    (_code, message) => {
      expect(message.length).toBeGreaterThan(0);
      // 한국어를 싣지 않는다 (CLE-UI-I18N 규칙 3).
      expect(message).not.toMatch(/[가-힣]/);
      // URL · 키 조각 · 응답 본문이 새는 회귀를 막는다.
      expect(message).not.toMatch(/https?:/i);
      expect(message).not.toContain('sk-');
      expect(message).not.toMatch(/[{}]/);
    },
  );

  it('does not blame the provider for ASSISTANT_STREAM_FAILED', () => {
    // 이 코드는 스트림을 열기 전 실패와 턴 처리 중 내부 실패를 함께 담는다.
    expect(ASSISTANT_STREAM_ERROR_MESSAGES.ASSISTANT_STREAM_FAILED).not.toMatch(
      /provider/i,
    );
  });
});

describe('assistantStreamError', () => {
  describe('fromLlm', () => {
    it.each([
      'LLM_RATE_LIMIT',
      'LLM_CONNECTION_ERROR',
      'LLM_OUTPUT_MALFORMED',
    ] as const)('keeps the %s code with the table message', (code) => {
      expect(assistantStreamError.fromLlm(code)).toEqual({
        code,
        message: ASSISTANT_STREAM_ERROR_MESSAGES[code],
      });
    });

    // 타입은 위 세 코드로 닫혀 있지만 클라이언트가 런타임에 다른 문자열을 보낼 수 있다.
    // 코드는 그대로 넘기고 문구만 고정 영문으로 바꾼다.
    it('falls back to the fixed message for a code that is not in the table', () => {
      expect(
        assistantStreamError.fromLlm('LLM_SOMETHING_NEW' as LlmStreamErrorCode),
      ).toEqual({
        code: 'LLM_SOMETHING_NEW',
        message: ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE,
      });
    });

    // `code in table` 로 바꾸면 프로토타입 키가 함수 값을 돌려주고, 그 `message` 는
    // JSON 직렬화에서 빠져 프런트엔드가 `message` 없는 이벤트를 받는다.
    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
      'falls back for the prototype key %s',
      (code) => {
        const { message } = assistantStreamError.fromLlm(
          code as LlmStreamErrorCode,
        );
        expect(message).toBe(ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE);
        expect(typeof message).toBe('string');
      },
    );

    it('has a fallback without provider detail', () => {
      expect(ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE).not.toMatch(/[가-힣]/);
      expect(ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE).not.toMatch(/https?:/i);
      expect(ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE).not.toContain('sk-');
    });
  });

  describe('noLlmConfig', () => {
    it('uses the table message when no usable config exists', () => {
      expect(assistantStreamError.noLlmConfig()).toEqual({
        code: 'ASSISTANT_NO_LLM_CONFIG',
        message: ASSISTANT_STREAM_ERROR_MESSAGES.ASSISTANT_NO_LLM_CONFIG,
      });
    });
  });

  describe('streamFailed', () => {
    it('uses the table message', () => {
      expect(assistantStreamError.streamFailed()).toEqual({
        code: 'ASSISTANT_STREAM_FAILED',
        message: ASSISTANT_STREAM_ERROR_MESSAGES.ASSISTANT_STREAM_FAILED,
      });
    });
  });

  describe('tooManyToolCalls', () => {
    it.each([
      ['round-limit', 50, 'round limit (50)', 'tool-call budget'],
      ['tool-call-budget', 48, 'tool-call budget (48)', 'round limit'],
    ] as const)(
      'builds a fixed English message for %s',
      (kind, limit, expected, otherKind) => {
        const event = assistantStreamError.tooManyToolCalls(kind, limit);
        expect(event.code).toBe('ASSISTANT_TOO_MANY_TOOL_CALLS');
        expect(event.message).toContain(expected);
        expect(event.message).not.toContain(otherKind);
        expect(event.message).toMatch(/follow-up message/);
        // 한국어 예시 문구를 싣지 않는다 (CLE-UI-I18N 규칙 3).
        expect(event.message).not.toMatch(/[가-힣]/);
      },
    );
  });

  // 빌더 결과는 SSE `data` 로 그대로 직렬화된다. 타입 표지는 런타임 값에 없다.
  it.each([
    ['fromLlm', () => assistantStreamError.fromLlm('LLM_RATE_LIMIT')],
    ['noLlmConfig', () => assistantStreamError.noLlmConfig()],
    ['streamFailed', () => assistantStreamError.streamFailed()],
    [
      'tooManyToolCalls',
      () => assistantStreamError.tooManyToolCalls('round-limit', 50),
    ],
  ] as const)('%s returns a plain { code, message } object', (_name, build) => {
    const event = build();
    expect(Object.keys(event).sort()).toEqual(['code', 'message']);
    expect(JSON.parse(JSON.stringify(event))).toEqual(event);
  });

  /**
   * 코드 유니온과 빌더 표지는 타입 검사에서만 동작한다. jest 는 타입을 지우므로 이
   * 단언은 build 단계의 타입체크 ratchet(`tsconfig.json` 이 spec 을 포함한다)이 본다.
   * 제약이 풀리면 아래 `@ts-expect-error` 가 «쓰이지 않는 지시어»(TS2578)가 되어
   * ratchet 이 늘어난다.
   */
  it('rejects unknown codes and hand-built payloads (types — the build typecheck ratchet checks)', () => {
    // @ts-expect-error — 유니온 밖의 코드는 SSE `error` 코드가 아니다
    const unknownCode: AssistantStreamErrorCode = 'ASSISTANT_TYPO';
    // @ts-expect-error — 빌더를 거치지 않은 객체는 `AssistantStreamError` 가 아니다
    const handBuilt: AssistantStreamError = {
      code: 'ASSISTANT_STREAM_FAILED',
      message: ASSISTANT_STREAM_ERROR_MESSAGES.ASSISTANT_STREAM_FAILED,
    };
    // @ts-expect-error — 어시스턴트 코드는 LLM 클라이언트 코드 자리에 넣을 수 없다
    assistantStreamError.fromLlm('ASSISTANT_STREAM_FAILED');
    expect([unknownCode, handBuilt]).toHaveLength(2);
  });
});
