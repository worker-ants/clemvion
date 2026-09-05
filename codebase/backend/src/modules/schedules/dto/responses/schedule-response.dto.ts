import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 왜 좁혔나 — 종전 응답은 조인된 `Trigger` **엔티티 전체**를 실어 보냈고, 거기에는
// `notificationSecretV2`(평문 서명 secret) 와 `chatChannelTokenV2`(secret store ref) 가
// 들어 있었다. `TriggersService` 가 트리거 자신의 응답에서 빼는 바로 그 컬럼들이
// **조인을 타고** 새어 나왔고, §5.4 응답-계약 스윕이 `trigger` 를 "선언되지 않은 키" 로
// 검출해 드러났다. 소비처는 `schedules/page.tsx` 네 곳 (`name`·`id`·`workflowId`·
// `workflow.name`).
//
// 내부 서사를 `//` 에 두는 이유: `swagger.md §3` · `review-citations.md §3`.
/**
 * 스케줄에 연결된 트리거의 워크플로우 **참조** — 이름만 담는다.
 */
export class ScheduleTriggerWorkflowRefDto {
  /** 워크플로우 이름 */
  @ApiProperty()
  name: string;
}

/** 스케줄 응답에 동봉되는 트리거 참조 */
export class ScheduleTriggerRefDto {
  /** 트리거 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 트리거 이름 */
  @ApiProperty()
  name: string;

  /** 연결된 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  /**
   * 연결된 워크플로우 — **키 생략형**이다 (§5.4 기준 (b): 선택적 부가 컨텍스트).
   *
   * **생성 응답에만 없다.** `create()` 는 방금 저장한 트리거를 붙이므로 이 관계가 로드되지
   * 않는다. 조회(`findById` 의 `relations: ['trigger','trigger.workflow']` · `findAll` 의
   * join)와 **수정**(`update()` 가 `findById` 로 시작한다)에는 채워진다 — e2e 가 세 형태를
   * 각각 고정한다.
   *
   * 종전 이 주석은 *"생성·수정 응답에는 로드되지 않는다"* 고 적었는데 **수정 쪽이
   * 틀렸다** (`review/code/2026/09/05/22_48_39` W3).
   *
   * 소비처가 부재를 정상 경로로 다룬다 — `schedules/page.tsx` 는
   * `s.trigger?.workflow?.name ?? ""` 로 읽는다.
   */
  @ApiPropertyOptional({ type: () => ScheduleTriggerWorkflowRefDto })
  workflow?: ScheduleTriggerWorkflowRefDto;
}

/** 스케줄 응답 DTO */
export class ScheduleDto {
  /** 스케줄 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 연결된 트리거 UUID */
  @ApiProperty({ format: 'uuid' })
  triggerId: string;

  /** Cron 식 */
  @ApiProperty({ example: '0 9 * * 1-5' })
  cronExpression: string;

  /** 타임존 */
  @ApiProperty({ example: 'Asia/Seoul' })
  timezone: string;

  /** 활성화 여부 */
  @ApiProperty()
  isActive: boolean;

  /** 다음 실행 예정 시각 */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  nextRunAt?: string | null;

  /** 마지막 실행 시각 */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastRunAt?: string | null;

  /** 파라미터 값 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  parameterValues: Record<string, unknown>;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  /**
   * 연결된 트리거 — **참조 수준으로 좁혀진** 형태다 (`ScheduleTriggerRefDto` 주석 참조).
   *
   * **상시 존재한다.** `Schedule.trigger_id` 는 NOT NULL 1:1 이고(`1-data-model.md §2.9.1`),
   * 응답을 내는 네 경로가 전부 채운다 — `findAll`(join) · `findById`(relations) ·
   * `create`/`update`(저장 직후 대입, `isActive` 무관). e2e 가 네 곳을 각각 단언한다.
   *
   */
  // 종전엔 키 생략형으로 선언했는데 §5.4 는 그 형태에 **사유 문서화**를 요구하고, 실측은
  // 부재 경로가 없다고 말한다 (`review/consistency/2026/09/05/21_40_38` W1).
  // — 내부 참조라 `//` 에 둔다: 필드 JSDoc 은 `introspectComments` 로 **공개 OpenAPI
  //   description** 이 된다 (`swagger.md §3`).
  @ApiProperty({ type: () => ScheduleTriggerRefDto })
  trigger: ScheduleTriggerRefDto;
}

/** Cron 다음 실행 시각 프리뷰 */
export class CronPreviewDto {
  /** 다음 실행 예정 시각 목록 (ISO 8601) */
  @ApiProperty({
    type: [String],
    example: ['2026-04-21T00:00:00+09:00', '2026-04-22T00:00:00+09:00'],
  })
  nextRuns: string[];
}

/** 스케줄 즉시 실행 결과 */
export class ScheduleRunNowResultDto {
  /** 생성된 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  executionId: string;
}
