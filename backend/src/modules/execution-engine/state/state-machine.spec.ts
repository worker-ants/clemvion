import { canTransition, assertTransition } from './state-machine';
import { ExecutionStatus } from '../../executions/entities/execution.entity';

describe('StateMachine', () => {
  describe('canTransition', () => {
    it('should allow pending -> running', () => {
      expect(canTransition(ExecutionStatus.PENDING, ExecutionStatus.RUNNING)).toBe(true);
    });

    it('should allow pending -> cancelled', () => {
      expect(canTransition(ExecutionStatus.PENDING, ExecutionStatus.CANCELLED)).toBe(true);
    });

    it('should allow running -> completed', () => {
      expect(canTransition(ExecutionStatus.RUNNING, ExecutionStatus.COMPLETED)).toBe(true);
    });

    it('should allow running -> failed', () => {
      expect(canTransition(ExecutionStatus.RUNNING, ExecutionStatus.FAILED)).toBe(true);
    });

    it('should allow running -> cancelled', () => {
      expect(canTransition(ExecutionStatus.RUNNING, ExecutionStatus.CANCELLED)).toBe(true);
    });

    it('should allow running -> waiting_for_input', () => {
      expect(
        canTransition(ExecutionStatus.RUNNING, ExecutionStatus.WAITING_FOR_INPUT),
      ).toBe(true);
    });

    it('should allow waiting_for_input -> running', () => {
      expect(
        canTransition(ExecutionStatus.WAITING_FOR_INPUT, ExecutionStatus.RUNNING),
      ).toBe(true);
    });

    it('should allow waiting_for_input -> cancelled', () => {
      expect(
        canTransition(ExecutionStatus.WAITING_FOR_INPUT, ExecutionStatus.CANCELLED),
      ).toBe(true);
    });

    it('should disallow completed -> running', () => {
      expect(canTransition(ExecutionStatus.COMPLETED, ExecutionStatus.RUNNING)).toBe(false);
    });

    it('should disallow failed -> running', () => {
      expect(canTransition(ExecutionStatus.FAILED, ExecutionStatus.RUNNING)).toBe(false);
    });

    it('should disallow cancelled -> running', () => {
      expect(canTransition(ExecutionStatus.CANCELLED, ExecutionStatus.RUNNING)).toBe(false);
    });

    it('should disallow pending -> completed', () => {
      expect(canTransition(ExecutionStatus.PENDING, ExecutionStatus.COMPLETED)).toBe(false);
    });

    it('should disallow pending -> failed', () => {
      expect(canTransition(ExecutionStatus.PENDING, ExecutionStatus.FAILED)).toBe(false);
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
  });
});
