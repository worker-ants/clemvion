import { Injectable, Logger } from '@nestjs/common';
import {
  metrics,
  type Counter,
  type Histogram,
  type ObservableGauge,
  type ObservableResult,
} from '@opentelemetry/api';

/**
 * 한 큐의 깊이 스냅샷 (BullMQ `getJobCounts` 결과의 축약).
 * `queue` 라벨은 큐 이름, 각 수치는 상태별 job 수.
 */
export interface QueueDepthSnapshot {
  queue: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

/** 큐 깊이 observable gauge 가 매 수집 주기에 호출하는 provider. */
export type QueueDepthProvider = () => Promise<QueueDepthSnapshot[]>;

interface LlmTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
}

/**
 * NF-OB-07 도메인/비즈니스 커스텀 메트릭 (spec/5-system/_product-overview.md §5).
 * OTel MeterProvider(NF-OB-02, `instrumentation.ts`) 위에 도메인 instrument 를 만든다.
 *
 * `OTEL_ENABLED` 미설정 시 전역 MeterProvider 가 없어 `getMeter` 는 **no-op meter** 를
 * 돌려준다 — 따라서 모든 record/observe 호출은 비활성 환경에서도 안전한 무동작이다.
 * 호출부는 enable 여부를 신경 쓸 필요 없이 항상 호출하면 된다.
 *
 * 본 메트릭은 운영 관측·알람(Prometheus/Grafana)용 보조 노출이며, 제품 분석의 SoT 는
 * DB 집계 기반 Statistics API 다 (NF-OB-07 "관측 대상의 이원화 정책").
 */
@Injectable()
export class BusinessMetricsService {
  private readonly logger = new Logger(BusinessMetricsService.name);

  private readonly executionTotal: Counter;
  private readonly executionErrors: Counter;
  private readonly llmTokens: Counter;
  private readonly nodeDuration: Histogram;
  private readonly redisFailOpen: Counter;
  private readonly queueDepth: ObservableGauge;
  /** 큐 깊이 provider 목록 — 각 모듈(execution-engine·continuation)이 자기 큐를 등록. */
  private readonly queueProviders: QueueDepthProvider[] = [];

  constructor() {
    const meter = metrics.getMeter('clemvion.business');
    this.executionTotal = meter.createCounter('clemvion.execution.total', {
      description: '워크플로 실행의 종료(terminal) 전이 수',
      unit: '{execution}',
    });
    this.executionErrors = meter.createCounter('clemvion.execution.errors', {
      description: '실패 종료를 에러 코드별로 분해',
      unit: '{error}',
    });
    this.llmTokens = meter.createCounter('clemvion.llm.tokens', {
      description: 'LLM 토큰 사용량 (input/output/thinking)',
      unit: '{token}',
    });
    this.redisFailOpen = meter.createCounter('clemvion.redis.fail_open', {
      description:
        'Redis 의존 기능이 fail-open 으로 강등된 횟수 (component·reason 별)',
      unit: '{event}',
    });
    this.nodeDuration = meter.createHistogram('clemvion.node.duration', {
      description: '노드 실행 지연',
      unit: 'ms',
    });
    this.queueDepth = meter.createObservableGauge('clemvion.queue.depth', {
      description: 'BullMQ 큐 깊이 (state 라벨별)',
      unit: '{job}',
    });
    // async observable callback 은 의도적 — OTel JS SDK 는 async ObservableCallback 의
    // 반환 Promise 를 수집 시 await 한다 (정식 지원 패턴). SUMMARY W-1 false-positive.
    this.queueDepth.addCallback((result) => this.observeQueues(result));
  }

  /** 워크플로 실행이 terminal 상태로 전이했을 때 1 증가 (status 라벨). */
  recordExecutionTerminal(status: string): void {
    this.executionTotal.add(1, { status });
  }

  /** 실패 종료를 에러 코드별로 분해 집계.
   * 외부 유래 `errorCode` 는 최대 64자로 클램핑해 Prometheus 라벨 cardinality 폭발을 방지.
   */
  recordExecutionError(errorCode: string): void {
    this.executionErrors.add(1, {
      error_code: errorCode.substring(0, 64),
    });
  }

  /**
   * Redis 의존 기능이 **fail-open 으로 강등**된 사건을 집계.
   *
   * fail-open 은 "요청을 살린다" 와 "장애를 보이게 한다" 가 한 쌍인데, 종전에는 뒤쪽이
   * **warn 로그뿐**이었다 — 로그는 사후 조회는 되지만 **비율·추세로 알람을 걸 수 없다**.
   * 이 카운터가 그 자리를 메운다(예: `rate(clemvion_redis_fail_open[5m]) > 0`).
   *
   * `component` 는 어느 기능이 강등됐는지(`idempotency` 등), `reason` 은 왜인지
   * (`get_failed`·`set_failed`·`serialize_failed`·`entry_corrupt`·`payload_corrupt`).
   * 둘 다 **코드가 정하는 닫힌 집합**이라 라벨 cardinality 가 늘지 않는다 — 외부 문자열을
   * 그대로 라벨에 넣으면 Prometheus 가 터진다(`recordExecutionError` 가 클램핑하는 이유와 같다).
   */
  recordRedisFailOpen(component: string, reason: string): void {
    this.redisFailOpen.add(1, { component, reason });
  }

  /** LLM 호출의 토큰 사용량을 type 별로 누적 (model 라벨). 0 은 건너뛴다. */
  recordLlmTokens(model: string, usage: LlmTokenUsage): void {
    if (usage.inputTokens) {
      this.llmTokens.add(usage.inputTokens, { model, type: 'input' });
    }
    if (usage.outputTokens) {
      this.llmTokens.add(usage.outputTokens, { model, type: 'output' });
    }
    if (usage.thinkingTokens) {
      this.llmTokens.add(usage.thinkingTokens, { model, type: 'thinking' });
    }
  }

  /** 노드 실행 지연(ms)을 histogram 에 기록 (node_type·status 라벨). */
  recordNodeDuration(
    nodeType: string,
    status: string,
    durationMs: number,
  ): void {
    this.nodeDuration.record(durationMs, {
      node_type: nodeType,
      status,
    });
  }

  /**
   * 큐 깊이 provider 등록. 큐 인스턴스를 가진 모듈(execution-engine·continuation)이
   * 자기 `onModuleInit` 에서 호출한다. gauge 수집 주기마다 모든 provider 를 폴링한다.
   */
  registerQueueDepthProvider(provider: QueueDepthProvider): void {
    this.queueProviders.push(provider);
  }

  /**
   * observable gauge 콜백 — 등록된 provider 를 병렬 폴링해 state 라벨별로 관측한다.
   * `Promise.allSettled` 로 provider 를 병렬 호출해 Redis I/O 직렬 지연 방지 (SUMMARY I-4).
   * 스냅샷 이터레이션으로 await 양보 중 새 provider push 격리 (SUMMARY W-2).
   */
  private async observeQueues(result: ObservableResult): Promise<void> {
    const providers = [...this.queueProviders];
    const results = await Promise.allSettled(providers.map((p) => p()));
    for (const settled of results) {
      if (settled.status === 'rejected') {
        // provider 실패(예: Redis 일시 장애) — 이번 주기 관측만 건너뜀, 최소 로깅 (SUMMARY I-2).
        const msg =
          settled.reason instanceof Error
            ? settled.reason.message
            : String(settled.reason);
        this.logger.warn(`큐 깊이 provider 폴링 실패: ${msg}`);
        continue;
      }
      for (const s of settled.value) {
        result.observe(s.waiting, { queue: s.queue, state: 'waiting' });
        result.observe(s.active, { queue: s.queue, state: 'active' });
        result.observe(s.delayed, { queue: s.queue, state: 'delayed' });
        result.observe(s.failed, { queue: s.queue, state: 'failed' });
      }
    }
  }
}
