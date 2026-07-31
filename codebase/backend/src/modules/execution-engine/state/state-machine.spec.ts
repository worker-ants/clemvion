import { canTransition, assertTransition } from './state-machine';
import { ExecutionStatus } from '../../executions/entities/execution.entity';

describe('StateMachine', () => {
  describe('canTransition', () => {
    it('should allow pending -> running', () => {
      expect(
        canTransition(ExecutionStatus.PENDING, ExecutionStatus.RUNNING),
      ).toBe(true);
    });

    it('should allow pending -> cancelled', () => {
      expect(
        canTransition(ExecutionStatus.PENDING, ExecutionStatus.CANCELLED),
      ).toBe(true);
    });

    it('should allow running -> completed', () => {
      expect(
        canTransition(ExecutionStatus.RUNNING, ExecutionStatus.COMPLETED),
      ).toBe(true);
    });

    it('should allow running -> failed', () => {
      expect(
        canTransition(ExecutionStatus.RUNNING, ExecutionStatus.FAILED),
      ).toBe(true);
    });

    it('should allow running -> cancelled', () => {
      expect(
        canTransition(ExecutionStatus.RUNNING, ExecutionStatus.CANCELLED),
      ).toBe(true);
    });

    it('should allow running -> waiting_for_input', () => {
      expect(
        canTransition(
          ExecutionStatus.RUNNING,
          ExecutionStatus.WAITING_FOR_INPUT,
        ),
      ).toBe(true);
    });

    it('should allow waiting_for_input -> running', () => {
      expect(
        canTransition(
          ExecutionStatus.WAITING_FOR_INPUT,
          ExecutionStatus.RUNNING,
        ),
      ).toBe(true);
    });

    it('should allow waiting_for_input -> cancelled', () => {
      expect(
        canTransition(
          ExecutionStatus.WAITING_FOR_INPUT,
          ExecutionStatus.CANCELLED,
        ),
      ).toBe(true);
    });

    it('should disallow completed -> running', () => {
      expect(
        canTransition(ExecutionStatus.COMPLETED, ExecutionStatus.RUNNING),
      ).toBe(false);
    });

    // spec/5-system/6-websocket-protocol.md §4.2 / 4-execution-engine.md §1.3 —
    // execution.retry_last_turn 재진입은 FAILED Execution 을 RUNNING 으로
    // 전이시켜 spawn 된 노드 turn 을 구동한다 (retry 전용 전이).
    // W5 하드닝 — 이 전이는 `allowRetryReentry` opt-in 으로만 허용된다. 일반
    // 호출(opts 없음)은 거부해 실패 종결 실행의 우발적 부활을 차단한다.
    it('should disallow failed -> running without retry opt-in (W5)', () => {
      expect(
        canTransition(ExecutionStatus.FAILED, ExecutionStatus.RUNNING),
      ).toBe(false);
    });

    it('should allow failed -> running with retry opt-in (retry_last_turn re-entry)', () => {
      expect(
        canTransition(ExecutionStatus.FAILED, ExecutionStatus.RUNNING, {
          allowRetryReentry: true,
        }),
      ).toBe(true);
    });

    // ai-review CRITICAL #1 (2026-07-30) — retry 재진입 turn 이 **계속**되면
    // `reparkAiResumeTurn` 이 `FAILED → WAITING_FOR_INPUT` 전이를 요구한다. 이
    // opt-in 이 없으면 `assertTransition` 이 동기 throw 하고 그 일반 예외 메시지가
    // EXECUTION_FAILED payload 로 노출된다(동시성 무관, 매 호출 결정적 실패).
    // multi-turn 재진입에서 가장 흔한 경로다.
    it('should disallow failed -> waiting_for_input without retry opt-in', () => {
      expect(
        canTransition(
          ExecutionStatus.FAILED,
          ExecutionStatus.WAITING_FOR_INPUT,
        ),
      ).toBe(false);
    });

    it('should allow failed -> waiting_for_input with retry opt-in (turn 계속 → re-park)', () => {
      expect(
        canTransition(
          ExecutionStatus.FAILED,
          ExecutionStatus.WAITING_FOR_INPUT,
          { allowRetryReentry: true },
        ),
      ).toBe(true);
    });

    // 표(ALLOWED_TRANSITIONS[FAILED])는 여전히 비어 있어야 한다 — opt-in 만 넓히고
    // 일반 경로는 그대로 차단한다는 것이 이 설계의 요지다.
    it('should keep failed terminal for every other target even with opt-in', () => {
      for (const to of [
        ExecutionStatus.COMPLETED,
        ExecutionStatus.CANCELLED,
        ExecutionStatus.PENDING,
      ]) {
        expect(
          canTransition(ExecutionStatus.FAILED, to, {
            allowRetryReentry: true,
          }),
        ).toBe(false);
      }
    });

    // opt-in 은 FAILED → RUNNING 외 전이에는 영향을 주지 않는다.
    it('should not let retry opt-in widen other transitions (W5)', () => {
      expect(
        canTransition(ExecutionStatus.CANCELLED, ExecutionStatus.RUNNING, {
          allowRetryReentry: true,
        }),
      ).toBe(false);
      expect(
        canTransition(ExecutionStatus.FAILED, ExecutionStatus.COMPLETED, {
          allowRetryReentry: true,
        }),
      ).toBe(false);
    });

    it('should disallow cancelled -> running', () => {
      expect(
        canTransition(ExecutionStatus.CANCELLED, ExecutionStatus.RUNNING),
      ).toBe(false);
    });

    it('should disallow pending -> completed', () => {
      expect(
        canTransition(ExecutionStatus.PENDING, ExecutionStatus.COMPLETED),
      ).toBe(false);
    });

    it('should disallow pending -> failed', () => {
      expect(
        canTransition(ExecutionStatus.PENDING, ExecutionStatus.FAILED),
      ).toBe(false);
    });

    it('should return false for unknown states', () => {
      expect(canTransition('unknown', ExecutionStatus.RUNNING)).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() =>
        assertTransition(ExecutionStatus.PENDING, ExecutionStatus.RUNNING),
      ).not.toThrow();
    });

    it('should throw for invalid transitions', () => {
      expect(() =>
        assertTransition(ExecutionStatus.COMPLETED, ExecutionStatus.RUNNING),
      ).toThrow('Invalid state transition');
    });

    // WARNING #3 / INFO #25 — `allowRetryReentry` opt-in 이 assertTransition 에도
    // 정상 전파되는지 확인. failed → running 은 opts 없으면 throw, opts 있으면 통과.
    it('should not throw for failed -> running with retry opt-in', () => {
      expect(() =>
        assertTransition(ExecutionStatus.FAILED, ExecutionStatus.RUNNING, {
          allowRetryReentry: true,
        }),
      ).not.toThrow();
    });

    it('should throw for failed -> running without retry opt-in', () => {
      expect(() =>
        assertTransition(ExecutionStatus.FAILED, ExecutionStatus.RUNNING),
      ).toThrow('Invalid state transition');
    });
  });
});
