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
 * `clemvion.redis.fail_open` 의 라벨 값 — **닫힌 집합**이다.
 *
 * Prometheus 라벨은 값마다 시계열이 하나씩 생긴다. 사용자 입력이나 에러 메시지가 여기로
 * 흘러들면 cardinality 가 터지므로, 라벨 값은 코드가 열거한 것만 허용한다. 문자열 타입으로
 * 두면 그 규칙이 주석에만 있고 컴파일러는 아무것도 막지 않는다.
 */
export type RedisFailOpenComponent = 'idempotency';

/** 강등 원인. `IdempotencyInterceptor` 의 fail-open 다섯 경로에 1:1 대응한다. */
export type RedisFailOpenReason =
  | 'get_failed'
  | 'set_failed'
  | 'serialize_failed'
  | 'entry_corrupt'
  | 'payload_corrupt';

/**
 * Prometheus 라벨 값의 상한. 초과분은 잘라 낸다.
 *
 * 라벨 cardinality 가 터지는 것을 막는 방어선이라 **값 자체가 계약**이다. 종전에는 `64` 가
 * `recordExecutionError`·`recordAuditWriteFailed` 두 곳에 매직넘버로 흩어져 있어, 한쪽만
 * 바꾸면 두 메트릭의 방어 강도가 조용히 갈렸다.
 */
const PROMETHEUS_LABEL_MAX_LEN = 64;

/** 외부 유래 문자열을 라벨에 넣기 전 상한으로 자른다. */
function clampLabel(value: string): string {
  return value.substring(0, PROMETHEUS_LABEL_MAX_LEN);
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
  private readonly auditWriteFailed: Counter;
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
    this.auditWriteFailed = meter.createCounter('clemvion.audit.write_failed', {
      description:
        '감사 로그 적재가 실패해 조용히 삼켜진 횟수 (resource_type 별)',
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
    this.executionErrors.add(1, { error_code: clampLabel(errorCode) });
  }

  /**
   * Redis 의존 기능이 **fail-open 으로 강등**된 사건을 집계.
   *
   * fail-open 은 "요청을 살린다" 와 "장애를 보이게 한다" 가 한 쌍인데, 종전에는 뒤쪽이
   * **warn 로그뿐**이었다 — 로그는 사후 조회는 되지만 **비율·추세로 알람을 걸 수 없다**.
   * 이 카운터가 그 자리를 메운다(예: `rate(clemvion_redis_fail_open[5m]) > 0`).
   *
   * `component` 는 어느 기능이 강등됐는지, `reason` 은 왜인지.
   * 둘 다 **코드가 정하는 닫힌 집합**이라 라벨 cardinality 가 늘지 않는다 — 외부 문자열을
   * 그대로 라벨에 넣으면 Prometheus 가 터진다(`recordExecutionError` 가 클램핑하는 이유와 같다).
   *
   * 그 "닫힌 집합" 을 **타입으로 강제한다**. 종전에는 이 문단이 닫혔다고 주장만 하고 시그니처는
   * 평범한 `string` 이라, 호출부가 사용자 입력을 그대로 넘겨도 컴파일러가 막지 않았다
   * (`recordExecutionError` 는 같은 위험을 클램핑으로 실제 방어하는데 이쪽만 무방비였다).
   * 새 값이 필요하면 아래 유니온에 추가하는 것이 곧 검토 지점이 된다.
   */
  recordRedisFailOpen(
    component: RedisFailOpenComponent,
    reason: RedisFailOpenReason,
  ): void {
    this.redisFailOpen.add(1, { component, reason });
  }

  /**
   * 감사 로그 적재가 **실패해 삼켜진** 사건을 집계.
   *
   * `AuditLogsService.record()` 는 DB 오류를 삼킨다 — 감사 기록 실패가 본 요청(회전·삭제
   * 같은 특권 작업)을 깨뜨리면 안 되기 때문이고, 그 판단 자체는 옳다. 문제는 그 뒤였다:
   * 종전에는 `logger.warn` 한 줄뿐이라 **"작업은 200 으로 성공, 감사 행만 조용히 비어 있음"**
   * 이 아무에게도 안 보였다. 로그는 사후 조회는 되지만 비율·추세로 알람을 걸 수 없다
   * (`recordRedisFailOpen` 이 같은 이유로 존재한다 — 같은 결함 클래스다).
   *
   * 감사 로그는 "계정 탈취 후 조용한 시크릿 교체를 재구성한다" 는 신뢰를 지탱하는데,
   * 그 신뢰는 **적재가 실제로 됐을 때만** 성립한다. 이 카운터가 그 갭을 보이게 한다
   * (예: `rate(clemvion_audit_write_failed[5m]) > 0`).
   *
   * ## 왜 클램핑인가 (닫힌 유니온이 아니라)
   *
   * `resourceType` 은 코드가 정하는 값이라 **distinct 10종**으로 유계다 (`user`·`trigger`·
   * `workflow`·`schedule`·`member`·`workspace`·`integration`·`model_config`·`auth_config`·
   * `execution`). 세는 대상에 주의 — 감사 producer **파일**은 12개고, `resourceType` 이라는
   * 식별자는 알림(`NotificationsService.notify`)도 쓴다(`workspace_invitation`·`alert_rule`은
   * 알림 값이라 여기 안 온다). 그런데 소스인 `AuditLogsService.record()` 의 시그니처가
   * `resourceType: string`(열림)이라 **컴파일러가 닫힘을 증명하지 못한다**. 증명되지 않은 닫힘을 타입으로 주장하는 대신
   * `recordExecutionError` 와 같은 클램핑으로 방어한다 — `record()` 가 닫힌 유니온을
   * 받도록 바뀌면 그때 이쪽도 유니온으로 좁히는 것이 맞다.
   */
  recordAuditWriteFailed(resourceType: string): void {
    this.auditWriteFailed.add(1, { resource_type: clampLabel(resourceType) });
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
