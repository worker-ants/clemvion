import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { withTimeout } from '../../common/utils/with-timeout';
import { Execution } from '../executions/entities/execution.entity';
import { ExecutionToken } from './entities/execution-token.entity';

/**
 * 판정 조회를 기다리는 상한(ms). 판정을 기다리는 동안 그 실행의 이벤트는 Redis 에 쓰지 않고 모아 두므로 다른 서버
 * 인스턴스의 구독자가 받는 것이 그만큼 늦는다. 넘기면 조회 실패처럼 열릴 수 있다고 본다.
 */
export const SSE_ELIGIBILITY_TIMEOUT_MS = 2_000;

/**
 * 실행이 EIA SSE 스트림으로 열릴 수 있는지 판정한다. `SseAdapter` 는 열릴 수 있는 실행의 이벤트만 Redis 에 쓴다.
 *
 * 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-XPG8DQ`.
 * 스트림은 트리거 단위 토큰(`itk_*`, 실행에 트리거가 있어야 한다)이나 실행 단위 토큰(`iext_*`, 발급하면 `execution_token`
 * 행이 생긴다)으로만 열린다. 그래서 트리거가 있거나 실행 토큰 행이 있는 실행을 열릴 수 있다고 본다.
 *
 * 판정은 실행마다 한 번이고 뒤집히지 않는다. 첫 판정 뒤에 실행 토큰이 생겨도 문제가 없다. 실행 단위 토큰을 발급하는
 * 곳은 웹훅 실행을 시작하는 `HooksService` 의 `issuePerExecution` 호출 하나뿐이라 그 실행에는 늘 `triggerId` 가 있고
 * 처음부터 쓰기 대상이다(토큰 갱신은 이미 토큰이 있는 실행만 다룬다). 토큰을 발급하는 경로를 더하면 이 전제를 다시 본다.
 *
 * 놓치지 않는 쪽으로 판정한다. 실행 행이 아직 없으면 열릴 수 있다고 본다. 조회가 실패하거나
 * {@link SSE_ELIGIBILITY_TIMEOUT_MS} 를 넘겨도 열릴 수 있다고 보고(fail-open) 경고는 다시 성공할 때까지 한 번만 남긴다.
 */
@Injectable()
export class SseStreamEligibilityService {
  private readonly logger = new Logger(SseStreamEligibilityService.name);
  private degraded = false;

  constructor(
    @InjectRepository(Execution)
    private readonly executions: Repository<Execution>,
    @InjectRepository(ExecutionToken)
    private readonly tokens: Repository<ExecutionToken>,
  ) {}

  /** 던지지 않는다. */
  async canOpenStream(executionId: string): Promise<boolean> {
    try {
      const openable = await withTimeout(
        this.lookup(executionId),
        SSE_ELIGIBILITY_TIMEOUT_MS,
        'EIA SSE 쓰기 대상 판정',
      );
      if (this.degraded) {
        this.degraded = false;
        this.logger.log('EIA SSE 쓰기 대상 판정 조회 복구');
      }
      return openable;
    } catch (err) {
      if (!this.degraded) {
        this.degraded = true;
        this.logger.warn(
          `EIA SSE 쓰기 대상 판정 조회 실패 — 판정하지 못한 실행은 Redis 에 쓴다(복구될 때까지 다시 남기지 않는다): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return true;
    }
  }

  private async lookup(executionId: string): Promise<boolean> {
    const execution = await this.executions.findOne({
      where: { id: executionId },
      select: { id: true, triggerId: true },
    });
    if (!execution || execution.triggerId) return true;
    return this.tokens.exists({ where: { executionId } });
  }
}
