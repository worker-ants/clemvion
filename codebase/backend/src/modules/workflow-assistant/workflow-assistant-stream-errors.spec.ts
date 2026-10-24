import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE,
  ASSISTANT_STREAM_ERROR_MESSAGES,
  noLlmConfigMessage,
  toClientStreamErrorMessage,
  tooManyToolCallsMessage,
} from './workflow-assistant-stream-errors';

/**
 * REQ-ASSIST-048 — 어시스턴트 SSE `error` 이벤트의 `message` 는 이 모듈의 표 ·
 * 함수에서만 온다. 서버는 코드별 고정 영문만 보낸다.
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
/** 한도 숫자가 문구에 들어가 표 대신 함수(`tooManyToolCallsMessage`)로 두는 코드. */
const FUNCTION_CODES = ['ASSISTANT_TOO_MANY_TOOL_CALLS'];

/**
 * 프런트엔드 `ERROR_MESSAGE_KEYS` 의 코드. 두 패키지가 공유하는 상수가 없어서
 * 소스의 `new Map([["CODE", "assistant.key"], ...])` 리터럴에서 키를 뽑는다.
 */
function frontendErrorMessageCodes(): string[] {
  const source = readFileSync(
    join(
      __dirname,
      '../../../../frontend/src/components/editor/assistant-panel/assistant-message.tsx',
    ),
    'utf8',
  );
  const literal =
    /ERROR_MESSAGE_KEYS\b[^=]*=\s*new Map\(\[([\s\S]*?)\]\);/.exec(source);
  if (!literal) {
    throw new Error('ERROR_MESSAGE_KEYS Map literal not found');
  }
  return [...literal[1].matchAll(/\[\s*"([A-Z][A-Z0-9_]*)"\s*,/g)].map(
    (m) => m[1],
  );
}

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

describe('toClientStreamErrorMessage', () => {
  it.each(Object.entries(ASSISTANT_STREAM_ERROR_MESSAGES))(
    'returns the table message for %s',
    (code, message) => {
      expect(toClientStreamErrorMessage(code)).toBe(message);
    },
  );

  it('falls back to the fixed message for a code that is not in the table', () => {
    expect(toClientStreamErrorMessage('LLM_SOMETHING_NEW')).toBe(
      ASSISTANT_STREAM_ERROR_FALLBACK_MESSAGE,
    );
  });

  // `code in table` 로 바꾸면 프로토타입 키가 함수 값을 돌려주고, 그 `message` 는
  // JSON 직렬화에서 빠져 프런트엔드가 `message` 없는 이벤트를 받는다.
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'falls back for the prototype key %s',
    (code) => {
      const message = toClientStreamErrorMessage(code);
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

describe('noLlmConfigMessage', () => {
  it('uses the table message when no usable config exists', () => {
    expect(noLlmConfigMessage(true)).toBe(
      ASSISTANT_STREAM_ERROR_MESSAGES.ASSISTANT_NO_LLM_CONFIG,
    );
  });

  it('uses a separate fixed message when resolving the config failed', () => {
    const message = noLlmConfigMessage(false);
    expect(message).toBe('Failed to resolve LLM config.');
    expect(message).not.toBe(noLlmConfigMessage(true));
  });
});

describe('tooManyToolCallsMessage', () => {
  it.each([
    ['round-limit', 50, 'round limit (50)'],
    ['tool-call-budget', 48, 'tool-call budget (48)'],
  ] as const)(
    'builds a fixed English message for %s',
    (kind, limit, expected) => {
      const message = tooManyToolCallsMessage(kind, limit);
      expect(message).toContain(expected);
      expect(message).toMatch(/follow-up message/);
      // 한국어 예시 문구를 싣지 않는다 (CLE-UI-I18N 규칙 3).
      expect(message).not.toMatch(/[가-힣]/);
    },
  );
});
