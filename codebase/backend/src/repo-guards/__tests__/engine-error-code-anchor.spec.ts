/**
 * 엔진 레이어 에러 코드는 **앵커를 가져야 한다** — 맨 문자열 금지.
 *
 * ## 왜 있나
 *
 * `Execution.error.code` / `NodeExecution.error.code` 는 DB 에 영속되고 FE·알림·chat-channel
 * 분류기가 **값으로 분기**한다. 그런데 엔진이 쓰는 코드 중 넷은 상수도 타입도 없는 맨
 * 문자열이었다(2026-08-31 실측, 5지점):
 *
 *   EXECUTION_QUEUE_WAIT_TIMEOUT   execution-engine.service.ts   const code = '…'
 *   WEBCHAT_IDLE_TIMEOUT           execution-engine.service.ts   const code = '…'
 *   WORKER_HEARTBEAT_TIMEOUT       execution-engine.service.ts   code: '…'
 *   SERVER_INTERRUPTED             shutdown-state.service.ts     code: '…'  ×2
 *
 * 오탈자를 잡는 것이 **아무것도 없었다.** `WORKER_HEARTBEAT_TIMEOUT` 을 한 글자 틀리게 쓰면
 * DB 에는 그 오타가 들어가고, 그 값으로 분기하는 소비처는 조용히 else 로 떨어진다.
 *
 * ## 무엇을 강제하나
 *
 * 엔진 모듈의 `code`/`errorCode` 바인딩 UPPER_SNAKE 리터럴은 전부
 * `ErrorCode` · `EngineErrorCode` 둘 중 하나에 있거나, **다른 타입 앵커가 있다는 사유와 함께**
 * `ANCHORED_ELSEWHERE` 에 등재돼야 한다.
 *
 * 예외 목록을 둔 이유는 "봐주기" 가 아니다 — 클래스 `readonly code` 나 `details[].code`
 * 유니온처럼 **이미 붙잡는 타입이 있는** 값을 상수로 또 옮기면 앵커가 둘이 되어 갈라진다.
 */

import * as path from 'node:path';

import {
  ANCHORED_ELSEWHERE,
  collectBoundCodes,
  findUnanchored,
  readDeclaredCodes,
} from './engine-error-code-anchor-guard';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

describe('엔진 에러 코드 앵커 가드', () => {
  it('[전제] 상수 파일에서 코드를 실제로 읽어 온다', () => {
    const declared = readDeclaredCodes(REPO_ROOT);
    // 파서가 깨지면 `declared` 가 비고, 그러면 아래 본 단언이 **전부 위반으로 뒤집혀**
    // 시끄럽게 실패한다(조용한 통과가 아니다). 그래도 원인을 즉시 말해 주도록 고정한다.
    expect(declared.size).toBeGreaterThan(30);
    expect(declared).toContain('EXECUTION_QUEUE_WAIT_TIMEOUT'); // EngineErrorCode 쪽
    expect(declared).toContain('HTTP_TRANSPORT_FAILED'); // ErrorCode 쪽
  });

  it('[전제] 엔진 모듈에서 코드 리터럴을 실제로 수집한다', () => {
    // 스캐너가 0건을 내면 "위반 없음" 이 공허해진다.
    //
    // **하한을 고정 숫자로 두지 않는다.** 처음엔 `>= 10` 이라 적었다가 RED 를 맞았다 —
    // 리터럴을 상수 참조로 바꾸는 것이 이 작업의 목적이라, 성공할수록 이 수가 줄어든다.
    // 대신 **줄어들지 않는 것**에 묶는다: 예외 목록의 값들은 설계상 계속 리터럴로 남으므로
    // 스캐너가 살아 있으면 최소한 그만큼은 반드시 나온다.
    const hits = collectBoundCodes(REPO_ROOT);
    expect(hits.length).toBeGreaterThanOrEqual(
      Object.keys(ANCHORED_ELSEWHERE).length,
    );
  });

  describe('바인딩 형태 커버리지 (픽스처)', () => {
    // **라이브 소스로 형태를 단언하지 않는다.** 처음엔 그렇게 썼다가 RED 를 맞았다 —
    // `const code = 'X'` 형태를 없애는 것이 이 가드의 목적이라, 가드가 성공하는 순간
    // 그 형태가 소스에서 사라져 테스트가 자멸한다. 형태는 불변 픽스처로 고정한다.
    const found = new Set(
      collectBoundCodes(
        REPO_ROOT,
        'codebase/backend/src/repo-guards/__tests__',
      ).map((h) => h.code),
    );

    it.each([
      ['객체 속성', 'FIXTURE_OBJECT_FORM'],
      ['변수 선언 — 1차 정규식이 놓쳤던 형태', 'FIXTURE_VARIABLE_FORM'],
      ['클래스 필드', 'FIXTURE_CLASS_FIELD_FORM'],
      ['대입', 'FIXTURE_ASSIGNMENT_FORM'],
    ])('%s 를 수집한다', (_label, code) => {
      expect(found).toContain(code);
    });

    it('UPPER_SNAKE 가 아닌 값은 수집하지 않는다', () => {
      expect(found).not.toContain('lower_snake_value');
    });

    it('`code`/`errorCode` 가 아닌 바인딩은 수집하지 않는다', () => {
      expect(found).not.toContain('FIXTURE_WRONG_BINDING');
    });
  });

  it('앵커 없는 엔진 에러 코드가 없다', () => {
    const unanchored = findUnanchored(REPO_ROOT);
    // 위반 시 어디를 고쳐야 하는지 파일:줄 로 말해 준다 — 개수만 세면 역산해야 한다.
    expect(unanchored.map((h) => `${h.code} @ ${h.file}:${h.line}`)).toEqual(
      [],
    );
  });

  it('예외 목록의 모든 항목에 사유가 적혀 있다', () => {
    // 사유 없는 예외는 "미처리" 와 구분되지 않는다.
    for (const [code, reason] of Object.entries(ANCHORED_ELSEWHERE)) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(20);
      expect(code).toMatch(/^[A-Z][A-Z0-9_]+$/);
    }
  });

  it('예외 목록이 죽은 항목을 쌓지 않는다', () => {
    // 코드에서 사라진 값이 예외 목록에 남으면, 다음 사람이 "이건 왜 여기 있나" 를
    // 역산해야 한다. 실제로 쓰이는 값만 남긴다.
    const used = new Set(collectBoundCodes(REPO_ROOT).map((h) => h.code));
    const dead = Object.keys(ANCHORED_ELSEWHERE).filter((c) => !used.has(c));
    expect(dead).toEqual([]);
  });
});
