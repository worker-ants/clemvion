import { EIA_EXECUTION_STATUS_VALUES } from './execution-status.literal';
import { ExecutionStatus } from '../../../executions/entities/execution.entity';

/**
 * `EIA_EXECUTION_STATUS_VALUES` wire SoT 불변식의 단일 검증처.
 *
 * 소비 DTO spec(`execution-status-response.dto.spec` / `interact-ack-response.dto.spec`)은
 * "그 DTO 의 swagger `enum` 이 이 SoT 를 반영하는지"만 검증하고, SoT 배열 자체의
 * 순서·집합 불변식은 여기서 고정한다.
 */
describe('EIA_EXECUTION_STATUS_VALUES — wire SoT 불변식', () => {
  it('순서 고정 — wire enum 배열 순서 자체가 계약이다 (순서 회귀 pin)', () => {
    // 하드코딩 리터럴 대조. SoT 배열을 재정렬하면 (파생 심볼 비교와 달리) 여기서 실패한다.
    expect([...EIA_EXECUTION_STATUS_VALUES]).toEqual([
      'pending',
      'running',
      'waiting_for_input',
      'completed',
      'failed',
      'cancelled',
    ]);
  });

  it('엔티티 ExecutionStatus 상태 집합과 동일하다 (순서 무관 — 엔티티↔wire drift 가드)', () => {
    // 엔티티에 상태가 추가/제거되면 wire SoT 도 동반 갱신돼야 한다.
    expect([...EIA_EXECUTION_STATUS_VALUES].sort()).toEqual(
      Object.values(ExecutionStatus).sort(),
    );
  });
});
