import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Execution } from '../../executions/entities/execution.entity';

/**
 * [Spec EIA §3.3 EIA-AU-04] — iext_* (per_execution JWT) 의 jti 영속 추적.
 *
 * 한 execution 은 여러 jti 를 발급할 수 있다 (refresh 흐름 — old jti blacklist 후 new jti 발급).
 * terminal event (`execution.completed`/`failed`/`cancelled`) 발송 시
 * `NotificationFanout` 가 본 테이블에서 jti 들을 조회해 `InteractionTokenService.revokePerExecution`
 * 으로 즉시 blacklist 한다.
 *
 * execution 이 삭제되면 CASCADE 로 자동 정리.
 */
@Entity('execution_token')
export class ExecutionToken {
  @PrimaryColumn({ type: 'text' })
  jti: string;

  @Column({ name: 'execution_id', type: 'uuid' })
  executionId: string;

  @ManyToOne(() => Execution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution: Execution;

  @CreateDateColumn({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;

  /**
   * JWT exp (절대 시각, UTC). terminal blacklist 시점에 `(exp_at - now)` 를 ttl 로 사용해
   * 만료된 jti 는 Redis 등재 불필요.
   */
  @Column({ name: 'exp_at', type: 'timestamptz' })
  expAt: Date;
}
